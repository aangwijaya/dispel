/**
 * paper-order — Supabase Edge Function.
 *
 * Places and fills paper orders at a price the server reads from Binance itself, so a client can
 * never choose its own fill price. The caller's JWT is checked against GoTrue; the RPCs
 * `place_order` / `fill_order` are executable by the service role only.
 *
 * Body: {"action":"place","symbol","side","type","price","quantity"} or {"action":"fill","orderId"}.
 * Errors come back as {"error": "<postgres exception code>"} for the client's friendly mapping.
 */
import {
  parseAuthUserId,
  parsePaperOrderRequest,
  parseRpcErrorMessage,
  parseTickerPrice,
} from '../_shared/paper/request.ts'

interface DenoRuntime {
  env: { get(name: string): string | undefined }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const runtime = globalThis as unknown as { Deno: DenoRuntime }

const BINANCE_HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com']
const REQUEST_TIMEOUT_MS = 5000
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function requireEnv(name: string): string {
  const value = runtime.Deno.env.get(name)
  if (!value) throw new HttpError(500, `missing_env:${name}`)
  return value
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function readJson(response: Request | Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

async function authenticate(request: Request): Promise<string> {
  const authorization = request.headers.get('authorization') ?? ''
  if (!/^Bearer \S+$/.test(authorization)) throw new HttpError(401, 'not_authenticated')
  const response = await fetchWithTimeout(`${requireEnv('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: requireEnv('SUPABASE_ANON_KEY'), Authorization: authorization },
  })
  const userId = response.ok ? parseAuthUserId(await readJson(response)) : null
  if (!userId) throw new HttpError(401, 'not_authenticated')
  return userId
}

async function livePrice(symbol: string): Promise<string> {
  for (const host of BINANCE_HOSTS) {
    try {
      const response = await fetchWithTimeout(`${host}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`)
      if (!response.ok) continue
      const price = parseTickerPrice(await readJson(response), symbol)
      if (price !== null) return price
    } catch {
      // Try the next host.
    }
  }
  throw new HttpError(502, 'price_unavailable')
}

function serviceHeaders(): Record<string, string> {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetchWithTimeout(`${requireEnv('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify(args),
  })
  const payload = await readJson(response)
  if (!response.ok) throw new HttpError(400, parseRpcErrorMessage(payload))
  return payload
}

async function orderSymbol(userId: string, orderId: string): Promise<string> {
  const query = `id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}&select=symbol`
  const response = await fetchWithTimeout(`${requireEnv('SUPABASE_URL')}/rest/v1/orders?${query}`, {
    headers: serviceHeaders(),
  })
  const rows = response.ok ? await readJson(response) : null
  const first: unknown = Array.isArray(rows) ? rows[0] : null
  const symbol = typeof first === 'object' && first !== null && 'symbol' in first ? first.symbol : null
  if (typeof symbol !== 'string') throw new HttpError(404, 'order_not_found')
  return symbol
}

async function handle(request: Request): Promise<unknown> {
  const userId = await authenticate(request)
  const parsed = parsePaperOrderRequest(await readJson(request))
  if (!parsed) throw new HttpError(400, 'invalid_request')

  if (parsed.action === 'fill') {
    const price = await livePrice(await orderSymbol(userId, parsed.orderId))
    return callRpc('fill_order', { p_user_id: userId, p_order_id: parsed.orderId, p_fill_price: price })
  }

  const referencePrice = parsed.type === 'market' ? await livePrice(parsed.symbol) : null
  return callRpc('place_order', {
    p_user_id: userId,
    p_symbol: parsed.symbol,
    p_side: parsed.side,
    p_type: parsed.type,
    p_price: parsed.price,
    p_quantity: parsed.quantity,
    p_reference_price: referencePrice,
  })
}

runtime.Deno.serve(async (request: Request): Promise<Response> => {
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  try {
    return json(200, await handle(request))
  } catch (cause) {
    if (cause instanceof HttpError) return json(cause.status, { error: cause.message })
    console.error(JSON.stringify({ event: 'paper_order_error', message: cause instanceof Error ? cause.message : String(cause) }))
    return json(500, { error: 'internal_error' })
  }
})
