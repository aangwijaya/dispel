# Sigil — Phase 1: generator + komponen + tes (approved)

Source prompt: `docs/prompts/sigil-implementation.md` (kickoff + Phase 1).
Scope: `src/lib/sigil.ts`, `src/components/Sigil.tsx`, `src/lib/sigil.test.ts`, plus tiny edits to
`src/lib/perf.ts` (`isLiteMode()`) and `src/index.css` (`.sigil` sizing). No screen changes, no new deps.

## Porting rules (from the prompt)

1. `@keyframes` names unique; never `spin`/`ping`/`pulse`/`bounce`. Phase 1 emits no CSS keyframes.
2. Check class collisions: `.sum` is taken (trade.css); `.sigil` is free; `.ambient`/`.seal`/`.dial`
   are not used yet.
3. Sigil wrappers must set explicit width/height; `svg { width:100%; height:100% }`.
4. Every SVG def id unique per instance via `idPrefix` (component passes `useId()` sanitized).
5. Tip at `-35°` always. No text crossing.
6. No sigil behind data (later phases).
7. SMIL ignores CSS `animation:none`: generator takes `animate`; component passes false under
   reduced motion or `data-perf="lite"`.
8. No new dependency; no gradient text; no glass.
9. Engine name never in UI.

## `src/lib/sigil.ts`

- `export type SigilMood = 'favorable' | 'wait' | 'unclear' | 'reduce-risk'`
- `export const SIGIL_TIP_ANGLE = -35`
- `MOODS`: favorable `#ffc07a → #ff6363`, spin 300s, pulse 4s, line up · wait `#ffe0a3 → #e8b04a`,
  360s, 6s, chop · unclear `#6a6b6c → #9c9c9d`, 600s, no pulse, flat, fog · reduce-risk
  `#ff9aab → #f0506e`, 150s, 2.4s, down.
- `arcAngles(strength)`: from −35°, to = −35 + 40 + 1.2 × clamp(strength, 0, 100).
- `sigilSvg({ mood, strength?, idPrefix, arc?, hot?, animate?, strokeBoost? })`:
  - viewBox `-520 -520 1040 1040`.
  - ticks every 2° (30° → 22px/38%, 10° → 13px/20%, else 6px/11%) with SMIL spin `mood.spin`.
  - rings r470 14%, r440 dash `2 7` 7%, r410 5%, r350 8%, r290 dash `1 5` 5%.
  - 12 diamond nodes r350 (`i*30+15`, 5px, `#040506` fill, 34% stroke); hot node `i===10`,
    colour `a1`, when `!fog && (arc !== false || hot)`; SMIL counter-spin `spin*0.66`, dir −1.
  - orbits 330×118 at ±28° 6%; hypotrochoid star scale 36, stroke 7.5%.
  - arc r410, 1.6 round-cap, gradient `#id a` (transparent → 70% a0 at 40% → a1), blurred 5px copy
    σ6 at 40%; unclear dashed `5 7`.
  - price polyline x −500→tip step 3 with smoothstep and per-mood shape (up/chop/flat/down).
  - tip core r3 `#fff`, glow r9 `a1` .4 blur σ6, SMIL opacity `.2;.55;.2` dur `pulse` (anim only).
  - unclear: wrap body in `opacity .72` + σ1.1 blur with id `#id f`.
  - `strokeBoost` scales every `rgba(255,255,255,a)` × boost, cap 1, 3 decimals.
- `sealSvg(color, odds, idPrefix = 'seal')`: viewBox `-12 -12 24 24`, ring r10.5 (.22), 12 ticks
  every 30° (.35), track r6.6 (.1), arc `40 + 1.6 × clamp(odds,0,100)` from −35° (1.4 round),
  white core r1.6; `data-sigil={idPrefix}` on root.
- `dialSvg(parts, idPrefix)`: viewBox `-100 -100 200 200`, 100 ticks every 3.6° from −90°
  (every 10th 38%, else 14%), track r70 stroke 9 `#1b1c1e`, one arc per part with 1.2° gaps
  (cash uses `url(#${idPrefix}hatch)`), dashed r56, centre `${cashShare}%` 22px/400 white and
  `IN CASH` mono 9px.

## `src/components/Sigil.tsx`

- Props `{ mood, size, strength?, arc?, hot?, strokeBoost?, className? }`.
- `idPrefix = 'sigil-' + useId().replace(/[^a-zA-Z0-9_-]/g, '')`.
- `usePrefersReducedMotion()` local hook (`matchMedia` + change listener).
- `animate = !reduced && !isLiteMode()`; `useMemo` on the generated SVG string.
- `<span className="sigil" style={{ width: size, height: size }} aria-hidden="true"
  dangerouslySetInnerHTML={{ __html: html }} />`.

## `src/lib/perf.ts`

- Add `isLiteMode(): boolean` reading `document.documentElement.dataset.perf === 'lite'` (try/catch).

## `src/index.css`

```css
.sigil { display: block; flex: none; }
.sigil > svg { display: block; width: 100%; height: 100%; }
```

## `src/lib/sigil.test.ts`

- arcAngles: 0 → 40°, 71 → 125.2°, 150 clamps to 100 → 160°.
- tip at −35°: core `cx≈335.9 cy≈−235.2`.
- mood colours for all four moods; unclear has fog blur, dash `5 7`, no hot node.
- rings-only (`arc:false`): no `A410 410`, no `url(#`, no `r="9"`, no `r="3"`.
- `animate:false` → no `<animate`/`<animateTransform>`; `animate:true` favorable → both present.
- two prefixes share no `id="…"`; all ids start with their prefix.
- `strokeBoost:1.9` → `.14` becomes `.266`; `strokeBoost:10` caps at `1.000`.
- `sealSvg`: arc length per odds, 12 ticks, tip at −35°, `data-sigil`.
- `dialSvg`: one arc per part, unique hatch id per prefix, cash text correct.

## Verification

`npm run typecheck`, `npm test`, `npm run build` green. One commit on `feat/jev-home`
(`feat: add Astrolabe sigil generator and component`), no screen changes.
