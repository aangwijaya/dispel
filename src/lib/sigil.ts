/**
 * Astrolabe sigil generator (DESIGN.md B6).
 * Pure string generation, ported line for line from design/home.html (`sigil()`),
 * design/trade.html (`seal()`) and design/portfolio-activity.html (`dial()`).
 */

export type SigilMood = 'favorable' | 'wait' | 'unclear' | 'reduce-risk'

export const SIGIL_TIP_ANGLE = -35

interface MoodSpec {
  a0: string
  a1: string
  spin: number
  pulse: number
  line: 'up' | 'chop' | 'flat' | 'down'
  fog?: boolean
}

const MOODS: Record<SigilMood, MoodSpec> = {
  favorable: { a0: '#ffc07a', a1: '#ff6363', spin: 300, pulse: 4, line: 'up' },
  wait: { a0: '#ffe0a3', a1: '#e8b04a', spin: 360, pulse: 6, line: 'chop' },
  unclear: { a0: '#6a6b6c', a1: '#9c9c9d', spin: 600, pulse: 0, line: 'flat', fog: true },
  'reduce-risk': { a0: '#ff9aab', a1: '#f0506e', spin: 150, pulse: 2.4, line: 'down' },
}

export interface SigilOptions {
  mood: SigilMood
  strength?: number
  idPrefix: string
  arc?: boolean
  hot?: boolean
  animate?: boolean
  strokeBoost?: number
  /** Drawn below 1040px: hairlines stay 1 screen px, nodes stay legible and upright. */
  crisp?: boolean
}

export interface ArcAngles {
  from: number
  to: number
}

const RAD = (degrees: number): number => (degrees * Math.PI) / 180
const F = (value: number): string => value.toFixed(1)

/** The arc starts at the tip (-35°) and grows clockwise with trend strength. */
export function arcAngles(strength: number): ArcAngles {
  const clamped = Math.max(0, Math.min(100, strength))
  return { from: SIGIL_TIP_ANGLE, to: SIGIL_TIP_ANGLE + 40 + clamped * 1.2 }
}

