// Procedural score for the Dispel reel. Every sound is synthesised here (no samples) and
// placed from the same cue sheet as the picture, so hits land on the exact frame.
//
//   node design/motion/score.mjs [out.wav]

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import './timeline.js'

const TL = globalThis.DISPEL_TL
const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'dispel-reel.wav')
const SR = 48000
const N = Math.round(TL.duration * SR)
const L = new Float32Array(N)
const R = new Float32Array(N)
const VERB = new Float32Array(N)
const TAU = Math.PI * 2
const BEAT = 60 / TL.bpm

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const seg = (t, a, b) => clamp((t - a) / (b - a))
const db = (x) => 10 ** (x / 20)
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(1234)
const noise = () => rand() * 2 - 1

// RBJ biquad; coefficients can be re-set per sample for sweeps
function biquad() {
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0
  return {
    set(type, f, q = 0.707) {
      const w = (TAU * clamp(f, 10, SR * 0.45)) / SR
      const cos = Math.cos(w)
      const alpha = Math.sin(w) / (2 * q)
      const a0 = 1 + alpha
      if (type === 'lp') [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
      else if (type === 'hp') [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
      else [b0, b1, b2] = [alpha, 0, -alpha]
      b0 /= a0; b1 /= a0; b2 /= a0
      a1 = (-2 * cos) / a0
      a2 = (1 - alpha) / a0
      return this
    },
    run(x) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1; x1 = x; y2 = y1; y1 = y
      return y
    },
  }
}

// place a mono voice on the bus; pan may be a function of local time
function place(t0, dur, fn, { gain = 1, pan = 0, verb = 0 } = {}) {
  const s0 = Math.round(t0 * SR)
  const n = Math.round(dur * SR)
  for (let i = 0; i < n; i++) {
    const idx = s0 + i
    if (idx < 0 || idx >= N) continue
    const t = i / SR
    const v = fn(t) * gain
    const p = typeof pan === 'function' ? pan(t) : pan
    const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4
    L[idx] += v * Math.cos(a)
    R[idx] += v * Math.sin(a)
    VERB[idx] += v * verb
  }
}

// ---------- instruments ----------
function bell(t0, f, { gain = db(-18), decay = 1.6, pan = 0, verb = 0.5, ratio = 1.4, index = 2.4 } = {}) {
  place(t0, decay * 4, (t) => {
    const env = Math.min(1, t / 0.002) * Math.exp(-t / decay)
    const I = index * Math.exp(-t / (decay * 0.25))
    return env * (Math.sin(TAU * f * t + I * Math.sin(TAU * f * ratio * t)) + 0.3 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t / (decay * 0.4)))
  }, { gain, pan, verb })
}
function pluck(t0, f, { gain = db(-22), decay = 0.18, pan = 0, verb = 0.3 } = {}) {
  place(t0, decay * 5, (t) => {
    const env = Math.min(1, t / 0.0015) * Math.exp(-t / decay)
    return env * (Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / (decay * 0.5)))
  }, { gain, pan, verb })
}
function click(t0, { gain = db(-26), f = 3200, pan = 0, verb = 0.1, body = 0.012 } = {}) {
  const hp = biquad().set('hp', 1800)
  place(t0, 0.06, (t) => {
    const n = hp.run(noise()) * Math.exp(-t / 0.0016)
    const tone = Math.sin(TAU * f * t) * Math.exp(-t / body)
    return 0.8 * n + 0.5 * tone
  }, { gain, pan, verb })
}
function kick(t0, { gain = db(-10), f0 = 150, f1 = 44, decay = 0.32, verb = 0.05 } = {}) {
  let phase = 0
  place(t0, decay * 5, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.035)
    phase += (TAU * f) / SR
    const env = Math.min(1, t / 0.001) * Math.exp(-t / decay)
    return env * Math.sin(phase) + 0.25 * noise() * Math.exp(-t / 0.003)
  }, { gain, verb })
}
function boom(t0, { gain = db(-8), f0 = 80, f1 = 38, decay = 1.4, verb = 0.25 } = {}) {
  let phase = 0
  const lp = biquad().set('lp', 900)
  place(t0, decay * 4, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.12)
    phase += (TAU * f) / SR
    const env = Math.min(1, t / 0.004) * Math.exp(-t / decay)
    return env * Math.sin(phase) + 0.6 * lp.run(noise()) * Math.exp(-t / 0.05)
  }, { gain, verb })
}
// band-passed noise whose centre, level and pan follow curves over the sweep
function whoosh(t0, dur, { f0 = 400, f1 = 4000, q = 1.4, gain = db(-18), shape = (x) => Math.sin(Math.PI * x), pan = () => 0, verb = 0.35 } = {}) {
  const bp = biquad()
  const bp2 = biquad()
  place(t0, dur, (t) => {
    const x = t / dur
    const f = f0 * (f1 / f0) ** x
    bp.set('bp', f, q)
    bp2.set('bp', f * 1.5, q)
    return shape(x) * (bp.run(noise()) + 0.5 * bp2.run(noise()))
  }, { gain, pan: (t) => pan(t / dur), verb })
}
function glide(t0, dur, f0, f1, { gain = db(-26), shape = (x) => Math.sin(Math.PI * x), pan = 0, verb = 0.4, harm = 0.2 } = {}) {
  let phase = 0
  place(t0, dur, (t) => {
    const x = t / dur
    phase += (TAU * f0 * (f1 / f0) ** x) / SR
    return shape(x) * (Math.sin(phase) + harm * Math.sin(2 * phase))
  }, { gain, pan, verb })
}
// warm pad: detuned saws through a moving low-pass; notes in MIDI
function pad(t0, t1, notes, { gain = db(-24), cutoff = (x) => 1200, attack = 0.4, release = 0.5, pan = 0.25, verb = 0.6, detune = 7 } = {}) {
  const dur = t1 - t0 + release
  const voices = notes.flatMap((m, k) => [-1, 1].map((d) => ({ f: hz(m) * 2 ** ((d * detune) / 1200), ph: rand(), pan: (k % 2 ? 1 : -1) * pan * (d > 0 ? 1 : 0.6) })))
  const lpL = biquad()
  const lpR = biquad()
  const lpL2 = biquad()
  const lpR2 = biquad()
  const s0 = Math.round(t0 * SR)
  const n = Math.round(dur * SR)
  for (let i = 0; i < n; i++) {
    const idx = s0 + i
    if (idx < 0 || idx >= N) continue
    const t = i / SR
    const env = Math.min(1, t / attack) * (t > t1 - t0 ? Math.exp(-(t - (t1 - t0)) / (release / 3)) : 1)
    let l = 0
    let r = 0
    for (const v of voices) {
      v.ph = (v.ph + v.f / SR) % 1
      const saw = 2 * v.ph - 1
      const a = ((v.pan + 1) * Math.PI) / 4
      l += saw * Math.cos(a)
      r += saw * Math.sin(a)
    }
    const c = cutoff(t / dur)
    if (i % 32 === 0) {
      lpL.set('lp', c, 0.6); lpR.set('lp', c, 0.6); lpL2.set('lp', c * 1.4, 0.6); lpR2.set('lp', c * 1.4, 0.6)
    }
    const g = (env * gain) / voices.length ** 0.5
    const vl = lpL2.run(lpL.run(l)) * g
    const vr = lpR2.run(lpR.run(r)) * g
    L[idx] += vl
    R[idx] += vr
    VERB[idx] += (vl + vr) * 0.5 * verb
  }
}

