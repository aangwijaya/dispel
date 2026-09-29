// Generates Dispel's "Candle Light" artwork family.
//   node design/assets/generate-hero.mjs
// dispel-hero.svg     brand hero (Sign in): a rising run in coral / cobalt
// (Home uses dispel-hero.svg itself as the favorable aura)
// aura-wait.svg       Home aura, wait: choppy two-way run in amber / slate
// aura-unclear.svg    Home aura, unclear: compressed candles lost in grey fog
// aura-riskoff.svg    Home aura, reduce risk: a range that holds support, breaks it, fails the retest
//                     and capitulates. Crimson sell candles, cold steel relief bounces, the broken
//                     support drawn as a line that turns to dashes where it gives way.
// Each run is drawn twice: blurred into haze, then crisp inside a radial focus mask.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));

const PALETTES = {
  brand: {
    warm: [['0', '#ffc07a'], ['.3', '#ff6363'], ['.72', '#ff2f6d'], ['1', '#7a0f2e', '.2']],
    cool: [['0', '#8aa4ff'], ['.45', '#2d52d6'], ['1', '#02193b', '.2']],
    glowWarm: '#ff4b5c', glowCool: '#1f47c7',
  },
  wait: {
    warm: [['0', '#ffe0a3'], ['.35', '#e8b04a'], ['.75', '#b5541c'], ['1', '#3d1a08', '.2']],
    cool: [['0', '#a3adc7'], ['.5', '#46506e'], ['1', '#0b1426', '.2']],
    glowWarm: '#e89a3a', glowCool: '#39425e',
  },
  riskoff: {
    // warm = up candles (weak relief bounces), cool = down candles (the selling)
    warm: [['0', '#d5ddf0'], ['.45', '#66769a'], ['1', '#10182c', '.2']],
    cool: [['0', '#ff9aab'], ['.28', '#f0506e'], ['.7', '#b3123e'], ['1', '#2a0412', '.2']],
    glowWarm: '#b3123e', glowCool: '#0e2a6b',
  },
  fog: {
    warm: [['0', '#f0f0f0'], ['.4', '#a9a9ab'], ['1', '#2a2a2c', '.2']],
    cool: [['0', '#9aa1ad'], ['.5', '#4d535e'], ['1', '#15181d', '.2']],
    glowWarm: '#8b8b90', glowCool: '#3a4250',
  },
};

const RISKOFF_STORY = [
  [4.2, 3.6, 4.5, 3.4], [3.6, 4.3, 4.6, 3.4], [4.3, 3.3, 4.4, 3.1], [3.3, 3.9, 4.1, 3.2],
  [3.9, 3.0, 4.0, 2.85], [3.0, 3.7, 3.9, 2.9], [3.7, 3.1, 3.8, 2.9], [3.1, 3.4, 3.6, 3.0],
  [3.4, 2.95, 3.5, 2.82], [2.95, 1.1, 3.0, 0.9], [1.1, 0.55, 1.3, 0.3], [0.55, 1.5, 1.6, 0.4],
  [1.5, 2.3, 2.85, 1.4], [2.3, 1.0, 2.4, 0.9], [1.0, -0.4, 1.1, -0.6], [-0.4, -0.1, 0.1, -0.6],
  [-0.1, -1.6, 0.0, -1.8], [-1.6, -3.3, -1.5, -4.3], [-3.3, -2.4, -2.2, -3.7], [-2.4, -3.0, -2.2, -3.2],
  [-3.0, -2.7, -2.5, -3.1], [-2.7, -3.1, -2.6, -3.3],
];

// Brand hero: a confident rising run with healthy pullbacks. Scripted so every bar is large and legible.
const HERO_STORY = [
  [0, 2.2, 2.5, -0.3], [2.2, 0.8, 2.4, 0.5], [0.8, 3.2, 3.5, 0.6], [3.2, 1.9, 3.4, 1.6],
  [1.9, 4.3, 4.6, 1.7], [4.3, 3.0, 4.5, 2.7], [3.0, 5.6, 5.9, 2.8], [5.6, 4.1, 5.8, 3.8],
  [4.1, 6.8, 7.2, 3.9], [6.8, 5.5, 7.0, 5.2], [5.5, 8.0, 8.4, 5.3], [8.0, 6.9, 8.2, 6.6],
  [6.9, 9.2, 9.6, 6.7], [9.2, 8.4, 9.4, 8.1],
];

