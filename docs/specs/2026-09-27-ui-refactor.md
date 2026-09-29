# Dispel UI Refactor — Spec

**Date:** 2026-09-27 · **Branch:** `refactor/ui` · **Status:** approved design, pending spec review

## Goal

Rebuild the existing paper-trading terminal UI to the Dispel design system (`DESIGN.md` Parts A/B/C)
using the reference mocks (`design/home.html`, `design/login-trade.html`,
`design/portfolio-activity.html`). Ship it responsive for the Tauri desktop window, web, and iPad, with
full mobile support below 720px.

## Approved decisions

1. **Dark only.** Drop light theme: `.dark` tokens, `@custom-variant dark`, `src/lib/theme.ts`, the
   inline theme script in `index.html`, the TopBar toggle, and the `theme` props it feeds.
2. **Home is UI + labeled demo data.** No market intelligence engine. The read layer is a typed
   interface backed by a deterministic demo dataset; the UI shows a `Demo data` badge while that holds.
3. **Full mobile (<720px).** Bottom tab bar, stacked panels, compact card rows for tables, touch
   targets ≥36px, setups list→detail as two views.
4. **Branch + phase commits.** `refactor/ui`; each phase keeps `npm run typecheck`, `npm test`,
   `npm run build` green.
5. **Data gaps stay labeled.** Historical equity and 7-day allocation series do not exist in the DB.
   Current portfolio figures stay real; the curve/history uses a labeled demo series.

## Non-goals

- No market read/regime/setup computation, no new RPCs, no schema changes.
- No router, no global state library (keep `AppShell` conditional rendering and existing hooks).
- No new runtime dependency except `@fontsource-variable/geist-mono`.
- No light-theme design work. No real custody/signing anything (unchanged).

## Architecture

### Foundation
- `src/index.css`: Part B4 tokens on `:root` (`--void`, `--card`, `--recessed`, `--badge`, `--slate`,
  `--border`, `--hair`, `--white`, `--mist`, `--ash`, `--smoke`, `--iron`, `--coral`, `--ember`,
  `--up`, `--down`, `--caution`, `--info`, `--key`, `--key-soft`, `--lift`, type/radius tokens) mapped
  through `@theme inline`. `color-scheme: dark`. Font vars: `--font-sans` (Inter Variable),
  `--font-mono` (Geist Mono Variable).
- `index.html`: remove theme script; `class="dark"` no longer used.
- Assets: copy `design/assets/dispel-hero.svg`, `aura-wait.svg`, `aura-unclear.svg`,
  `aura-riskoff.svg` to `src/assets/` and import through Vite.
- `src-tauri/tauri.conf.json`: window background `#040506`, `minWidth` 720, `minHeight` 600.

### Shell and responsive frame
- `Page = 'home' | 'trade' | 'portfolio' | 'activity'`; default `home`.
- `Sidebar` 188px: coral diamond + "Dispel" 13/500, 32px nav rows, active row Recessed +
  `--key-soft`, Graphite count badge on Home, paper-account block at the bottom.
- `TopBar` 48px: page title 14/500, `Live` badge (Graphite, green dot), `Demo data` badge (caution
  outline) while read data is demo, account email + sign out.
- `<720px`: sidebar hidden, bottom tab bar (Home/Trade/Portfolio/Activity, safe-area padding).
- `<main>` is a `@container`; Home/Trade use container-query breakpoints from DESIGN C2/B7.

### Read layer (demo)
- `src/types/read.ts`: `Stance`, `MarketRead`, `Regime`, `Stat`, `Evidence`, `Setup`, `ChangeEvent`
  (single source; no duplicate domain types).
- `src/lib/read/demo.ts`: deterministic dataset. Default favorable stance; all four stances
  (`favorable | wait | unclear | reduce-risk`) expressible so every code path is buildable;
  `setupForSymbol(symbol)` feeds the Trade context strip and chart levels.
- Demo labeling: `Demo data` badge in TopBar; Home offline rule still replaces the verdict with
  "Live data needed for a market read" when the market stream is disconnected.
- Naming: "JEV" never appears in UI, code comments shown to users, or copy (DESIGN C0).

