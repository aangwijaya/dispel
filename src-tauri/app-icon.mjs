// Generates Dispel's app icon set from code.
//   node src-tauri/app-icon.mjs
// app-icon.svg        full icon (48px and up): the brand mark, an open coral D ending in the white tip, on a near-black tile. Flat.
// app-icon-small.svg  16/24/32px: the same mark, larger in a fuller tile and without the hairline edge
// Then runs `tauri icon` for both and builds icons/icon.ico with the small variant for 16/24/32px.
import { writeFileSync, readFileSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const F = (n) => n.toFixed(1), C = 512;
// Superellipse tile (n = 5): the continuous corner of a modern app icon, inset by margin m.
const tile = (m) => {
  const a = C - m;
  let d = '';
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    d += `${i ? 'L' : 'M'}${F(C + a * Math.sign(c) * Math.abs(c) ** 0.4)} ${F(C + a * Math.sign(s) * Math.abs(s) ** 0.4)}`;
  }
  return `${d}Z`;
};
// The mark, in a 100-unit box: the same geometry as the in-app logo (DispelMark in src/features/shell/nav.tsx).
const MARK = `<path d="M42 17H19V83H48A33 33 0 0 0 75 31.1" fill="none" stroke="#ff6363" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><circle cx="75" cy="31.1" r="10.5" fill="#ffffff"/>`;
function icon({ small }) {
  const m = small ? 16 : 40, s = small ? 9.4 : 6.4, o = C - 50 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <path d="${tile(m)}" fill="#111214"/>
  ${small ? '' : `<path d="${tile(m + 3)}" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="6"/>`}
  <g transform="translate(${F(o)} ${F(o)}) scale(${s})">${MARK}</g>
</svg>
`;
}

writeFileSync(join(HERE, 'app-icon.svg'), icon({ small: false }));
writeFileSync(join(HERE, 'app-icon-small.svg'), icon({ small: true }));

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const icons = join(HERE, 'icons');
execFileSync(npx, ['tauri', 'icon', join(HERE, 'app-icon.svg'), '-o', icons], { stdio: 'inherit', shell: process.platform === 'win32' });
const tmp = mkdtempSync(join(tmpdir(), 'dispel-icon-'));
execFileSync(npx, ['tauri', 'icon', join(HERE, 'app-icon-small.svg'), '-o', tmp], { stdio: 'inherit', shell: process.platform === 'win32' });

// Merge the .ico: entries up to 32px come from the small variant, larger ones from the full icon.
const readIco = (p) => {
  const b = readFileSync(p), n = b.readUInt16LE(4), out = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16, size = b.readUInt32LE(o + 8), off = b.readUInt32LE(o + 12);
    out.push({ w: b[o] || 256, entry: Buffer.from(b.subarray(o, o + 16)), data: b.subarray(off, off + size) });
  }
  return out;
};
const small = readIco(join(tmp, 'icon.ico'));
const pick = readIco(join(icons, 'icon.ico')).map((e) => (e.w <= 32 ? small.find((s) => s.w === e.w) ?? e : e));
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pick.length, 4);
let offset = 6 + pick.length * 16;
const entries = pick.map((e) => { const en = Buffer.from(e.entry); en.writeUInt32LE(e.data.length, 8); en.writeUInt32LE(offset, 12); offset += e.data.length; return en; });
writeFileSync(join(icons, 'icon.ico'), Buffer.concat([head, ...entries, ...pick.map((e) => e.data)]));
for (const f of ['32x32.png', 'Square30x30Logo.png', 'Square44x44Logo.png']) copyFileSync(join(tmp, f), join(icons, f));
rmSync(tmp, { recursive: true, force: true });
console.log('icon.ico sizes:', pick.map((e) => (e.w <= 32 ? `${e.w} (small)` : e.w)).join(', '));
