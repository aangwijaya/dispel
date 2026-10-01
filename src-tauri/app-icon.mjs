// Generates Dispel's app icon set from code.
//   node src-tauri/app-icon.mjs
// app-icon.svg        full icon (48px and up): the Astrolabe seal (tick ring, coral arc and tip) around the brand diamond
// app-icon-small.svg  simplified icon for 16/24/32px: diamond, a thick arc and the tip, no ticks
// Then runs `tauri icon` for both and builds icons/icon.ico with the small variant for 16/24/32px.
import { writeFileSync, readFileSync, copyFileSync, rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const F = (n) => n.toFixed(1), rad = (d) => (d * Math.PI) / 180, C = 512;
const P = (r, a) => [C + r * Math.cos(rad(a)), C + r * Math.sin(rad(a))];
const arc = (r, a0, a1) => { const [x0, y0] = P(r, a0), [x1, y1] = P(r, a1); return `M${F(x0)} ${F(y0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${F(x1)} ${F(y1)}`; };
const TIP = -35;
function icon({ small }) {
  const R = small ? 300 : 262, W = small ? 92 : 46, END = small ? 120 : 118;
  const [tx, ty] = P(R, TIP), [fx, fy] = P(R, END);
  const d = small ? 178 : 128;
  const diamond = `M512 ${512 - d * 1.14} L${512 + d} 512 L512 ${512 + d * 1.14} L${512 - d} 512 Z`;
  const facet = `M512 ${512 - d * 1.14} L${512 + d} 512 L512 512 Z`;
  let marks = '';
  if (!small) {
    marks += `<circle cx="512" cy="512" r="352" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="14"/>`;
    for (let a = 0; a < 360; a += 30) {
      const major = a % 90 === 0, [x1, y1] = P(352, a), [x2, y2] = P(major ? 292 : 318, a);
      marks += `<line x1="${F(x1)}" y1="${F(y1)}" x2="${F(x2)}" y2="${F(y2)}" stroke="#ffffff" stroke-opacity="${major ? .5 : .26}" stroke-width="${major ? 16 : 12}" stroke-linecap="round"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#191b1f"/><stop offset="1" stop-color="#060708"/></linearGradient>
    <radialGradient id="warm" cx=".72" cy=".3" r=".62"><stop offset="0" stop-color="#ff6363" stop-opacity=".18"/><stop offset="1" stop-color="#ff6363" stop-opacity="0"/></radialGradient>
    <linearGradient id="arcG" gradientUnits="userSpaceOnUse" x1="${F(fx)}" y1="${F(fy)}" x2="${F(tx)}" y2="${F(ty)}"><stop offset="0" stop-color="#ffc07a" stop-opacity="${small ? .55 : .2}"/><stop offset=".45" stop-color="#ffc07a"/><stop offset="1" stop-color="#ff6363"/></linearGradient>
    <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a7a"/><stop offset="1" stop-color="#ff4d5e"/></linearGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${small ? 30 : 22}"/></filter>
  </defs>
  <rect x="${small ? 24 : 32}" y="${small ? 24 : 32}" width="${small ? 976 : 960}" height="${small ? 976 : 960}" rx="${small ? 200 : 216}" fill="url(#bg)"/>
  <rect x="${small ? 24 : 32}" y="${small ? 24 : 32}" width="${small ? 976 : 960}" height="${small ? 976 : 960}" rx="${small ? 200 : 216}" fill="url(#warm)"/>
  ${small ? '' : `<rect x="34" y="34" width="956" height="956" rx="214" fill="none" stroke="#ffffff" stroke-opacity=".1" stroke-width="4"/>`}
  ${marks}
  <path d="${arc(R, TIP, END)}" fill="none" stroke="#ff6363" stroke-opacity=".5" stroke-width="${W * 2}" filter="url(#blur)"/>
  <path d="${arc(R, TIP, END)}" fill="none" stroke="url(#arcG)" stroke-width="${W}" stroke-linecap="round"/>
  <path d="${diamond}" fill="url(#gem)"/>
  <path d="${facet}" fill="#ffffff" fill-opacity=".16"/>
  <circle cx="${F(tx)}" cy="${F(ty)}" r="${small ? 80 : 74}" fill="#ff6363" opacity=".55" filter="url(#blur)"/>
  <circle cx="${F(tx)}" cy="${F(ty)}" r="${small ? 62 : 34}" fill="#ffffff"/>
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