const VARIANTS = [
  { file: 'dispel-hero.svg', story: HERO_STORY, sp: 112, w: 72, x0: 16, y0: null, k: 190,
    minBody: 200, rotate: 28, haze: 22, soft: 3, focusR: 560, focusAt: { i: 7, price: 5 }, crisp: 1, grain: 0.07, palette: 'brand' },
  { file: 'aura-wait.svg', seed: 7, n: 24, upProb: 0.47, sizeMin: 1.2, sizeRange: 2.6, downMul: 1.05, y0: null, k: 88,
    minBody: 60, rotate: 18, haze: 34, focusR: 340, focusCx: 860, focusCy: 480, crisp: 0.75, grain: 0.08, palette: 'wait' },
  { file: 'aura-unclear.svg', seed: 1234, n: 26, upProb: 0.5, sizeMin: 0.15, sizeRange: 0.5, downMul: 1, y0: null, k: 80,
    minBody: 22, rotate: 6, haze: 42, focusR: 260, focusCx: 840, focusCy: 500, crisp: 0.45, grain: 0.11, palette: 'fog' },
  { file: 'aura-riskoff.svg', story: RISKOFF_STORY, sp: 92, w: 72, x0: -150, y0: null, k: 104,
    minBody: 44, rotate: 0, haze: 24, focusR: 470, focusAt: { i: 11, price: 1.9 }, crisp: 0.95, grain: 0.08,
    palette: 'riskoff', support: { price: 2.8, breakAt: 9, touches: [4, 6, 8], retest: 12 }, flareAt: { i: 9, price: 2.1 }, vignette: 0.62 },
];