// ---------- where the lens is, so each illusion fizzes the moment it breaks ----------
// Mirrors lensR and the lens centre in reel.html (camera rotation ignored: well inside a frame for sound).
const outCubic = (x) => 1 - (1 - x) ** 3
const inOutCubic = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2)
function lensR(t) {
  if (t < TL.lens[0]) return 0
  if (t < TL.lens[1]) return 320 * (1 - 2 ** (-10 * seg(t, TL.lens[0], TL.lens[1])))
  if (t < TL.expand[0]) return lerp(320, 412, -(Math.cos(Math.PI * seg(t, TL.lens[1], TL.expand[0])) - 1) / 2)
  return lerp(412, 2500, inOutCubic(seg(t, TL.expand[0], TL.expand[1])))
}
function lensCentre(t) {
  const k = inOutCubic(seg(t, TL.expand[0], TL.clarity))
  const c = { x: lerp(1230, 1592, k), y: lerp(540, 413, k) }
  if (t >= TL.lens[1] + 0.1) return c
  const j = outCubic(seg(t, TL.lens[0], TL.lens[1] + 0.1))
  return { x: lerp(1230 + 281.5, c.x, j), y: lerp(540 - 197.1, c.y, j) }
}
const dissolves = []
for (const b of TL.bubbles) {
  for (let t = TL.lens[0]; t <= TL.expand[1]; t += 1 / 240) {
    const c = lensCentre(t)
    if (lensR(t) >= Math.hypot(b.x - c.x, b.y - c.y) - 54) {
      dissolves.push({ t, b })
      break
    }
  }
}
const panX = (x) => clamp((x - 960) / 900, -1, 1)