export function sigilSvg(options: SigilOptions): string {
  const mood = MOODS[options.mood]
  const id = options.idPrefix
  const boost = options.strokeBoost ?? 1
  const W = (alpha: number): string => `rgba(255,255,255,${Math.min(1, alpha * boost).toFixed(3)})`
  const anim = options.animate !== false
  const strength = Math.max(0, Math.min(100, options.strength ?? 0))
  const crisp = options.crisp === true
  // The viewBox is 1040 wide, so a smaller sigil scales every 1px hairline under a pixel and it smears.
  const hair = crisp ? ' vector-effect="non-scaling-stroke"' : ''

  const spinT = (duration: number, direction = 1): string =>
    anim && duration
      ? `<animateTransform attributeName="transform" type="rotate" from="0" to="${360 * direction}" dur="${duration}s" repeatCount="indefinite"/>`
      : ''

  let ticks = ''
  for (let angle = 0; angle < 360; angle += 2) {
    const major = angle % 30 === 0
    const mid = angle % 10 === 0
    const length = major ? 22 : mid ? 13 : 6
    const alpha = major ? 0.38 : mid ? 0.2 : 0.11
    ticks += `<line x1="${F(470 * Math.cos(RAD(angle)))}" y1="${F(470 * Math.sin(RAD(angle)))}" x2="${F((470 - length) * Math.cos(RAD(angle)))}" y2="${F((470 - length) * Math.sin(RAD(angle)))}" stroke="${W(alpha)}"${hair}/>`
  }

  let nodes = ''
  for (let index = 0; index < 12; index++) {
    const angle = RAD(index * 30 + 15)
    const x = 350 * Math.cos(angle)
    const y = 350 * Math.sin(angle)
    const size = crisp ? 7 : 5
    const hot = index === 10 && !mood.fog && (options.arc !== false || options.hot === true)
    // Counter-spin each node against its group so it still orbits but stays an upright diamond.
    const close =
      crisp && anim && mood.spin
        ? `><animateTransform attributeName="transform" type="rotate" from="0 ${F(x)} ${F(y)}" to="360 ${F(x)} ${F(y)}" dur="${mood.spin * 0.66}s" repeatCount="indefinite"/></path>`
        : '/>'
    nodes += `<path d="M${F(x)} ${F(y - size)} L${F(x + size)} ${F(y)} L${F(x)} ${F(y + size)} L${F(x - size)} ${F(y)} Z" fill="${hot ? mood.a1 : '#040506'}" stroke="${hot ? mood.a1 : W(0.34)}"${hair}${close}`
  }

  const star: string[] = []
  for (let t = 0; t <= Math.PI * 8; t += 0.012) {
    const x = 3 * Math.cos(t) + 6.2 * Math.cos(0.75 * t)
    const y = 3 * Math.sin(t) - 6.2 * Math.sin(0.75 * t)
    star.push(`${F(x * 36)},${F(y * 36)}`)
  }

  let art = ''
  if (options.arc !== false) {
    const { from, to } = arcAngles(strength)
    const radius = 410
    const tipX = radius * Math.cos(RAD(from))
    const tipY = radius * Math.sin(RAD(from))
    const path = `M${F(radius * Math.cos(RAD(from)))} ${F(radius * Math.sin(RAD(from)))} A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${F(radius * Math.cos(RAD(to)))} ${F(radius * Math.sin(RAD(to)))}`

    const points: string[] = []
    for (let x = -500; x <= tipX; x += 3) {
      const t = (x + 500) / (tipX + 500)
      const ease = t * t * (3 - 2 * t)
      let y: number
      if (mood.line === 'up') {
        y = 150 + (tipY - 150) * ease + (1 - t) * (18 * Math.sin(t * 13.7) + 7 * Math.sin(t * 31 + 0.6))
      } else if (mood.line === 'down') {
        y = -470 + (tipY + 470) * ease + (1 - t) * (14 * Math.sin(t * 12) + 6 * Math.sin(t * 29))
      } else if (mood.line === 'chop') {
        y = tipY + 30 * (1 - ease) + (1 - t * 0.7) * 34 * Math.sin(t * 23) * Math.cos(t * 6)
      } else {
        y = tipY + 55 * (1 - ease) + 5 * Math.sin(t * 17)
      }
      points.push(`${F(x)},${F(y)}`)
    }

    const pulse =
      anim && mood.pulse
        ? `<animate attributeName="opacity" values=".2;.55;.2" dur="${mood.pulse}s" repeatCount="indefinite"/>`
        : ''

    art = `<defs>
        <linearGradient id="${id}a" gradientUnits="userSpaceOnUse" x1="${F(radius * Math.cos(RAD(to)))}" y1="${F(radius * Math.sin(RAD(to)))}" x2="${F(tipX)}" y2="${F(tipY)}"><stop offset="0" stop-color="${mood.a0}" stop-opacity="0"/><stop offset=".4" stop-color="${mood.a0}" stop-opacity=".7"/><stop offset="1" stop-color="${mood.a1}"/></linearGradient>
        <linearGradient id="${id}l" gradientUnits="userSpaceOnUse" x1="-500" y1="0" x2="${F(tipX)}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".2"/><stop offset=".85" stop-color="${mood.a0}" stop-opacity=".5"/><stop offset="1" stop-color="${mood.a1}" stop-opacity=".9"/></linearGradient>
        <filter id="${id}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      <path d="${path}" fill="none" stroke="url(#${id}a)" stroke-width="5" opacity=".4" filter="url(#${id}g)"/>
      <path d="${path}" fill="none" stroke="url(#${id}a)" stroke-width="1.6" stroke-linecap="round"${mood.fog ? ' stroke-dasharray="5 7"' : ''}/>
      <polyline points="${points.join(' ')}" fill="none" stroke="url(#${id}l)" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="${F(tipX)}" cy="${F(tipY)}" r="9" fill="${mood.a1}" opacity=".4" filter="url(#${id}g)">${pulse}</circle>
      <circle cx="${F(tipX)}" cy="${F(tipY)}" r="3" fill="#fff"/>`
  }

  const instrument = `<circle r="470" fill="none" stroke="${W(0.14)}"${hair}/>
      <g>${ticks}${spinT(mood.spin)}</g>
      <circle r="440" fill="none" stroke="${W(0.07)}" stroke-dasharray="2 7"${hair}/>
      <circle r="410" fill="none" stroke="${W(0.05)}"${hair}/>
      <circle r="350" fill="none" stroke="${W(0.08)}"${hair}/>
      <g>${nodes}${spinT(mood.spin * 0.66, -1)}</g>
      <ellipse rx="330" ry="118" fill="none" stroke="${W(0.06)}" transform="rotate(28)"${hair}/>
      <ellipse rx="330" ry="118" fill="none" stroke="${W(0.06)}" transform="rotate(-28)"${hair}/>
      <circle r="290" fill="none" stroke="${W(0.05)}" stroke-dasharray="1 5"${hair}/>
      <polyline points="${star.join(' ')}" fill="none" stroke="${W(0.075)}"${hair}/>`
  const body = `${instrument}
      ${art}`

  // Unclear fogs the reading; a crisp sigil keeps the instrument itself sharp under the fog.
  const fog = `<defs><filter id="${id}f"><feGaussianBlur stdDeviation="1.1"/></filter></defs>`
  const wrapped = !mood.fog
    ? body
    : crisp
      ? `${fog}<g opacity=".72">${instrument}<g filter="url(#${id}f)">${art}</g></g>`
      : `${fog}<g opacity=".72" filter="url(#${id}f)">${body}</g>`

  return `<svg viewBox="-520 -520 1040 1040" xmlns="http://www.w3.org/2000/svg">${wrapped}</svg>`
}

