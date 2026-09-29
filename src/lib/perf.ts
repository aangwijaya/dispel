export type PerformanceMode = 'full' | 'lite'

const SOFTWARE_RENDERER = /llvmpipe|softpipe|software|swiftshader|zink/i
const OVERRIDE_KEY = 'dispel-perf'

function rendererLooksSoftware(gl: WebGLRenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  if (info === null) return false
  const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '')
  return SOFTWARE_RENDERER.test(renderer)
}

/**
 * Lite mode targets software renderers (WSLg/WebKitGTK without /dev/dri, VMs without GPU):
 * it keeps the look but drops per-frame paint work (animated conic border, backdrop filters,
 * drifting blurs). GPU machines keep the full design.
 *
 * Override for testing: localStorage.setItem('dispel-perf', 'full' | 'lite').
 */
export function detectPerformanceMode(): PerformanceMode {
  try {
    const override = localStorage.getItem(OVERRIDE_KEY)
    if (override === 'full' || override === 'lite') return override
  } catch {
    // No storage access: keep detecting.
  }
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ?? (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (gl === null) return 'lite'
    return rendererLooksSoftware(gl) ? 'lite' : 'full'
  } catch {
    return 'lite'
  }
}

export function applyPerformanceMode(): PerformanceMode {
  const mode = detectPerformanceMode()
  try {
    document.documentElement.dataset.perf = mode
  } catch {
    // Attribute failures are harmless; full mode stays.
  }
  return mode
}