// ---------- 01 · Illusion ----------
{
  // a dissonant bed that thickens until the spell cuts it dead
  const lp = biquad()
  let a = 0, b = 0, c = 0
  place(0, TL.spark, (t) => {
    const I = lerp(0.3, 1, seg(t, 0, TL.spark) ** 2.6)
    a += (TAU * 55) / SR
    b += (TAU * 58.27) / SR
    c += (TAU * 82.4 * (1 + 0.004 * Math.sin(t * 5))) / SR
    lp.set('lp', lerp(220, 1150, I), 1.2)
    const saw = (ph) => ((ph / TAU) % 1) * 2 - 1
    const wob = 1 + 0.25 * I * Math.sin(TAU * t * lerp(3, 9, I))
    return seg(t, 0, 0.4) * (1 - seg(t, TL.spark - 0.012, TL.spark)) * wob * I * lp.run(saw(a) + saw(b) + 0.8 * saw(c))
  }, { gain: db(-21), verb: 0.15 })
  // market chatter: blips grow denser
  let t = 0.05
  while (t < TL.spark - 0.03) {
    const I = lerp(0.3, 1, seg(t, 0, TL.spark) ** 2)
    const f = 1800 + rand() * 5200
    const len = 0.006 + rand() * 0.03
    place(t, len * 3, (u) => Math.sin(TAU * f * u) * Math.exp(-u / len), { gain: db(-41 + 10 * I), pan: rand() * 1.6 - 0.8, verb: 0.2 })
    t += (1 / lerp(9, 60, I)) * (0.4 + rand() * 1.2)
  }
  // every piece of hype arrives like a notification
  const pings = [76, 79, 74, 81, 78, 77, 80, 75, 82, 79]
  TL.bubbles.forEach((bub, i) => {
    const pan = panX(bub.x)
    bell(bub.at, hz(pings[i]), { gain: db(-23), decay: 0.32, pan, verb: 0.25, ratio: 2.01, index: 1.2 })
    bell(bub.at + 0.07, hz(pings[i] + 5), { gain: db(-26), decay: 0.4, pan, verb: 0.25, ratio: 2.01, index: 1 })
  })
  for (let i = 0; i < 5; i++) click(TL.captions[0] + 0.1 + i * 0.07, { gain: db(-32), f: 900 + i * 90, pan: -0.55, verb: 0.35, body: 0.03 })
  // tension up to the spell
  whoosh(1.7, TL.spark - 1.7, { f0: 300, f1: 7000, q: 2, gain: db(-18), shape: (x) => x ** 2.6, verb: 0.2 })
  glide(1.9, TL.spark - 1.9, 220, 880, { gain: db(-31), shape: (x) => x ** 2, verb: 0.2 })
}

