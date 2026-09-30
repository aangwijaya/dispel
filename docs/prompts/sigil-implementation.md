# Prompts: implement the Astrolabe sigil (for opencode)

Paste one phase at a time. Start each in the **Plan** agent (Tab), review the plan, then switch to **Build**.
opencode reads `AGENTS.md` automatically. After each phase, ask Claude Code to review it against the mocks
(see "Review hand-off" at the end).

Sources of truth, in order: `DESIGN.md` (B6 sigil, B7 screens, B8 accents, C3 components) → the mocks
(`design/signin.html`, `design/home.html`, `design/trade.html`, `design/portfolio-activity.html`) → this prompt.

---

## Kickoff prompt (paste first, in Plan mode)

```text
We are moving the app from the Candle Light artwork to the Astrolabe sigil. Design only changes: no logic,
data, RPC or schema changes. Read AGENTS.md, then DESIGN.md sections B2, B6, B7, B8, C3 and the section
"Next implementation: from Candle Light to the sigil". Then open the four mocks in design/ and read their
<script> blocks: the sigil generator lives in design/home.html (the `MOODS` table and `sigil()` function),
the 22px seal in design/trade.html (`seal()`), the allocation dial in design/portfolio-activity.html
(`dial()`), and the sign-in layout in design/signin.html. The mocks are the visual reference: match their
geometry, colours, opacities, sizes and timings exactly. Don't reinterpret them.

## Rules (each comes from a real bug we already hit)
1. @keyframes names must be unique across all CSS and must never be spin, ping, pulse or bounce (Tailwind's
   built-ins). Lightning CSS keeps one @keyframes per name, so a collision silently replaces an animation.
   Prefix new ones, e.g. sigil-in.
2. Class names must not collide with existing ones. Grep before adding a class (e.g. `.sum` is already the
   order-entry estimate box; `.seal`, `.dial`, `.ambient` must be checked too).
3. Every wrapper that holds a sigil SVG needs explicit width/height, and the SVG gets width:100%; height:100%.
   An unsized SVG falls back to 300×150 and the art disappears.
4. Several sigils render on one page: every gradient/filter/pattern id inside an SVG must be unique per
   instance (pass an id prefix, e.g. useId()).
5. The arc and its tip never cross text. The tip sits at −35° (top right) in every state. Remove the
   secondary "risk scale" label from the Market read regime header (MarketReadPanel.tsx) so the tip lands
   in empty space.
6. No sigil behind data. The coloured sigil appears only behind the Market read regime column, under the
   existing scrim, with the existing text halo on regime-column labels.
7. Motion: SMIL <animate>/<animateTransform> inside the SVG ignores CSS `animation: none`. The generator
   takes an `animate` flag; pass false under prefers-reduced-motion AND in lite performance mode
   (src/lib/perf.ts, `data-perf="lite"`).
8. No new runtime dependency. No gradient text (except the existing verdict tint). No glass surfaces.
9. The engine name never appears in the UI (DESIGN C0).

## Architecture
- src/lib/sigil.ts: a pure module ported from the mock's `sigil()`: `sigilSvg(options): string` with
  `{ mood: 'favorable' | 'wait' | 'unclear' | 'reduce-risk', strength: number, idPrefix: string,
  arc?: boolean, hot?: boolean, animate?: boolean, strokeBoost?: number }`. Also `sealSvg(color, odds, id)`
  and `dialSvg(parts, id)`. Map the app's Stance names to the mock's moods (go → favorable, reduce →
  reduce-risk). Keep the mock's numbers: arc length = 40 + 1.2 × strength degrees; seal arc = 40 + 1.6 × odds.
- src/components/Sigil.tsx: renders the string (dangerouslySetInnerHTML is acceptable here: the input is our
  own generated SVG with numbers only, never user data) inside a sized wrapper, with a stable id prefix from
  useId(). A usePrefersReducedMotion + perf-mode check decides `animate`.
- Unit tests (src/lib/sigil.test.ts): arc length per strength, tip coordinates at −35°, each mood's colours,
  rings-only mode has no arc/line/tip, animate:false emits no <animate> or <animateTransform>, two calls with
  different id prefixes share no ids, strokeBoost scales rgba(255,255,255,a) alphas and caps at 1.

## Phases (stop after each for review; keep npm run typecheck, npm test, npm run build green; one commit per phase)
1. Generator + component + tests. No screen changes.
2. Sign in (LoginForm.tsx) per DESIGN B7 and design/signin.html.
3. Home + shell: Market read sigil, ambient rings, welcome banner.
4. Trade: setup seal and the live-price tip.
5. Portfolio + Activity: allocation dial, equity tip ring, Paper cash fragment.
6. Cleanup: remove AURA_ART and the Candle Light assets once nothing imports them; update README/DESIGN
   references if any.

Produce the plan for Phase 1 only now.
```

---

## Phase prompts

**Phase 1 — generator**
```text
Plan approved. Build Phase 1: src/lib/sigil.ts, src/components/Sigil.tsx and src/lib/sigil.test.ts as
planned. Port the generator from design/home.html line for line (anatomy in DESIGN B6: rings, tick ring every
2° with 30°/10°/2° lengths and alphas, dashed/dotted rings, 12 diamond nodes on r 350 with one hot node,
two orbits at ±28°, the hypotrochoid seal, the arc on r 410 with its blurred copy, the tip glow and core,
and the price line whose shape depends on the mood: rises, chops, flat, or falls from above). The unclear
mood wraps everything at 72% opacity with a σ1.1 blur and a dashed arc, and has no hot node. Don't touch any
screen yet.
```

