// Generates Dispel's "Candle Light" artwork family.
//   node design/assets/generate-hero.mjs
// dispel-hero.svg     brand hero (Sign in): a rising run in coral / cobalt
// (Home uses dispel-hero.svg itself as the favorable aura)
// aura-wait.svg       Home aura, wait: choppy two-way run in amber / slate
// aura-unclear.svg    Home aura, unclear: compressed candles lost in grey fog
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
  fog: {
    warm: [['0', '#f0f0f0'], ['.4', '#a9a9ab'], ['1', '#2a2a2c', '.2']],
    cool: [['0', '#9aa1ad'], ['.5', '#4d535e'], ['1', '#15181d', '.2']],
    glowWarm: '#8b8b90', glowCool: '#3a4250',
  },
};

const VARIANTS = [
  { file: 'dispel-hero.svg', seed: 42, n: 22, upProb: 0.58, sizeMin: 0.9, sizeRange: 2.3, downMul: 0.9, y0: 760, k: 92,
    minBody: 70, rotate: 28, haze: 30, focusR: 430, focusCx: 820, focusCy: 470, crisp: 0.9, grain: 0.07, palette: 'brand' },
  { file: 'aura-wait.svg', seed: 7, n: 24, upProb: 0.47, sizeMin: 1.2, sizeRange: 2.6, downMul: 1.05, y0: null, k: 88,
    minBody: 60, rotate: 18, haze: 34, focusR: 340, focusCx: 860, focusCy: 480, crisp: 0.75, grain: 0.08, palette: 'wait' },
  { file: 'aura-unclear.svg', seed: 1234, n: 26, upProb: 0.5, sizeMin: 0.15, sizeRange: 0.5, downMul: 1, y0: null, k: 80,
    minBody: 22, rotate: 6, haze: 42, focusR: 260, focusCx: 840, focusCy: 500, crisp: 0.45, grain: 0.11, palette: 'fog' },
];

const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a ? ` stop-opacity="${a}"` : ''}/>`).join('');

function build(v) {
  let s = v.seed;
  const r = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const SP = 88, W = 60, X0 = -260;
  let p = 0; const candles = [];
  for (let i = 0; i < v.n; i++) {
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
    return `<rect x="${x}" y="${top.toFixed(1)}" width="${W}" height="${h.toFixed(1)}" rx="7" fill="url(#${g})"/>` +
      `<rect x="${x + W / 2 - 1.5}" y="${y(c.high).toFixed(1)}" width="3" height="${(y(c.low) - y(c.high)).toFixed(1)}" rx="1.5" fill="url(#${g})" opacity=".75"/>`;
  }).join('\n    ');
  const P = PALETTES[v.palette];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">${stops(P.warm)}</linearGradient>
    <linearGradient id="cool" x1="0" y1="0" x2="0" y2="1">${stops(P.cool)}</linearGradient>
    <radialGradient id="glowWarm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${P.glowWarm}" stop-opacity=".55"/><stop offset="1" stop-color="${P.glowWarm}" stop-opacity="0"/></radialGradient>
    <radialGradient id="glowCool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${P.glowCool}" stop-opacity=".5"/><stop offset="1" stop-color="${P.glowCool}" stop-opacity="0"/></radialGradient>
    <radialGradient id="focusGrad" cx="${v.focusCx}" cy="${v.focusCy}" r="${v.focusR}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="focus" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"><rect width="1600" height="1000" fill="url(#focusGrad)"/></mask>
    <filter id="haze" filterUnits="userSpaceOnUse" x="-300" y="-300" width="2200" height="1600"><feGaussianBlur stdDeviation="${v.haze}"/></filter>
    <filter id="soft" filterUnits="userSpaceOnUse" x="-300" y="-300" width="2200" height="1600"><feGaussianBlur stdDeviation="5"/></filter>
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
  <use href="#run" filter="url(#haze)" opacity=".95"/>
  <use href="#run" filter="url(#soft)" mask="url(#focus)" opacity="${v.crisp}"/>
  <rect width="1600" height="1000" filter="url(#grain)"/>
</svg>
`;
}

for (const v of VARIANTS) {
  writeFileSync(join(OUT, v.file), build(v));
  console.log('wrote', v.file);
}