// ---------- 02 · Dispel ----------
{
  const sp = TL.spark
  // the spell lands and the noise stops
  boom(sp, { gain: db(-11), f0: 90, f1: 36, decay: 1.1, verb: 0.3 })
  ;[76, 83, 88].forEach((m, i) => bell(sp + i * 0.012, hz(m), { gain: db(-19 - i * 2), decay: 2.2, pan: 0.45, verb: 0.85 }))
  place(sp, 0.25, (t) => noise() * Math.exp(-t / 0.04), { gain: db(-24), verb: 0.6 })
  // the lens opens
  glide(TL.lens[0], 0.9, 700, 1760, { gain: db(-31), shape: (x) => Math.sin(Math.PI * x) ** 1.4, pan: 0.35, verb: 0.8, harm: 0.3 })
  // each illusion breaks with a small glassy fizz where it stood
  for (const { t, b } of dissolves) {
    const pan = panX(b.x)
    const hp = biquad().set('hp', 3500)
    place(t, 0.5, (u) => hp.run(noise()) * Math.exp(-u / 0.07) * Math.min(1, u / 0.004), { gain: db(-27), pan, verb: 0.45 })
    bell(t + 0.01, hz(96 + Math.floor(rand() * 5)), { gain: db(-33), decay: 0.25, pan, verb: 0.5, ratio: 2.7, index: 0.6 })
  }
  // the instrument draws itself, inside out
  ;[[3.06, 57], [3.1, 64], [3.46, 69], [3.86, 71], [3.98, 76]].forEach(([t, m], i) =>
    glide(t, 0.6, hz(m) * 0.98, hz(m), { gain: db(-34), shape: (x) => Math.sin(Math.PI * x) ** 2, pan: -0.3 + i * 0.2, verb: 0.75, harm: 0 }))
  const penta = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]
  for (let i = 0; i < 12; i++) {
    const a = i * 30 + 15
    const order = ((((a + 35) % 360) + 360) % 360) / 30
    pluck(3.18 + order * 0.03, hz(penta[Math.floor(order)]), { gain: db(-29), pan: 0.6 * Math.cos((a * Math.PI) / 180), verb: 0.45 })
  }
  // the one clean price line climbs into the tip
  glide(TL.line[0], TL.line[1] - TL.line[0] + 0.04, hz(57), hz(81), { gain: db(-27), shape: (x) => x ** 1.4, pan: (t) => lerp(-0.4, 0.45, t / 0.68), verb: 0.4, harm: 0.35 })
  for (let a = 0; a < 360; a += 10) {
    const ta = 4.04 + ((((a + 35) % 360) + 360) % 360) / 360 * 0.56
    const major = a % 30 === 0
    click(ta, { gain: db(major ? -25 : -32), f: major ? 2400 : 4200, pan: 0.7 * Math.cos((a * Math.PI) / 180), verb: 0.15 })
  }
  // the arc lights
  ;[83, 88].forEach((m, i) => bell(TL.arc + i * 0.015, hz(m), { gain: db(-24 - 2 * i), decay: 1.6, pan: 0.5, verb: 0.8 }))
  kick(TL.arc, { gain: db(-22), f0: 110, f1: 50, decay: 0.2 })
  // the lens clears the whole frame
  whoosh(TL.expand[0] - 0.15, TL.expand[1] - TL.expand[0] + 0.2, { f0: 250, f1: 6500, q: 0.9, gain: db(-15), shape: (x) => Math.sin(Math.PI * clamp(x * 1.05)) ** 1.2, pan: (x) => lerp(0.4, 0.1, x), verb: 0.3 })
  glide(TL.expand[0], TL.clarity - TL.expand[0], hz(57), hz(76), { gain: db(-27), shape: (x) => x ** 1.8 * (1 - seg(x, 0.92, 1)), verb: 0.3, harm: 0.3 })
  pad(sp + 0.05, TL.clarity + 0.1, [45, 52, 57, 59, 64], { gain: db(-27), cutoff: (x) => lerp(500, 1300, x), attack: 0.8, release: 0.3 })
}