**Phase 2 — Sign in**
```text
Build Phase 2: rebuild LoginForm.tsx to design/signin.html and DESIGN B7 "Sign in". Keep every existing auth
behaviour (Supabase signIn/signUp, validation via src/lib/validation.ts, friendly errors, the email-confirm
notice). Changes:
- Remove the candle art, scrims, glass top bar, glass card, gradient headline, preview card and scrolling tape.
- Centred layout: headline "Markets are full of illusions." (White) / "Dispel them before you trade."
  (Smoke), 44px/400; the sigil (favorable, 1040px) centred on the sign-in box with the radial mask from the
  mock; the box 400px solid rgba(7,8,10,.94), 16px radius, 10% ring, 10px Void halo ring, deep shadow, no blur.
- Google button above email, Google's dark style (#131314 fill, #8e918f inset outline, #e3e3e3 text, the
  four-colour G). It is not wired: clicking shows the inline note "Google sign-in is coming soon. Use email for
  now." Do not add OAuth code.
- "or" divider, fields, Mist "Sign in ↵" button, and a text-link mode switch ("New to Dispel? Create an account"
  / "Already have an account? Sign in") replacing the segmented tabs.
- One row under the box: the market read stance dot, verdict, regime and time (from the existing read hook).
- Five static prices at the bottom in Geist Mono from the existing live tickers (no scrolling).
- Under 720px: headline 30px, sigil 760px, box padding 24/20.
```

**Phase 3 — Home and shell**
```text
Build Phase 3.
- MarketReadPanel: replace the four <img> auras with one Sigil for the current stance (strength from the read),
  760px, centred at 72% / 50% of the panel inside the existing .aura mask and scrim. Update the .aura mask to
  `radial-gradient(ellipse 50% 95% at 72% 50%, #000 45%, transparent 100%)` and the scrim to
  `linear-gradient(90deg, rgba(7,8,10,.96) 0%, rgba(7,8,10,.86) 40%, rgba(7,8,10,.3) 64%, rgba(7,8,10,.12) 100%)`.
  When the stance changes, re-render with a .9s ease-in (from scale .97, −4°) under a unique keyframe name.
  Remove the "risk scale" label.
- Ambient (AppShell): replace the <img className="ambient"> with the rings-only sigil (arc false, hot true,
  strokeBoost 1.9), 1120px, centred on the shell's bottom-left corner (left −560px, bottom −560px), with the
  mask `radial-gradient(closest-side, #000 62%, rgba(0,0,0,.55) 84%, transparent)`, opacity 1, behind
  everything. Make the sidebar background transparent. Hide the ambient below 720px (no sidebar there).
- Welcome banner (Home): dark #0a0b0d with a 9% coral radial on the right, a favorable sigil fragment 460px
  on the right edge (arc and tip inside the banner), headline "Welcome to Dispel." (White) + "Start with the
  read." (Smoke, no gradient), eyebrow and body in Smoke/Ash, keep the steps and "Got it".
```

**Phase 4 — Trade**
```text
Build Phase 4.
- Setup context strip: start it with a 22px sealSvg (coral, the setup's odds) before the SETUP eyebrow. Keep
  the strip on one line: flex-wrap nowrap, the summary span flex 1 1 auto; min-width 0; overflow hidden;
  text-overflow ellipsis; white-space nowrap. Wrap only below 900px. Use a new class name, not `.sum`.
- Live-price tip: the chart is lightweight-charts (canvas), so draw the tip as an absolutely positioned DOM
  overlay above the chart: white core r 2.6, a 1px ring r 6.5 at 35% white, a coral glow r 8–11 breathing
  every 4s (unique keyframe name). Position it from series.priceToCoordinate(lastClose) and
  chart.timeScale().timeToCoordinate(lastBarTime); update it on every candle update, visible-range change and
  resize; hide it when either coordinate is null (bar scrolled off). pointer-events none. Stop the breathing
  under reduced motion and lite mode. Keep `localization: { locale: 'en-US' }` (AGENTS gotcha).
```

**Phase 5 — Portfolio and Activity**
```text
Build Phase 5.
- Portfolio allocation: replace the .stack bar with dialSvg in a 176px wrapper beside the legend
  (grid 176px | 1fr). The dial is a 100-tick ring (every 10th longer, 38%; others 14%), a 9px #1b1c1e track
  at r 70, one arc per holding with 1.2° gaps (categorical palette; cash uses the hatched SVG pattern), the
  cash share in the centre (22px/400 white) with "IN CASH" (Geist Mono 9px Smoke). The legend rows: swatch |
  name with the pair under it | value with the % under it, with explicit grid placement for every cell.
  Keep an aria-label on the dial listing each share.
- EquityChart: add a 1px white ring r 7 at 40% around the existing last point (keep the green pulse).
- Activity: replace the candle crop in the Paper cash panel with a rings-only sigil (hot node, strokeBoost 1.6),
  520px, centred on the panel's bottom-right corner, with a radial mask; nothing over the form or ledger.
```

**Phase 6 — cleanup**
```text
Build Phase 6: remove AURA_ART from src/lib/read/demo.ts and every import of src/assets/dispel-hero.svg and
aura-*.svg; delete those files once nothing imports them (keep design/assets/ untouched; DESIGN.md marks it
retired). Grep for any remaining "Candle", "aura-" or "dispel-hero" references in src/. Final
typecheck/test/build, then summarise every file changed per phase.
```

---

## Review hand-off (for you, to paste to Claude Code after a phase)

```text
Review opencode's Phase N on feat/jev-home against DESIGN.md and the mocks. Compare screenshots of the app
with the mock for that screen, list every mismatch with file:line, then fix the ones that are real.
```
