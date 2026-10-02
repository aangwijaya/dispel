# Dispel — Design System

> Midnight command center for markets: a dark, quiet terminal where the market read comes first.
>
> **Dispel: a spell that clears illusion.** Markets are full of illusions; Dispel clears them with measurement
> before anyone trades. The brand artwork is that idea drawn as an instrument: the Astrolabe sigil (B6).

**Theme:** dark only · **Density:** compact terminal (Raycast app density, not Raycast marketing density) · **Platform:** Tauri desktop

This file has three parts:

- **Part A — Foundation.** The Raycast style reference, copied in full as the visual source of truth.
- **Part B — Dispel adaptation.** How the foundation is applied to a desktop trading terminal, and where it is
  deliberately overridden.
- **Part C — Market intelligence layer.** Components for the market read, setups and changes. The engine is
  internally named **JEV**. That name is **never shown in the UI**.

Reference mocks (all values are mock design data):
- [`design/home.html`](design/home.html): Home (market read, setups, changes)
- [`design/signin.html`](design/signin.html): Sign in
- [`design/trade.html`](design/trade.html): Trade
- [`design/portfolio-activity.html`](design/portfolio-activity.html): Portfolio + Activity
- [`design/home-sigil-clarity.html`](design/home-sigil-clarity.html): Home sigil before and after `crisp` (real app
  CSS and markup)
- The Astrolabe sigil is generated in code from data (see B6). There are no image files for it.
- [`design/assets/`](design/assets/): the **retired** Candle Light artwork (`dispel-hero.svg`, `aura-*.svg`,
  `generate-hero.mjs`). Kept as reference only; the app draws the sigil in code and ships no image files.

Precedence: Part C → Part B → Part A. A later part overrides an earlier one where they conflict.

---

# Part A — Foundation: Raycast style reference

**Name:** Raycast · **Tagline:** Midnight command center, coral neon · **Theme:** Dark · **Source:** https://raycast.com