// ---------- 03 · Clarity ----------
{
  const c = TL.clarity
  // the chord the illusion was hiding
  kick(c, { gain: db(-14), f0: 140, f1: 46, decay: 0.3 })
  place(c, 0.6, (t) => noise() * Math.exp(-t / 0.09), { gain: db(-30), verb: 0.8 })
  pad(c, TL.trade + 0.05, [41, 48, 52, 57, 60, 64], { gain: db(-23), cutoff: (x) => lerp(1500, 2200, x), attack: 0.05, release: 0.3, verb: 0.65 })
  ;[72, 76, 81].forEach((m, i) => bell(c + 0.02 + i * 0.02, hz(m), { gain: db(-22 - i * 2), decay: 1.8, pan: 0.2 - i * 0.2, verb: 0.75 }))
  // the read writes itself
  bell(TL.verdict + 0.05, hz(88), { gain: db(-27), decay: 1.2, pan: 0.3, verb: 0.7, index: 1.2 })
  for (let k = 0; k < 18; k++) click(TL.verdict + 0.4 + (k / 18) ** 2 * 0.8, { gain: db(-36), f: 6000, pan: 0.2, verb: 0.05, body: 0.003 })
  for (let k = 0; k < 14; k++) click(TL.verdict + 0.5 + k * 0.042, { gain: db(-39), f: 5200 + rand() * 2000, pan: -0.1, verb: 0.1, body: 0.003 })
  // setups slide up, a pluck per row
  whoosh(TL.setups - 0.05, 0.5, { f0: 600, f1: 2200, q: 1.2, gain: db(-30), pan: (x) => lerp(0.3, 0.1, x) })
  ;[76, 79, 83].forEach((m, i) => pluck(TL.setups + 0.12 + i * 0.07, hz(m), { gain: db(-30), decay: 0.12, pan: 0.3, verb: 0.4 }))
  // the cursor arrives and opens the chart
  whoosh(TL.cursor, 0.5, { f0: 1800, f1: 900, q: 2.5, gain: db(-36), pan: (x) => lerp(0.7, 0.4, x) })
  click(TL.openChart, { gain: db(-20), f: 1300, pan: 0.45, verb: 0.15, body: 0.02 })
  whoosh(TL.nav[0], TL.nav[1] - TL.nav[0] + 0.1, { f0: 2400, f1: 500, q: 1, gain: db(-24), pan: (x) => lerp(0.5, -0.3, x), verb: 0.25 })
}

