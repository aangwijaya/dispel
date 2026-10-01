import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { cancel, onUrl, start } from '@fabianlars/tauri-plugin-oauth'
import { friendlyAuthError } from './errors'
import { supabase } from './supabase'

const OAUTH_PORTS = [52423, 52424, 52425]
const CALLBACK_TIMEOUT_MS = 3 * 60_000

const DONE_PAGE =
  '<!doctype html><html><head><meta charset="utf-8"><title>Dispel</title></head>' +
  '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
  'background:#040506;color:#e6e6e6;font:14px system-ui">' +
  'Signed in. You can close this tab and return to Dispel.</body></html>'

export type OAuthCallback = { ok: true; code: string } | { ok: false; error: string }

/** Reads the PKCE code (or the provider error) from the loopback callback URL. */
export function parseOAuthCallback(raw: string): OAuthCallback {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: 'Google sign-in returned an unreadable response.' }
  }

  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const code = url.searchParams.get('code') ?? hash.get('code')
  if (code !== null && code !== '') return { ok: true, code }

  const error =
    url.searchParams.get('error_description') ??
    hash.get('error_description') ??
    url.searchParams.get('error') ??
    hash.get('error')
  return { ok: false, error: error ?? 'Google did not return a sign-in code.' }
}

function friendlyOAuthError(error: string): string {
  const lower = error.toLowerCase()
  if (lower.includes('denied') || lower.includes('access_denied')) return 'Google sign-in was cancelled.'
  return friendlyAuthError(error)
}

export type GoogleSignInResult = { ok: true } | { ok: false; error: string }

/**
 * Desktop Google sign-in: a temporary loopback server catches the Supabase redirect while the
 * system browser does the OAuth dance; the PKCE code is exchanged back in the webview.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!isTauri()) {
    return { ok: false, error: 'Google sign-in works in the desktop app. Use email here.' }
  }

  let port: number | null = null
  let unlisten: (() => void) | null = null
  let timer: number | null = null

  try {
    port = await start({ ports: OAUTH_PORTS, response: DONE_PAGE })

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: `http://localhost:${port}`,
      },
    })
    if (error || !data.url) {
      return { ok: false, error: error ? friendlyAuthError(error.message) : 'Google sign-in could not start.' }
    }

    let resolveUrl: (url: string) => void = () => {}
    const callback = new Promise<string>((resolve) => {
      resolveUrl = resolve
    })
    unlisten = await onUrl((url) => resolveUrl(url))

    const timeout = new Promise<null>((resolve) => {
      timer = window.setTimeout(() => resolve(null), CALLBACK_TIMEOUT_MS)
    })

    await openUrl(data.url)
    const callbackUrl = await Promise.race([callback, timeout])
    if (callbackUrl === null) return { ok: false, error: 'Google sign-in timed out. Try again.' }

    const parsed = parseOAuthCallback(callbackUrl)
    if (!parsed.ok) return { ok: false, error: friendlyOAuthError(parsed.error) }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code)
    if (exchangeError) return { ok: false, error: friendlyAuthError(exchangeError.message) }
    return { ok: true }
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Google sign-in failed.' }
  } finally {
    if (timer !== null) window.clearTimeout(timer)
    if (unlisten !== null) unlisten()
    if (port !== null) {
      try {
        await cancel(port)
      } catch {
        // The server is already gone.
      }
    }
  }
}
