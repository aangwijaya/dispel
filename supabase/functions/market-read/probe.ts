/**
 * Step 0 probe: report which external sources answer from the deployed region.
 * Used by the market-read function when called with {"probe":true}; never calls Jev and
 * never writes a row.
 */
import { PROBE_SOURCES, type ProbeCheckResult, type ProbeReport, type SourceCheck } from '../_shared/read/sources.ts'

const PROBE_TIMEOUT_MS = 10_000

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

async function probeCheck(check: SourceCheck, nowMs: number): Promise<ProbeCheckResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  const started = Date.now()
  try {
    const response = await fetch(check.url, {
      method: check.method,
      ...(check.body
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(check.body(nowMs)) }
        : {}),
      signal: controller.signal,
    })
    const text = await response.text()
    return {
      ok: response.ok,
      http_status: response.status,
      latency_ms: Date.now() - started,
      ...(response.ok ? {} : { error: text.slice(0, 160) }),
    }
  } catch (cause) {
    return { ok: false, http_status: null, latency_ms: Date.now() - started, error: messageOf(cause) }
  } finally {
    clearTimeout(timer)
  }
}

export async function runProbe(): Promise<ProbeReport> {
  const now = Date.now()
  const report: ProbeReport = {}
  for (const source of PROBE_SOURCES) {
    const checks: Record<string, ProbeCheckResult> = {}
    for (const check of source.checks) {
      checks[check.name] = await probeCheck(check, now)
    }
    report[source.id] = { ok: Object.values(checks).some((result) => result.ok), checks }
  }
  return report
}