/** A 22px seal of the sigil: ring, 12 ticks, an arc as long as the setup's odds, the tip. */
export function sealSvg(color: string, odds: number, idPrefix = 'seal'): string {
  const fix = (value: number): string => value.toFixed(2)
  const clamped = Math.max(0, Math.min(100, odds))

  let ticks = ''
  for (let angle = 0; angle < 360; angle += 30) {
    ticks += `<line x1="${fix(10.5 * Math.cos(RAD(angle)))}" y1="${fix(10.5 * Math.sin(RAD(angle)))}" x2="${fix(9 * Math.cos(RAD(angle)))}" y2="${fix(9 * Math.sin(RAD(angle)))}" stroke="rgba(255,255,255,.35)" stroke-width=".8"/>`
  }

  const radius = 6.6
  const length = 40 + clamped * 1.6
  const tipX = radius * Math.cos(RAD(SIGIL_TIP_ANGLE))
  const tipY = radius * Math.sin(RAD(SIGIL_TIP_ANGLE))
  const endX = radius * Math.cos(RAD(SIGIL_TIP_ANGLE + length))
  const endY = radius * Math.sin(RAD(SIGIL_TIP_ANGLE + length))

  return `<svg viewBox="-12 -12 24 24" data-sigil="${idPrefix}" aria-hidden="true"><circle r="10.5" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".8"/>${ticks}<circle r="${radius}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width=".8"/><path d="M${fix(tipX)} ${fix(tipY)} A${radius} ${radius} 0 ${length > 180 ? 1 : 0} 1 ${fix(endX)} ${fix(endY)}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/><circle cx="${fix(tipX)}" cy="${fix(tipY)}" r="1.6" fill="#fff"/></svg>`
}

export interface DialPart {
  value: number
  color: string
  cash?: boolean
}

/** The allocation dial: a 0-100% tick ring with one arc per holding. */
export function dialSvg(parts: DialPart[], idPrefix: string): string {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0) || 1
  const fix = (value: number): string => value.toFixed(2)
  const radius = 70

  let ticks = ''
  for (let index = 0; index < 100; index++) {
    const angle = RAD(index * 3.6 - 90)
    const long = index % 10 === 0
    const outer = 88
    const inner = long ? 80 : 84.5
    ticks += `<line x1="${fix(outer * Math.cos(angle))}" y1="${fix(outer * Math.sin(angle))}" x2="${fix(inner * Math.cos(angle))}" y2="${fix(inner * Math.sin(angle))}" stroke="rgba(255,255,255,${long ? 0.38 : 0.14})"/>`
  }

  let start = -90
  let arcs = ''
  for (const part of parts) {
    const sweep = (Math.max(0, part.value) / total) * 360
    const from = start + 1.2
    const to = start + sweep - 1.2
    if (to > from) {
      const path = `M${fix(radius * Math.cos(RAD(from)))} ${fix(radius * Math.sin(RAD(from)))} A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${fix(radius * Math.cos(RAD(to)))} ${fix(radius * Math.sin(RAD(to)))}`
      arcs += `<path d="${path}" fill="none" stroke="${part.cash ? `url(#${idPrefix}hatch)` : part.color}" stroke-width="9"/>`
    }
    start += sweep
  }

  const cashShare = ((parts.find((part) => part.cash)?.value ?? 0) / total) * 100

  return `<svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="${idPrefix}hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="rgba(156,156,157,.28)"/><rect width="1.6" height="4" fill="rgba(156,156,157,.7)"/></pattern></defs>
      <circle r="94" fill="none" stroke="rgba(255,255,255,.1)"/>
      ${ticks}
      <circle r="${radius}" fill="none" stroke="#1b1c1e" stroke-width="9"/>
      ${arcs}
      <circle r="56" fill="none" stroke="rgba(255,255,255,.06)" stroke-dasharray="1 4"/>
      <text y="4" text-anchor="middle" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="400">${cashShare.toFixed(0)}%</text>
      <text y="22" text-anchor="middle" fill="#6a6b6c" font-family="Geist Mono, monospace" font-size="9" letter-spacing=".6">IN CASH</text>
    </svg>`
}