// ---------- 04 · Trade ----------
{
  const n0 = TL.nav[0]
  // the chart rains in from its live tip, right to left
  const scale = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79]
  for (let i = 0; i < 56; i += 2) {
    pluck(n0 + 0.1 + (55 - i) * 0.009, hz(scale[Math.floor(rand() * scale.length)] + 12), { gain: db(-37), decay: 0.05, pan: lerp(-0.4, 0.5, i / 55), verb: 0.2 })
  }
  for (let k = 0; k < 18; k++) click(n0 + 0.15 + (k / 18) ** 2.2 * 0.75, { gain: db(-36), f: 6200, pan: -0.1, verb: 0.05, body: 0.003 })
  whoosh(n0 + 0.5, 0.45, { f0: 1500, f1: 3500, q: 4, gain: db(-33), pan: (x) => lerp(-0.4, 0.4, x) })
  // a light groove: the terminal at work
  const roots = [{ t: TL.trade, m: 33 }, { t: 10.2, m: 29 }, { t: 11.4, m: 36 }, { t: 12.0, m: 31 }]
  for (let t = TL.trade; t < TL.brand - 0.01; t += BEAT / 2) {
    const root = [...roots].reverse().find((r) => t >= r.t - 0.001).m
    const oct = Math.round((t - TL.trade) / (BEAT / 2)) % 2 ? 12 : 0
    const lp = biquad().set('lp', 380, 0.9)
    let ph = 0
    place(t, 0.3, (u) => {
      ph = (ph + hz(root + oct) / SR) % 1
      return lp.run(2 * ph - 1) * Math.exp(-u / 0.13) * Math.min(1, u / 0.002)
    }, { gain: db(-20), verb: 0.05 })
    const hp = biquad().set('hp', 7000)
    place(t + BEAT / 4, 0.05, (u) => hp.run(noise()) * Math.exp(-u / 0.012), { gain: db(-32), pan: 0.3, verb: 0.1 })
  }
  for (let t = TL.trade; t < TL.brand - 0.01; t += BEAT) kick(t, { gain: db(-16), f0: 130, f1: 46, decay: 0.24 })
  pad(TL.trade, 10.25, [57, 60, 64, 71], { gain: db(-29), cutoff: () => 1400, attack: 0.2, release: 0.2 })
  pad(10.2, 11.45, [53, 57, 60, 64], { gain: db(-29), cutoff: () => 1500, attack: 0.1, release: 0.2 })
  pad(11.4, 12.05, [48, 55, 60, 64], { gain: db(-28), cutoff: () => 1700, attack: 0.1, release: 0.2 })
  pad(12.0, TL.logo - 0.08, [43, 50, 55, 59, 62], { gain: db(-27), cutoff: (x) => lerp(1200, 4200, x), attack: 0.1, release: 0.06 })
  whoosh(TL.push[0], TL.push[1] - TL.push[0] + 0.1, { f0: 400, f1: 1600, q: 0.9, gain: db(-28), pan: (x) => lerp(-0.2, 0.4, x) })
  // click one: 50% of the paper cash
  click(TL.click1, { gain: db(-17), f: 1500, pan: 0.45, verb: 0.15, body: 0.02 })
  bell(TL.click1 + 0.02, hz(84), { gain: db(-27), decay: 0.3, pan: 0.45, verb: 0.3, index: 0.8 })
  for (let k = 0; k < 4; k++) click(TL.click1 + 0.08 + k * 0.055, { gain: db(-31), f: 1100 + rand() * 300, pan: 0.45, verb: 0.08, body: 0.015 })
  for (let k = 0; k < 10; k++) click(TL.click1 + 0.1 + (k / 10) ** 2 * 0.35, { gain: db(-37), f: 6400, pan: 0.45, verb: 0.05, body: 0.003 })
  // click two: Buy SOL, filled at market
  click(TL.click2, { gain: db(-15), f: 900, pan: 0.45, verb: 0.15, body: 0.03 })
  kick(TL.click2, { gain: db(-20), f0: 200, f1: 90, decay: 0.08 })
  bell(TL.filled, hz(76), { gain: db(-19), decay: 0.9, pan: 0.35, verb: 0.6 })
  bell(TL.filled + 0.12, hz(83), { gain: db(-18), decay: 1.4, pan: 0.4, verb: 0.65 })
  for (let k = 0; k < 16; k++) click(TL.filled + 0.05 + (k / 16) ** 2.2 * 0.65, { gain: db(-37), f: 6600, pan: 0.45, verb: 0.05, body: 0.003 })
}

// ---------- 05 · Brand ----------
{
  const L = TL.logo
  // the live tip flies to the logo: everything inhales, then a breath of silence
  whoosh(TL.brand, L - TL.brand - 0.06, { f0: 200, f1: 8000, q: 0.8, gain: db(-14), shape: (x) => x ** 3, pan: (x) => lerp(0.4, -0.1, x), verb: 0.1 })
  glide(TL.brand, L - TL.brand - 0.06, hz(45), hz(69), { gain: db(-25), shape: (x) => x ** 3, verb: 0.1, harm: 0.5 })
  boom(L, { gain: db(-7), f0: 90, f1: 34, decay: 2.2, verb: 0.3 })
  kick(L, { gain: db(-10), f0: 180, f1: 50, decay: 0.3 })
  place(L, 1.2, (t) => noise() * Math.exp(-t / 0.18), { gain: db(-28), verb: 0.9 })
  pad(L, TL.duration, [33, 45, 52, 57, 61, 64, 71], { gain: db(-23), cutoff: (x) => lerp(900, 2400, Math.min(1, x * 2.5)), attack: 0.02, release: 0.1, verb: 0.7 })
  ;[76, 81, 85, 88].forEach((m, i) => bell(L + i * 0.02, hz(m), { gain: db(-19 - i * 2), decay: 2.6, pan: -0.3 + i * 0.2, verb: 0.9 }))
  bell(TL.endIgnite, hz(93), { gain: db(-22), decay: 1.8, pan: 0.55, verb: 0.9 })
  whoosh(TL.endIgnite - 0.1, 0.8, { f0: 5000, f1: 2000, q: 3, gain: db(-30), pan: () => 0.55, verb: 0.6 })
  for (let i = 0; i < 5; i++) click(TL.tagline + i * 0.06, { gain: db(-37), f: 1600, pan: -0.2 + i * 0.1, verb: 0.4, body: 0.02 })
  for (let k = 0; k < 16; k++) click(TL.meta + k * 0.025, { gain: db(-40), f: 6000, pan: 0, verb: 0.2, body: 0.003 })
}