Raycast reads as a dark power-tool cockpit: an almost-black canvas (#040506) with barely-visible elevation
steps, a single warm coral accent (#ff6363) that carries brand identity, and quiet white/gray typography in Inter.

## Tokens — Colors

### Brand
| Name | Value | Role |
|---|---|---|
| Coral Pulse | `#ff6363` | Logo diamond, AI badge fill, hero artwork saturation |
| Ember Hush | `#452324` | Warm-tinted card backgrounds, accent surface tints |

### Accent
| Name | Value | Role |
|---|---|---|
| Electric Sky | `#63a1ff` | Hero illustration mid-tone, decorative gradient |
| Cobalt Edge | `#143ca3` | Hero illustration stroke, deep gradient anchor |
| Deep Space | `#02193b` | Hero illustration fill, darkest blue in artwork |
| Info Blue | `#56c2ff` | Blue wash for highlight backgrounds |
| Success Green | `#59d499` | Green wash for highlight backgrounds |

### Neutrals
| Name | Value | Role |
|---|---|---|
| Void Black | `#040506` | Page canvas, dominant background |
| Ink | `#07080a` | Card surfaces, elevated panels |
| Obsidian | `#111214` | Pressed states, input wells |
| Graphite | `#1b1c1e` | Neutral form states, badge text |
| Slate | `#2f3031` | Dark button borders and labels |
| Smoke | `#6a6b6c` | Secondary body text, muted labels |
| Iron | `#454647` | Button text on light fills |
| Ash | `#9c9c9d` | Light text on dark surfaces |
| Mist | `#e6e6e6` | Light neutral action fill |
| Pure White | `#ffffff` | Headings, high-emphasis text |
| Border | `#363739` | Nav and card borders |

## Tokens — Typography

**Inter**: primary interface typeface. Weights 400, 500, 600. Sizes 11–64px. Line height 0.91–1.71. Letter
spacing 0.004–0.073px. Fallback `system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif`. Inter's neutral
geometry carries the developer-tool seriousness. Weight 400 for a 56px hero headline is an anti-convention choice.

**GeistMono**: monospace for technical labels. Weights 300, 400, 500. Sizes 10, 12, 14px. Line height
1.00–1.60. Letter spacing 0.017em at 12px, 0.05em at 10px. Fallback `'JetBrains Mono', Menlo, Monaco, Courier, monospace`.

**SF Pro Text**: icon glyphs and numeric callouts. Weights 500, 700. Sizes 16, 24, 32px. Line height 1.15.

**SF Pro**: system font. Weight 700, 13px, line height 1.23.

### Type scale
| Role | Size | Line height | Letter spacing |
|---|---|---|---|
| eyebrow | 11px | 0.91 | 0.8px |
| body | 16px | 1.15 | 0 |
| body-lg | 18px | 1.15 | 0 |
| subheading | 20px | 1.2 | 0.2px |
| heading-sm | 24px | 1.15 | 0 |
| heading | 32px | 1.15 | 0 |
| heading-lg | 56px | 1.17 | 0.22px |
| display | 64px | 1.1 | 0 |

## Tokens — Spacing & Shapes

Base unit 8px · Density comfortable · Max width 1200px · Section gap 80–120px · Card padding 24px · Element gap 8–16px

Spacing scale: 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 120, 224px

| Element | Radius |
|---|---|
| badges | 6px |
| inputs | 8px |
| buttons | 8px |
| cards | 16px |
| largeCards | 20px |
| pills | 9999px |
| iconContainers | 99999px |

### Shadows
| Name | Value |
|---|---|
| subtle-3 (Key treatment) | `rgba(255,255,255,0.05) 0 1px 0 0 inset, rgba(255,255,255,0.25) 0 0 0 1px, rgba(0,0,0,0.2) 0 -1px 0 0 inset` |
| subtle-4 (Download button) | `rgba(0,0,0,0.03) 0 7px 3px 0, rgba(0,0,0,0.25) 0 4px 4px 0` |
| sm | `rgba(0,0,0,0.25) 0 4px 4px 0` |

## Components

- **Glass Navigation Bar.** A floating pill-shaped bar with `backdrop-blur(48px)`, a 1px solid `#363739` border
  and 8px radius. Logo on the left (red diamond + "Raycast" wordmark in white, 13px/500). Nav links are centred,
  13–14px, in Ash. A light-grey Download button sits on the right (Mist fill, Iron text, 8px radius, 8px 12px padding).
- **Neutral Filled Button.** Mist `#e6e6e6` fill, Iron `#454647` text at 13–14px/500, 8px radius, 8px 12px padding.
  It may carry a 15px icon. It is deliberately neutral rather than chromatic, letting the dark page do the contrasting.
- **Ghost Nav Link.** Transparent background, Ash text at 13–14px, no border. Turns Pure White on hover. 0px radius.
- **Feature Card with Key Shadow.** 16px radius, 24px padding, with the "keyboard key" shadow stack. This creates
  a pressed, tactile surface. It reads as a recessed key cap, not a floating card.
- **Edge-Highlight Card.** 16–20px radius, transparent fill, 1px solid `#363739` border plus the inset highlight stack.
- **Inset Input Field.** 8px radius, `rgba(255,255,255,0.05)` fill, 8px 12px padding, Pure White text at 16px/400,
  placeholder in Ash.
- **Badge Tag.** Graphite `#1b1c1e` fill, Pure White text, 6px radius, 0 6px padding.
- **Circular Icon Container.** 99999px radius, 20px padding, subtle dark fill, holding a 24–32px glyph.
- **Hero Gradient Banner.** A full-bleed radial gradient from `rgba(4,63,150,0.7)` to `rgba(6,18,37,0.25)` with
  diagonal coral shapes (40px+ blur). This is the one place the system breaks its own rules.
- **Footer Meta Strip.** A centred row of Geist Mono 12px/400 in Ash, separated by vertical pipes.
- **App Window Mockup.** 12px outer radius, 16px command bar, 8px result items, the key inner shadow stack. Pure
  White text on `#07080a` with a single Coral highlight on the active row.

## Do's and Don'ts

### Do
- Use `#040506` as the only page background.
- Reserve `#ff6363` for the logo, hero artwork, AI badge and warm-tinted surfaces.
- Use the "keyboard key" inner shadow stack on elevated cards.
- Set hero headlines at 56px/400 in Inter with +0.22px tracking.
- Use Mist filled buttons with Iron text for primary actions. There is no chromatic CTA.
- Use 8px radius for buttons, inputs and badges, 16–20px for cards, 9999px for pills and 99999px for circular icons.
- Put footer metadata in Geist Mono 12px, separated by vertical pipes.

### Don't
- Don't use chromatic action buttons.
- Don't add drop shadows to cards or panels. Elevation comes from the inset key stack.
- Don't use negative letter-spacing on large display text.
- Don't introduce light-theme sections.
- Don't use `#ff6363` for body text, links or general icons.
- Don't use multiple accent colours on the same surface.
- Don't use SF Pro Text for body copy.
- Don't break the 8px spacing grid.

## Surfaces
| Level | Name | Value | Purpose |
|---|---|---|---|
| 0 | Canvas | `#040506` | Default background |
| 1 | Card | `#07080a` | Elevated content blocks |
| 2 | Recessed | `#111214` | Inputs, pressed or inset wells |
| 3 | Badge | `#1b1c1e` | Dense tag surfaces, monogram tiles |
| 4 | Accent Tint | `#452324` | Warm coral-tinted brand backdrop |

## Imagery
Hero: abstract red/blue geometric shapes (diagonal bars, radial glows), like a motion-graphics title sequence.
Below the hero: in-context product screenshots. No photography. Icons are 16–24px system glyphs in Mist.

## Layout
Max width about 1200px, a full-bleed hero, a floating glass nav, 80–120px section rhythm, 3- or 2-column card
grids, dark-on-dark bands with hairline dividers, no sidebar.

## What to learn
Neutral dark controls sit apart from the saturated hero artwork. Small highlights and key-like details make
controls feel tactile. Use clear shortcut labels where a shortcut exists. **A keyboard-shaped badge does not
create keyboard support:** implement focus order and shortcuts before advertising them.

---

# Part B — Dispel adaptation

## B1. What carries over unchanged
Void canvas and the surface steps (Void → Ink → Obsidian → Graphite); Inter + Geist Mono; Mist primary buttons
with Iron text; 6/8/12/16px radii; the key inset stack; coral as brand only; positive tracking on large text;
Geist Mono pipe-separated meta strips; circular icon containers.

## B2. Deliberate overrides

| Raycast | Dispel | Why |
|---|---|---|
| Body 16px, section gap 80–120px, density "comfortable" | Body 13px, rows 12–14px, panel gap **8px** | A terminal is scanned for hours. Marketing density wastes the screen. |
| Hero 56–64px | Largest in-app text is the **market verdict at 40px/400, +0.2px** | There is one large element per screen, and it's the answer. |
| Key ring at 25% white on every card | **`--key-soft`** (8% ring) on large panels. The full `--key` (25%) only on small interactive keys: kbd, selected rows, segmented controls | Six bright outlines on one screen reads as card soup. |
| Cards 16px radius | App panels **12px** (the "app window" radius), rows and controls **8px**, note cards 16px | Matches Raycast's own in-app window rather than its website cards. |
| No sell/loss colour | **Down `#f0506e`** (crimson-rose) | Trading needs red. It is shifted away from coral and always paired with a sign (−, ▼). |
| No caution colour | **Caution `#e8b04a`** | Needed for the "Wait" stance, risk and volatility warnings. |
| Smoke `#6a6b6c` for secondary body text | Smoke only for **repeated/redundant labels ≥11px**. Anything the user must read is Ash or brighter | Smoke is about 3.9:1 on `#07080a`, which fails for small essential text. |
| Glass floating nav, no sidebar | **Sidebar** (188px, transparent) + 48px top bar. **No glass surfaces anywhere**, Sign-in included. The only blur is the frosted stats row over the Home sigil | A desktop app with persistent sections needs a sidebar. Glass reads as generic and costs GPU in WebView2. |
| Hero gradient banner (Raycast's diagonal bars, coral glows) | Replaced by Dispel's own **Astrolabe sigil** (B6): hairline rings, ticks and one coral arc. No gradient hero, no gradient text | Gives Dispel an identity that comes from its name instead of borrowing Raycast's. |
| SF Pro Text / SF Pro | Not used | Not available on Windows or Linux WebView. Inter covers numerics with `tabular-nums`. |

## B3. Theme
**Dark only** (decided 2026-09-27 in `docs/specs/2026-09-27-ui-refactor.md`). There is no light theme and no
toggle.

## B4. Tokens (app)

```css
:root {
  color-scheme: dark;
  /* surfaces */
  --void: #040506;      /* canvas */
  --card: #07080a;      /* panels */
  --recessed: #111214;  /* wells, selected rows, hover */
  --badge: #1b1c1e;     /* keys, tags, empty meter tracks */
  --slate: #2f3031;     /* separators inside controls */
  --border: #363739;    /* explicit borders (rare) */
  --hair: rgba(255,255,255,.06); /* dividers inside panels */
  /* text */
  --white: #ffffff;     /* headings, key figures */
  --mist: #e6e6e6;      /* emphasised body, primary fill */
  --ash: #9c9c9d;       /* body */
  --smoke: #6a6b6c;     /* redundant labels only */
  --iron: #454647;      /* text on Mist */
  /* brand */
  --coral: #ff6363;     /* brand: the logo mark, sigil arc/tip/hot node, live-border tip */
  --ember: #452324;     /* reserved; no longer used by the welcome banner */
  /* semantic */
  --up: #59d499;
  --down: #f0506e;
  --caution: #e8b04a;
  --info: #56c2ff;      /* reserved; not used on Home */
  /* elevation */
  --key: rgba(255,255,255,.05) 0 1px 0 0 inset, rgba(255,255,255,.25) 0 0 0 1px, rgba(0,0,0,.2) 0 -1px 0 0 inset;
  --key-soft: rgba(255,255,255,.05) 0 1px 0 0 inset, rgba(255,255,255,.08) 0 0 0 1px, rgba(0,0,0,.2) 0 -1px 0 0 inset;
  --lift: rgba(0,0,0,.03) 0 7px 3px 0, rgba(0,0,0,.25) 0 4px 4px 0; /* Mist buttons, toasts */
  /* type */
  --font-sans: 'Inter Variable', Inter, system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', Menlo, Consolas, monospace;
  --text-eyebrow: 11px;  /* uppercase, +0.8px, 500 */
  --text-meta: 12px;
  --text-body: 13px;
  --text-row: 14px;      /* list titles, panel titles */
  --text-lead: 15px;     /* stance line, key values */
  --text-sub: 20px;      /* 400, +0.2px */
  --text-verdict: 40px;  /* 400, +0.2px, one per screen */
  /* radius */
  --radius-badge: 6px; --radius-ctl: 8px; --radius-panel: 12px; --radius-card: 16px;
}
```
Bundle Inter and Geist Mono locally for Tauri. Don't load them from a CDN.

## B5. Components (app)

- **App shell:** the sidebar sits on Void with a hairline right edge. Nav rows are 32px, 8px radius. The active
  row has a Recessed fill, `--key-soft` and white text. A Graphite count badge in Geist Mono shows changes since
  the last visit. The logo is the mark (16px) + "Dispel" 13px/500.
- **Logo mark:** an open D drawn by the spell. A coral stroke (14 on a 100 grid, round caps and joins) runs from
  the top bar down the stem and round the bowl, and stops at the sigil's tip angle (−35°) in a white terminal
  (r 10.5). The open top-right is the point: the arc is still being cast. One geometry everywhere: `DispelMark`
  in the app, and `src-tauri/app-icon.mjs` for the app icon (the mark on a flat `#111214` superellipse tile, no
  glow or gradient). On a light background the terminal turns Void (`#040506`). Never a diamond or rotated
  square: that shape belongs to other brands.
- **Top bar:** 48px, page title 14px/500, a `Live` badge (Graphite, 6px radius, green dot), a "Mock data" /
  environment badge (caution outline), account.
- **Panel:** Card fill, 12px radius, `--key-soft`, 8px apart on Void. Internal columns are divided by `--hair`.
  **No more than three or four panels per screen.**
- **List row (command-palette style):** 8px radius, Recessed on hover. The selected row gets Recessed +
  `--key-soft`. A 30px circular icon container holds the ticker monogram. Rows support ↑/↓ and ↵.
- **Primary button:** Mist/Iron, 8px radius, 32px high, `--lift`, with a kbd hint. **Secondary:** Graphite fill,
  Mist text, `--key-soft`. **Ghost:** Ash text, Recessed on hover.
- **Keycap (`kbd`):** 18px, Graphite, `--key-soft`, Geist Mono 10px. Only for shortcuts that are really implemented.
- **Segmented control / tabs:** Recessed track, selected segment Graphite + `--key-soft`.
- **Meta strip (footer):** Geist Mono 11px Smoke, pipe-separated (data source · read time · next read · mode),
  with the keyboard hints on the right.
- **Tables:** 10.5px headers in Smoke, 12px tabular cells in Ash, figures that matter in White. Rows get an
  8px-radius hover, never zebra stripes.
- **Buy/Sell buttons** in the order ticket are the only chromatic fills in the app (Up/Down at full strength).

## B6. Artwork: the Astrolabe sigil

**Philosophy.** *Dispel* is a spell that clears illusion, and Dispel does it by measuring. The artwork is a sigil
built like a scientific instrument (an astrolabe): graduated rings, orbits, diamond nodes and **one coral arc,
the spell**, whose tip glows where it touches the market. It is hairline and quiet enough to live behind a
sign-in form or a terminal, and it carries the brand without cartoons, candles or gradients.

### Anatomy (viewBox `-520 -520 1040 1040`, all strokes 1px unless noted)

| Part | Spec |
|---|---|
| Outer ring | r 470, white 14% |
| Tick ring | every 2° at r 470 inward: major (30°) 22px at 38%, mid (10°) 13px at 20%, minor 6px at 11%. Turns slowly |
| Rings | r 440 dashed `2 7` at 7% · r 410 at 5% (the arc's track) · r 350 at 8% · r 290 dotted `1 5` at 5% |
| Diamond nodes | 12 on r 350 (every 30°, offset 15°), 5px, void fill, 34% stroke. One "hot" node takes the arc colour. Counter-rotates |
| Orbits | two ellipses 330 × 118 rotated ±28°, 6% |
| Seal | a hypotrochoid star at the centre, 7.5% (usually hidden behind content) |
| **Arc (the spell)** | on r 410, from the tip clockwise. 1.6px round-capped, plus a 5px copy blurred σ6 at 40%. Gradient from the far end (transparent) to the tip |
| **Tip** | at −35° (top right): white core r 3, arc-coloured glow r 9 blurred σ6 that breathes (opacity .2 → .55) |
| **Price line** | 1.3px from x −500 into the tip, gradient white 0 → 20% → arc colour. It is the only trading reference in the art |

### Readings: the sigil encodes the market read (Home)

| Stance | Arc colour (far → tip) | Price line into the tip | Tick ring turn | Tip breath | Other |
|---|---|---|---|---|---|
| Favorable | `#ffc07a` → `#ff6363` | rises from the lower left | 300s | 4s | — |
| Wait | `#ffe0a3` → `#e8b04a` | chops sideways | 360s | 6s | — |
| Unclear | `#6a6b6c` → `#9c9c9d`, dashed `5 7` | lies flat | 600s | none | whole sigil at 72% with a σ1.1 fog blur (a crisp sigil fogs only the arc, line and tip); no hot node |
| Reduce risk | `#ff9aab` → `#f0506e` | falls from above | 150s | 2.4s | — |

**Arc length = 40° + 1.2° × trend strength.** The nodes counter-rotate at ⅔ of the tick ring's period. The
sigil never shows anything the read doesn't say.

### Instances

| Where | Form | Spec |
|---|---|---|
| **Sign-in** | Full sigil, favorable reading | 1040px, centred on the sign-in box, radial mask `#000 42% → 55% at 72% → transparent`. Arc on the right side, clear of all text. Tick ring 300s, nodes 200s |
| **Home › Market read** | Full sigil, live reading | 760px, centred at 72% / 50% of the panel, under the left-to-right scrim. Regime-column labels carry the dark halo. On stance change it re-renders with a .9s ease-in (from 97% scale, −4°). Drawn **crisp**: at 760px the viewBox would thin every hairline to 0.73px, so hairlines stay 1 screen px (`vector-effect: non-scaling-stroke`), nodes are 10px and stay upright while they orbit, and stroke alphas are ×1.6 |
| **Ambient** (Home, Trade, Portfolio, Activity) | Rings, ticks, nodes and one coral hot node; no arc, no line | 1120px, centred on the window's bottom-left corner (`left −560px`, `top` = window height − 560px), so it rises behind the **transparent sidebar**. Stroke alphas ×1.9, mask `#000 62% → 55% at 84% → transparent`. Panels are 92% opaque, so it never shows behind data |
| **Welcome banner** | Favorable fragment | 460px, right edge, arc and tip inside the banner |
| **Trade › setup seal** | 22px seal | Ring, 12 ticks, a coral arc of 40° + 1.6° × odds, a white tip. Opens the setup strip |
| **Trade › live price** | The tip on the chart | White core r 2.6, ring r 6.5 at 35%, coral glow r 8–11 breathing every 4s |
| **Portfolio › allocation dial** | The instrument as a scale | 176px. Tick ring of 100 (every 10% longer, 38%), a 9px Graphite track at r 70, one arc per holding in the categorical palette (cash hatched), centre: cash share (22px/400) + `IN CASH` (Geist Mono 9px) |
| **Portfolio › equity tip** | The tip, in gain colour | Green pulse + a white ring r 7 at 40% |
| **Activity › Paper cash** | Rings fragment | Rings only + hot node, centred on the panel's bottom-right corner, 520px, alphas ×1.6 |

### Rules
- **Generated, not drawn.** One generator (`sigil({ mood, strength, arc, hot, … })`) outputs SVG from data. No
  image files per state; everything stays sharp at any size.
- **Never behind data.** Only the Market read panel carries a coloured sigil, behind the regime column under a
  scrim. Elsewhere it sits in the sidebar, in panel corners without data, or is a data-carrying form itself
  (seal, dial).
- **The arc and tip never cross text.** Place the tip in empty space. If a layout can't guarantee that, drop
  the arc and use rings only.
- **One coloured arc per screen.** Coral belongs to the logo, the arc, the tip, the hot node and the live-border
  tip.
- **Slow motion only**: rotations 150–600s per turn, tip breath 2.4–6s. Everything stops under
  `prefers-reduced-motion` and in the lite performance mode.

## B7. Screens

### Sign in
```
┌ ◆ Dispel ·········································· ● Markets live · v0.1.0 ┐
│                                                                            │
│                  Markets are full of illusions.        (44/400, White)      │
│                  Dispel them before you trade.         (44/400, Smoke)      │
│        · · · Astrolabe sigil, centred on the box, dissolving to Void · · ·  │
│                     ┌ Sign in to Dispel ─────────────┐                      │
│                     │ Paper trading with live prices │                      │
│                     │ [ G  Continue with Google ]    │                      │
│                     │ ─────────── or ───────────     │                      │
│                     │ Email · Password (Show)        │                      │
│                     │ [ Sign in ↵ ]            Mist  │                      │
│                     │ New to Dispel? Create account  │                      │
│                     └────────────────────────────────┘                      │
│             ● Look for setups · Constructive market · Today 14:32 UTC       │
│   BTC 83,560.00 +1.12%   ETH 2,693.00 +0.84%   …   (static, Geist Mono)     │
```
- **Headline**: "Markets are full of illusions." (White) / "Dispel them before you trade." (Smoke), 44px/400,
  +0.2px, centred. The brand name is the verb, the market is the subject, trading is the payoff. No gradient text.
- **Box**: 400px, solid `rgba(7,8,10,.94)`, 16px radius, 10% ring, a 10px Void halo ring and a deep drop shadow.
  **No glass.** Padding 32px.
- **Google**: first, above email. Google's dark button: `#131314` fill, `#8e918f` inset outline, `#e3e3e3` 14px/500
  text, the four-colour G at 18px, label "Continue with Google", 44px. Wired through Supabase
  `signInWithOAuth` (PKCE): the system browser runs the flow while a loopback server on
  `localhost:52423`–`52425` catches the redirect and the code is exchanged back in the webview. In a plain
  browser the button says it needs the desktop app.
- **Fields**: 44px, `rgba(255,255,255,.04)` fill, hairline inset. Focus = 40% white inset ring. Invalid = rose
  inset ring and a dot-led message that says how to fix it.
- **Mode switch**: a text link under the button ("New to Dispel? Create an account" / "Already have an account?
  Sign in"). Create mode changes the title ("Create your account"), subtitle ("Start with 10,000 USDT in paper
  funds."), button and the password hint.
- **Product hook**: one row under the box: stance dot, verdict, regime, time. **Prices**: five static pairs at
  the bottom in Geist Mono, not a scrolling tape.
- Under 720px: headline 30px, sigil 760px, box padding 24/20.

### Trade
```
┌ Sidebar ┬ Top bar ───────────────────────────────────────────────────────────────┐
│         │ ┌ Markets 236 ┐ ┌ Header: monogram · pair · 28/400 price · 24h stats ☆ ┐ ┌ Order 300 ┐ │
│         │ │ search  /   │ │ Setup context strip (coral-tinted left edge)       │ │ Buy|Sell  │ │
│         │ │ Watch | All │ └────────────────────────────────────────────────────┘ │ Mkt|Limit │ │
│         │ │ rows + Read │ ┌ Chart: tf 1m…1D · Setup levels · Volume toggles    ┐ │ price/amt │ │
│         │ │   dot       │ │ OHLC readout, crosshair, levels, last-price tag    │ │ 25 50 75 M│ │
│         │ │             │ └────────────────────────────────────────────────────┘ │ est box   │ │
│         │ │             │ ┌ Positions | Open orders | History                  ┐ │ [Buy SOL] │ │
│         │ └─────────────┘ └────────────────────────────────────────────────────┘ ├ Book|Trades┤ │
│         │  Binance public data | Stream live | Paper      / search  B S side  L levels        │
```
- Five panels on Void at 92% opacity. The ambient sigil rises behind the transparent sidebar (B6).
- **Setup strip**: starts with the 22px sigil seal and the `SETUP` eyebrow, stays on **one line**; the summary
  truncates with an ellipsis (it wraps only below 900px).
- **Live price** on the chart is drawn as the sigil's tip (B6); candles, levels and crosshair stay plain.
- **Chart:** candles `--up`/`--down` with 1px radius, volume at 28% opacity in the bottom 16%, grid at 4% white,
  a Geist Mono axis. The last price is a dashed line with a **Mist tag and Iron text**. Setup levels are dashed
  (invalid in `--down`, target in Ash), labelled on the line and tagged on the axis. The crosshair uses a Slate
  tag. OHLC readout top-left.
- **Order entry:** Buy/Sell are the app's only chromatic fills (`#59d499` with `#062417` text / `#f0506e` with
  `#2a0610` text, 25% white top highlight). Market/Limit are underline tabs. The unit sits inside the field.
  Percent chips, a recessed estimate box, a full-width submit in the side colour. Keys: `B`/`S`.
  **The setup never pre-fills the ticket.**
- **Book:** asks above, bids below, depth bars with 3px radius at 10–11% tint, a recessed mid-price well with
  the spread. Trades is a tab in the same panel. New prints flash for 0.9s (off under reduced motion).
- **Markets:** search (`/`), Watchlist/All tabs, 26px monograms, a Read dot + label under each pair, the
  selected row Recessed + `--key-soft`.
- Below 1240px the market list hides (search stays reachable with `/`). Below 900px the order column stacks
  under the chart.


### Portfolio
```
┌ EQUITY panel ─────────────────────────────────────────────┬ key figures 280 ──────┐
│ PAPER EQUITY  10,482.16 USDT (40/400)   [24h|3d|All]      │ Cash · Positions      │
│ [+180.54 +1.75% all time] [+64.20 today]                  │ Unrealized · Realized │
│ equity line vs dashed NET DEPOSITED step line;            │ Fees · Net deposited  │
│ gap tinted green (ahead) / rose (behind); deposit dots    │ [Deposit/withdraw]    │
├ POSITIONS 1.9fr ───────────────────────────┬ ALLOCATION 1fr ──────────────────────┤
│ market+Read tag · qty · entry→last · value │ astrolabe dial + legend              │
│ · P/L · cushion-to-level bar · [Trade]      │ LAST 7 DAYS: one stacked column/day │
│ WORTH KNOWING: 3 factual sentences          │                                      │
├ CLOSED TRADES (realized P/L) ──────────────┼ OPEN ORDERS (price vs limit) ────────┤
```
- **The equity curve is always drawn against net deposited.** A deposit must never look like profit. The band
  between the two lines is the real result: green 32→6% where ahead, rose where behind. Each funds move is a
  hollow dot on the dashed line. The end point pulses; both lines get right-axis tags (Mist for equity, Graphite
  for deposited). Axis labels that would collide with a tag are hidden.
- The key-figure column always pairs a number with a plain sub-label ("your money in, minus out").
- The positions **cushion bar** is the same component as Exposure check on Home (full at ≥5%; amber under 2%).
- "Worth knowing" holds **only facts about the account** (cash share, concentration, the nearest level) and ends
  with "Facts about your account, not advice."
- **Allocation dial** (B6): a 100-tick astrolabe scale with one arc per holding and the cash share in the centre;
  the legend sits beside it (name + pair left, value + % stacked right). It uses the **categorical palette**
  below. Cash is always hatched Ash.
- The equity curve's last point carries the sigil tip ring (B6), in green.

### Activity
```
┌ PAPER CASH (sigil corner)   ┬ MOVE PAPER FUNDS ─────────────────────────────────────┐
│ 5,054.28 USDT (40/400)      │ [↓ Deposit | ↑ Withdraw]                               │
│ reserved-by-orders note     │ asset tiles (monograms) │ address (validated view)     │
│ Net deposited · In · Out    │ network chips + format  │ quantity + unit, % chips      │
│ 🔒 simulated                │ REVIEW: one sentence + basis/value/after · [Deposit ↵]│
│                             │ ▲ public addresses only (amber well)                  │
├ LEDGER: [All|In|Out] [All assets|Cash|Crypto] ──────────────────────────────────────┤
│ Today · Sep 27 ···················································· net +747.60 USDT    │
│ (monogram + ↓ badge) Deposited 8.00 AVAX · Avalanche C-Chain · from 0x3f9A…c21E ··· │
```
- **Paper cash** carries a rings-only sigil fragment in its empty bottom-right corner (B6). Nothing on the form or
  the ledger sits over artwork.
- **Address display rule (safety):** Geist Mono; the **first and last 4 characters in White 500**, the middle in
  Smoke. It is used in the address field, the review line and every ledger row. A valid address locks into a
  button view with a green inset ring and a ✓ ("Check the first and last 4 characters"). Click to edit. An invalid
  address shows the expected format for that network.
- **Key guard:** if the address field receives 12 or 24 words or a 64-hex string, clear it immediately, never
  store it, and show a rose danger block: "This looks like a seed phrase or private key…".
- **Review strip** before every move: one sentence ("Deposit **2.50 SOL** on **Solana** from **7xKX…gAsU**")
  plus cost basis, value and position/cash after. The button repeats the action and amount.
- **Ledger colour:** funds moves are not P/L. Money in is Mist with "+", money out is Ash with "−", and
  direction is an arrow badge on the monogram. Never green or red. Grouped by day with a day net in USDT. New
  entries flash green once (1.6s). Copy address on hover.

### Categorical palette (which asset, never state)
| Slot | Value | Use |
|---|---|---|
| Cash | hatched `#9c9c9d` | Always cash |
| 1 | `#8aa4ff` periwinkle | Largest position |
| 2 | `#ffc07a` amber | Second position |
| 3 | `#c79bff` lilac | Third / "other" |

Never use green, rose or caution amber `#e8b04a` for a category.

## B8. Character & motion (accent budget)

Working screens stay a terminal. Character is spent in a few fixed places:

| Accent | Where | Spec |
|---|---|---|
| **Market sigil** | Home › Market read panel only | The sigil's live reading (B6) behind the regime column: radial mask `ellipse 50% 95% at 72% 50%`, left-to-right scrim `rgba(7,8,10,.96 → .86 at 40% → .3 at 64% → .12)`. Regime-column text carries a tight dark halo (`0 0 2px / 6px / 10px #07080a`) so no line cuts a label. The regime header has no secondary label, so the tip always lands in empty space. |
| **Live border** | Market read panel only (one per screen) | 1px conic-gradient ring: transparent → stance colour 55% → coral → white tip. It spins at 16s per lap (favorable), 11s (wait), 9s (reduce risk), or 30s at 45% opacity (unclear). Under reduced motion it stays as a static arc. |
| **Verdict tint** | Verdict text | Text gradient from white to the stance tint (`#a6efc9` / `#f5d08a` / `#bdbdbf` / `#ffa3b4`). Eases in (8px rise + 6px blur, .55s) only when the read changes. |
| **Status pulse** | Market read status dot | A 2.4s ring that expands to 3× and fades. |
| **Caution tint** | Caution well | `linear-gradient(90deg, rgba(232,176,74,.12), recessed 55%)` + an amber inset hairline at 16%. |
| **Regime glow** | Current regime step; Today ribbon | The current step glows in its colour (16px). Ribbon segments run from 10% to 32% of their colour. The "Now" edge is a white 2px tick that blinks every 1.8s. |
| **Bias selection** | Selected setup row + detail pane | The row gets a tint from the left in its bias colour (14% → recessed) with a bias-coloured drop glow, and the monogram gets the full `--key` ring plus a glow. The detail pane gets a radial glow in its top-right corner (11%). The level chart area fills with the bias colour (22% → 0). **Never a coloured edge bar.** |
| **Shift card** | Changes › regime-shift event | Tinted with the regime it moved *to*. The glyph glows. When the market state changes, events slide in with a 55ms stagger. |
| **Ambient** | Every working screen | The rings-only sigil rising behind the transparent sidebar from the window's bottom-left corner (B6). |
| **Welcome** | First launch only | A dark banner (`#0a0b0d` + a 9% coral radial on the right) with a sigil fragment on the right, the headline in two tones ("Welcome to Dispel." White, "Start with the read." Smoke), numbered step keycaps, and a Mist "Got it". |
| **Page glow** | Behind the app window | A maroon radial at the top-right and a deep-blue radial at the left, over Void. |

Rules:
- **No colour behind data.** The coloured sigil sits only behind the regime column under a scrim. Stats and "Why this read" sit
  on frosted glass (`rgba(7,8,10,.55)` + 10px blur). Setups, Changes and the floor stay on solid panels.
- **Motion is slow and means "live".** Artwork drifts at ≥30s per cycle. Hover changes colour only. Entrance
  animations run only when data changes, never on every render. `prefers-reduced-motion` stops everything.
- Coral stays brand-only: the logo, the live-border tip, and the sigil's arc, tip and hot node. No gradient text
  anywhere except the verdict's white-to-tint fade.

---

# Part C — Market intelligence layer (internal codename: JEV)

## C0. Naming rule: never show "JEV"
The intelligence is presented as **Dispel itself**. It is never a named assistant, character or bot.
- No "JEV", "AI", "assistant", avatar, sparkle icon or chat bubble anywhere in the UI.
- Copy speaks as the product ("Nothing meets the bar", "A shift will be marked here"), never "JEV thinks…" or
  "I think…".
- "JEV" may appear only in code, internal docs, analytics events and logs.

| On screen | Internal |
|---|---|
| Market read | `jev.pulse` |
| Why this read | `jev.evidence` |
| Market regime | `jev.regime` |
| Setups | `jev.radar` |
| Changes · Since your last visit | `jev.watch` · `jev.diff` |
| Setup (context strip on Trade) | `jev.context` |
| Read (watchlist column) | `jev.tag` |

## C1. Principles
1. **Orientation before action.** Home answers, in this order: what's happening → how favourable → look or
   wait → what deserves attention → what to be careful of.
2. **"Wait" is a first-class answer.** `Wait.` and `No clear read` get the same 40px treatment as
   `Look for setups`. An empty setups list is a designed state with a concrete "what would need to happen".
3. **Encode state once.** A stance is shown by a status dot plus words. Don't add stripes, coloured panels or
   repeated badges for the same fact.
4. **Monochrome by default.** Colour appears only for price direction, caution/risk and the current regime step.
5. **Stable layout.** Market state changes content, never the layout. Selecting a setup never pushes the page.
6. **Progressive disclosure:** L0 verdict → L1 explanation + 4 stats → L2 "Why this read" + setup detail →
   L3 Trade workspace.

## C2. Home composition

```
┌ Sidebar ─┬ Top bar 48 ─────────────────────────────────────────────────────────────────┐
│ ◆ Dispel │ ┌ MARKET READ panel ───────────────────────────────────────────────────────┐ │
│ Home  4  │ │ ● MARKET READ 14:32 UTC            │ MARKET REGIME   Constructive 4/5    │ │
│ Trade    │ │ Look for setups       (40/400)     │ ▭▭▭▬▭ scale                         │ │
│ Portfolio│ │ Bullish bias · buyers in control   │ TODAY ▭▭▭▭▭▭▭▬▬▬▬ ribbon + ticks     │ │
│ Activity │ │ explanation (≤62ch)                │ 10:42 Shift: Neutral → Constructive │ │
│          │ │ [▲ caution well]                   │                                     │ │
│          │ ├ Trend strength │ Confidence │ Risk │ Volatility ───────────────────────────┤ │
│          │ └ ▸ Why this read  E ──────────────────────────────── (6 evidence wells) ──┘ │
│          │ ┌ SETUPS panel 2fr ─────────────────────────────┐ ┌ CHANGES panel 1fr ──────┐ │
│          │ │ list (↑↓)          │ detail: dims, chart,      │ │ since your last visit   │ │
│          │ │ SOL  68% ▬▬▬▬       │ what we see, levels,      │ │ today's events          │ │
│          │ │ LINK 64% ▨▨▨        │ [Open chart ↵] [Watch]    │ │                         │ │
│          │ └───────────────────────────────────────────────┘ └─────────────────────────┘ │
│ Paper    │ ┌ Watchlist + Read │ Market: breadth, tabs │ Paper account ──────────────────┐ │
│ account  │ └───────────────────────────────────────────────────────────────────────────┘ │
│          │ Binance public data | Read 14:32 | Next 14:47 | Paper      ↑↓ setup ↵ open E why│
└──────────┴──────────────────────────────────────────────────────────────────────────────┘
```

Breakpoints (container queries on main): **<1180** Changes moves under Setups, floor becomes 2 columns ·
**<1000** market read stacks · **<820** setups list stacks above the detail · **<760** stats become 2-up ·
**<720 app width** sidebar hidden.

## C3. Components

**Market read panel** (the hero panel: sigil + live border, see B6 and B8)
- Meta line: 8px status dot in stance colour (with an 18% halo) · `MARKET READ` eyebrow · Geist Mono time and coverage.
- Verdict, 40px/400/+0.2px white, from a fixed vocabulary: `Look for setups` · `Be selective` · `Wait.` ·
  `No clear read` · `Reduce risk`.
- Stance line, 15px Ash: coloured bias word + plain clause ("Bullish bias · buyers in moderate control").
- Explanation, 14px/1.6 Ash, ≤62ch, with the first sentence in Mist 500 as the takeaway.
- Caution well: Recessed, 8px radius, caution triangle + one sentence in Mist. **Always present.**
- Regime column: current regime name 20px/400 + "step n of 5" · 5-step scale (only the current step is
  coloured) · Today ribbon (segments tinted 20% into Recessed, 5px radius, labelled when wide enough, mono ticks)
  · latest shift with its cause, or "No regime change today".
- Stats row: Trend strength (0–100 meter with a midline), Confidence (3 steps, Mist), Risk (3 steps; Low
  neutral, Medium caution, High down), Volatility (4-step position; caution when Elevated or above). On first
  launch, a one-line plain-language hint sits under each stat.
- "Why this read" `E`: 6 recessed wells (Trend, Momentum, Volume, Volatility, Breadth, Levels), each with a
  label, a one-word state and a one-line reason.

**Setups panel (list | detail)**
- Header: "Setups" + count. The subtitle is always "Worth investigating, not instructions to buy. Ordered by time
  horizon, not by score." Rows are never numbered or ranked.
- List row: monogram · pair + bias word (+ `new` badge) · **odds bar** · a 2-line setup sentence · a mono meta line
  `Medium confidence · Medium risk · 15m – 1h`.
- **Odds bar:** length = odds. **Texture = confidence**: solid (high), 60% opacity (medium), hatched (low).
  Colour = bias. A legend under the list explains it.
- Conditional setups (ranges, compressions) show "If / then" instead of odds.
- Detail: header (monogram, pair, bias, price, 24h) · setup sentence 15px Mist · four dimension wells (Odds,
  Confidence, Risk, Horizon) · level chart (price line, 5% area, dashed invalidation in Down, dashed target in
  Smoke, labelled last price) · "What we see" (3 bullets) · Levels · actions: **Open chart ↵** (Mist) and
  **Add to watchlist** (secondary) · "Paper funds only".
- **Wait state:** a recessed "No setup worth chasing" card, then "Closest to forming" rows. The detail pane shows
  "What would need to happen" and offers **Notify when ready**.

**Exposure check (Reduce risk only)**
- In a Reduce-risk read the Setups panel becomes **Exposure check** without changing its layout. There are no
  new setups. The list shows the user's open positions checked against their levels.
- A "Protect first" card (rose tint from the left) comes first: "No new setups in a risk-off market… Dispel
  doesn't sell for you: this is a check, not an instruction."
- Row: monogram · pair + status (`Invalidated` in Down, `At risk` in Caution, `Holding` in Ash) · P/L % ·
  **cushion bar** (distance to invalidation, full at ≥5%; striped red when the level is already broken) · mono
  meta `12.50 SOL · entry 201.46 · level 206.50`.
- Detail: Holding / Entry / Now / P/L wells, the level chart (invalidation + next support), "What we see",
  **Open chart ↵** and **Review in Portfolio**. It never shows a Sell button. The note says "A check, not an
  instruction."
- Changes may carry a personal event (`You` · "Your SOL position is below its invalidation level").

**Changes panel**
- Returning users: a "Since your last visit" recessed box showing a diff (`→` changed in Mist, `=` unchanged in
  Smoke, `+` new in Up, `−` removed in Smoke), with the time and "ago".
- First launch: the box explains what Dispel checks and how often, and that nothing requires action.
- Event rows: mono time · glyph (● info Smoke, ◆ caution amber, ■ regime shift Mist, with the row recessed) ·
  symbol · one line + implication. No avatars, images or reactions.

**Read tag (watchlist):** 5px dot + short text (`At resistance`, `Setup`, `Invalidated`, `—`).

**Setup context strip (Trade):** a recessed 8px-radius strip between MarketHeader and the chart:
`SETUP · Bullish · pullback holding above 208 | Invalid below 206.50 | Target 219.00 | 15m – 1h | Hide`. The chart
draws the same levels as price lines. The order ticket is never pre-filled.

**Welcome (first launch only):** a dark banner with a sigil fragment (B8). "Welcome to Dispel. Start with the
read." and four numbered steps: Read the market · Look at a setup · Open its chart · Paper trade, if you want.
Dismiss with "Got it".

## C4. Voice
Calm, specific, risk-aware. Confident when the evidence is strong, and comfortable saying "unclear".

| Do | Don't |
|---|---|
| Wait. Direction is mixed and volatility is elevated. | Market looks scary! Stay safe 🙏 |
| Worth investigating · 68% odds · high confidence | SOL about to pump 🚀 89% win rate |
| Nothing meets the bar in this market. | Nothing to trade — check back later! |
| Invalid if a 1h candle closes back below the breakout. | Stop loss recommended: 206.50 |
| No clear read. Too little is happening to lean either way. | JEV is thinking… 🤖 |

Rules: no emoji, no exclamation marks, no first person, no product-engine name, no "signals" or guarantees.
Name the cause, not the mood. Every read carries one caution. Odds are estimates (never "win rate").

## C5. Required states
Favorable · Wait · Unclear · Reduce risk · First launch (welcome, hints, explained Changes, no diff) · Returning
(diff, nav count, no hints) · **Stale read** (meta time turns caution, "last read 47m ago", verdict dims to Ash)
· **Offline** (the verdict is replaced by "Live data needed for a market read". Never guess).

## C6. Navigation
Sidebar: **Home** (default landing, with a change count) · Trade · Portfolio · Activity.

---

## From Candle Light to the sigil (shipped)
The app now follows Parts B and C with the Astrolabe sigil:
- **Generator**: one pure module (e.g. `src/lib/sigil.ts`) that returns the sigil SVG from `{ mood, strength, arc,
  hot, … }` per B6, rendered through a small component. No image files.
- **Sign in** (`LoginForm`): the centred layout, headline, solid box, Google button with the "coming soon" note,
  text-link mode switch, market-read row and static prices (B7).
- **Home**: the Market read aura becomes the sigil's live reading; drop the regime header's secondary label;
  the welcome banner loses its ember gradient and gradient text (B8).
- **All working screens**: the ambient becomes the rings-only sigil behind a transparent sidebar (B6).
- **Trade**: the setup seal and the live-price tip. **Portfolio**: the allocation dial and the equity tip ring.
  **Activity**: the Paper cash fragment.
- `src/assets/dispel-hero.svg` and `aura-*.svg` are gone; only `design/assets/` keeps the retired artwork.