### Screens
- **Home (new, `src/features/home/`)**: MarketReadPanel (aura + live border + verdict 40/400 + stance
  line + explanation + caution well + regime column + stats row + "Why this read" wells), SetupsPanel
  (list/detail, odds bar texture=confidence, wait state, Reduce-risk → Exposure check), ChangesPanel
  (first-launch explained vs returning diff), Floor (watchlist + Read tag, demo breadth, real paper
  account), Welcome ember banner (first launch, localStorage), meta strip. Keyboard: ↑↓, ↵, E.
- **Sign in**: Candle Light hero full-bleed + scrims, glass top bar, pitch + preview read card, live
  price tape from `subscribeMarket`, glass auth card 400px (Sign in/Create tabs, show/hide password,
  coral focus halo, tinted error box), stack below 1080.
- **Trade**: five panels 92% + ambient aura; MarketHeader; setup context strip (demo, hideable);
  Markets 236px (search `/`, Watch|All, read dot); chart restyle (up/down, dashed levels, last-price
  tag, OHLC readout, mono axis, volume 28% bottom 16%); OrderEntry (chromatic Buy/Sell only,
  Mkt/Limit underline tabs, unit inside field, % chips, estimate well, kbd B/S); Book|Trades tabs;
  bottom Positions|Open orders|History; meta strip. `<1240` market list hides (search stays with `/`);
  `<900` ticket stacks under chart; mobile order chart → ticket → book.
- **Portfolio**: equity panel (current equity real; curve vs net-deposited demo, deposit dots from
  real ledger, range tabs), key-figure column from real cash/positions/orders, positions with Read
  tag + cushion bar (levels demo), "Worth knowing" real facts, allocation (current real, 7-day demo),
  closed trades + open orders real.
- **Activity**: paper cash + move funds (existing RPC), asset tiles, `AddressDisplay` first/last-4
  rule (exists), network chips, review strip, amber public-address well, ledger grouped by day with
  net + direction badges + 1.6s flash, filters (All|In|Out, All assets|Cash|Crypto), and a new
  client-side **key guard**: 12/24 words or a 64-hex string clears the field, is never stored, and
  shows the rose danger block (validation helper + caller).

### Shared primitives
Add only what is reused twice or more: `Panel`, `Kbd`, `Monogram`, `OddsBar`, `CushionBar`, `MetaStrip`
placed in `src/components/`. Existing `AddressDisplay`, `PriceChange` restyled in place.

## Phases

| # | Phase | Contents |
|---|---|---|
| 1 | Foundation | tokens, fonts, assets, dark-only cleanup, tauri.conf, BootScreen |
| 2 | Shell | Sidebar/TopBar/bottom nav, Page type + default home, responsive frame |
| 3 | Read layer + Sign in | read types, demo dataset, LoginForm rebuild, hero, price tape, preview read |
| 4 | Home | Home components, welcome, keyboard |
| 5 | Trade | panels, header, context strip, markets, chart, order entry, book/trades, bottom |
| 6 | Portfolio | equity panel, key figures, positions, allocation, trades/orders |
| 7 | Activity | cash panel, move funds, ledger, key guard |
| 8 | QA + docs | responsive QA, tests, README |

Each phase ends with `npm run typecheck && npm test && npm run build`.

## Verification

- Unit: keep existing suites; add key-guard cases and demo-read invariants (stance vocabulary, odds
  texture mapping, level ordering).
- Responsive QA via browser automation at 1440 (desktop), 1024 (iPad landscape), 820 (iPad portrait),
  390 (mobile): screenshot each screen, check no horizontal scroll, nav reachable, kbd hints real.
- Manual Tauri pass: window opens, narrow window (720) renders the compact shell.
- README updated for dark-only, Home, and mobile.

## Risks

- WebKitGTK/software rendering in WSL can distort visual QA; screenshots come from the browser
  (Chromium) path.
- `lightweight-charts` v5 API details for dashed price lines and axis fonts; falls back to styled
  defaults if a feature is missing.
- Demo data must not read as advice: copy follows DESIGN C4 voice, odds are labeled estimates.