// ---------- clock: the instrument ticks while it measures ----------
for (let t = TL.spark + BEAT / 2; t < TL.trade; t += BEAT / 2) {
  const tock = Math.round((t - TL.spark) / (BEAT / 2)) % 2 === 0
  click(t, { gain: db(tock ? -36 : -39), f: tock ? 2100 : 2800, pan: tock ? -0.2 : 0.2, verb: 0.2, body: 0.006 })
}

// ---------- reverb (Freeverb) and master ----------
function freeverb(input, spread) {
  const scale = SR / 44100
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0, store: 0 }))
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0 }))
  const out = new Float32Array(N)
  const feedback = 0.86
  const damp = 0.3
  for (let n = 0; n < N; n++) {
    const x = input[n] * 0.015
    let y = 0
    for (const c of combs) {
      const o = c.buf[c.i]
      c.store = o * (1 - damp) + c.store * damp
      c.buf[c.i] = x + c.store * feedback
      c.i = (c.i + 1) % c.buf.length
      y += o
    }
    for (const a of aps) {
      const o = a.buf[a.i]
      a.buf[a.i] = y + o * 0.5
      a.i = (a.i + 1) % a.buf.length
      y = o - y
    }
    out[n] = y
  }
  return out
}
const wetL = freeverb(VERB, 0)
const wetR = freeverb(VERB, 23)
const WET = 0.9
let peak = 0
for (let n = 0; n < N; n++) {
  L[n] += wetL[n] * WET
  R[n] += wetR[n] * WET
}
// gentle high-pass on the master to keep the low end tidy
const hpL = biquad().set('hp', 28)
const hpR = biquad().set('hp', 28)
for (let n = 0; n < N; n++) {
  const t = n / SR
  const fade = Math.min(1, t / 0.02) * (1 - seg(t, TL.duration - 0.45, TL.duration))
  L[n] = Math.tanh(hpL.run(L[n]) * 1.4) * fade
  R[n] = Math.tanh(hpR.run(R[n]) * 1.4) * fade
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]))
}
const norm = 0.89 / peak

const data = Buffer.alloc(44 + N * 4)
data.write('RIFF', 0)
data.writeUInt32LE(36 + N * 4, 4)
data.write('WAVEfmt ', 8)
data.writeUInt32LE(16, 16)
data.writeUInt16LE(1, 20)
data.writeUInt16LE(2, 22)
data.writeUInt32LE(SR, 24)
data.writeUInt32LE(SR * 4, 28)
data.writeUInt16LE(4, 32)
data.writeUInt16LE(16, 34)
data.write('data', 36)
data.writeUInt32LE(N * 4, 40)
for (let n = 0; n < N; n++) {
  data.writeInt16LE(Math.round(clamp(L[n] * norm, -1, 1) * 32767), 44 + n * 4)
  data.writeInt16LE(Math.round(clamp(R[n] * norm, -1, 1) * 32767), 46 + n * 4)
}
writeFileSync(out, data)
console.log(`wrote ${out} (peak ${peak.toFixed(3)} → normalised)`)