const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a ? ` stop-opacity="${a}"` : ''}/>`).join('');

function build(v) {
  let s = v.seed;
  const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const SP = v.sp ?? 88, W = v.w ?? 60, X0 = v.x0 ?? -260;
  let p = 0; const candles = [];
  if (v.story) {
    for (const [open, close, high, low] of v.story) candles.push({ open, close, high, low, up: close > open });
  }
  for (let i = 0; i < (v.story ? 0 : v.n); i++) {
    const open = p;
    const up = r() < v.upProb;
    const size = v.sizeMin + r() * v.sizeRange;
    const close = open + (up ? size : -size * v.downMul);
    const high = Math.max(open, close) + 0.2 + r() * 1.1;
    const low = Math.min(open, close) - 0.2 - r() * 1.1;
    candles.push({ open, close, high, low, up });
    p = close;
  }
  const mean = candles.reduce((a, c) => a + (c.open + c.close) / 2, 0) / candles.length;
  const y0 = v.y0 ?? 500 + mean * v.k;
  const y = (val) => y0 - val * v.k;
  const body = candles.map((c, i) => {
    const x = X0 + i * SP;
    const top = y(Math.max(c.open, c.close)), bot = y(Math.min(c.open, c.close));
    const h = Math.max(bot - top, v.minBody);
    const g = c.up ? 'warm' : 'cool';
    return `<rect x="${x}" y="${top.toFixed(1)}" width="${W}" height="${h.toFixed(1)}" rx="${W > 64 ? 9 : 7}" fill="url(#${g})"/>` +
      `<rect x="${x + W / 2 - 1.5}" y="${y(c.high).toFixed(1)}" width="3" height="${(y(c.low) - y(c.high)).toFixed(1)}" rx="1.5" fill="url(#${g})" opacity=".75"/>`;
  }).join('\n    ');
  const P = PALETTES[v.palette];

  // Map a point in the run's (unrotated) space to the canvas, for masks that live outside the group.
  const th = (v.rotate * Math.PI) / 180;
  const toCanvas = (px, py) => [800 + (px - 800) * Math.cos(th) - (py - 500) * Math.sin(th), 500 + (px - 800) * Math.sin(th) + (py - 500) * Math.cos(th)];
  const cx = (i) => X0 + i * SP + W / 2;
  let focusCx = v.focusCx, focusCy = v.focusCy;
  if (v.focusAt) [focusCx, focusCy] = toCanvas(cx(v.focusAt.i), y(v.focusAt.price)).map((n) => n.toFixed(1));

  // Optional story elements (risk-off): the support line and the flare where it breaks.
  let extrasDefs = '', extrasBack = '', extrasFront = '';
  if (v.support) {
    const ly = y(v.support.price).toFixed(1), bx = cx(v.support.breakAt).toFixed(1);
    const line = `<line x1="${X0 - 200}" x2="${bx}" y1="${ly}" y2="${ly}" stroke="#ffffff" stroke-opacity=".42" stroke-width="3" stroke-linecap="round"/>` +
      `<line x1="${bx}" x2="${X0 + candles.length * SP + 300}" y1="${ly}" y2="${ly}" stroke="#ff6b85" stroke-opacity=".5" stroke-width="3" stroke-dasharray="18 14" stroke-linecap="round"/>`;
    extrasDefs += `<filter id="lineGlow" filterUnits="userSpaceOnUse" x="-300" y="-300" width="2200" height="1600"><feGaussianBlur stdDeviation="7"/></filter>`;
    // Where the level held (white) and where the retest from below failed (crimson).
    const dot = (i, c, o) => `<circle cx="${cx(i).toFixed(1)}" cy="${ly}" r="6" fill="${c}" fill-opacity="${o}"/>`;
    const marks = (v.support.touches ?? []).map((i) => dot(i, '#ffffff', 0.7)).join('') +
      (v.support.retest != null ? dot(v.support.retest, '#ff4d6d', 0.95) : '');
    extrasDefs += `<g id="support" transform="rotate(${v.rotate} 800 500)">${line}${marks}</g>`;
    extrasFront += `<use href="#support" filter="url(#lineGlow)"/><use href="#support"/>`;
  }
  if (v.flareAt) {
    const fx = cx(v.flareAt.i).toFixed(1), fy = y(v.flareAt.price).toFixed(1);
    extrasDefs += `<radialGradient id="flare" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff4d6d" stop-opacity=".75"/><stop offset=".4" stop-color="#c8163f" stop-opacity=".35"/><stop offset="1" stop-color="#c8163f" stop-opacity="0"/></radialGradient>`;
    extrasBack += `<g transform="rotate(${v.rotate} 800 500)"><ellipse cx="${fx}" cy="${fy}" rx="260" ry="200" fill="url(#flare)"/></g>`;
  }
  if (v.vignette) {
    extrasDefs += `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".45" stop-color="#040506" stop-opacity="0"/><stop offset="1" stop-color="#040506" stop-opacity="${v.vignette}"/></radialGradient>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">${stops(P.warm)}</linearGradient>
    <linearGradient id="cool" x1="0" y1="0" x2="0" y2="1">${stops(P.cool)}</linearGradient>
    <radialGradient id="glowWarm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${P.glowWarm}" stop-opacity=".55"/><stop offset="1" stop-color="${P.glowWarm}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowCool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${P.glowCool}" stop-opacity=".5"/><stop offset="1" stop-color="${P.glowCool}" stop-opacity="0"/></radialGradient>
    <radialGradient id="focusGrad" cx="${focusCx}" cy="${focusCy}" r="${v.focusR}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="focus" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"><rect width="1600" height="1000" fill="url(#focusGrad)"/></mask>
    <filter id="haze" filterUnits="userSpaceOnUse" x="-300" y="-300" width="2200" height="1600"><feGaussianBlur stdDeviation="${v.haze}"/></filter>
    ${extrasDefs}
    <filter id="soft" filterUnits="userSpaceOnUse" x="-300" y="-300" width="2200" height="1600"><feGaussianBlur stdDeviation="${v.soft ?? 5}"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${v.grain} 0"/>
    </filter>
    <g id="run" transform="rotate(${v.rotate} 800 500)">
    ${body}
    </g>
  </defs>
  <ellipse cx="1000" cy="380" rx="620" ry="380" fill="url(#glowWarm)"/>
  <ellipse cx="360" cy="820" rx="560" ry="340" fill="url(#glowCool)"/>
  ${extrasBack}
  <use href="#run" filter="url(#haze)" opacity=".95"/>
  <use href="#run" filter="url(#soft)" mask="url(#focus)" opacity="${v.crisp}"/>
  ${extrasFront}
  ${v.vignette ? '<rect width="1600" height="1000" fill="url(#vig)"/>' : ''}
  <rect width="1600" height="1000" filter="url(#grain)"/>
</svg>
`.replace(/\n\s*\n/g, '\n');
}

for (const v of VARIANTS) {
  writeFileSync(join(OUT, v.file), build(v));
  console.log('wrote', v.file);
}
