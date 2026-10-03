# Dispel

[![Release](https://img.shields.io/github/v/release/aangwijaya/dispel?label=release&color=ff6363)](https://github.com/aangwijaya/dispel/releases/latest)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-1b1c1e)](https://aangwijaya.github.io/dispel/)

A desktop paper-trading terminal for crypto spot markets. Live market data from Binance public
endpoints, simulated orders and balances persisted in Supabase. No real funds, no exchange API
keys, no custody.

## Download

Installers are built for Windows, macOS (Apple Silicon and Intel) and Linux on GitHub's runners.
Grab the latest from the **[download page](https://aangwijaya.github.io/dispel/)** or the
**[releases page](https://github.com/aangwijaya/dispel/releases/latest)**. Builds are unsigned:
Windows shows SmartScreen (*More info → Run anyway*) and macOS needs a right-click → *Open* the
first time.

## Features

- Email/password and Google auth with session restore
- **Home** — market read, market regime, setups and changes. The read itself is demo design data
  (marked by the `Demo data` badge in the top bar); prices and account figures are real
- **Dark-only design system** (`DESIGN.md`): sidebar + top bar shell, coral brand mark, Inter +
  Geist Mono, panels on a void canvas with the soft keycap edge
- **Responsive**: 1440 desktop window, web, iPad, down to a 390px mobile layout (bottom tab bar,
  stacked panels, search overlay for markets)
- Live market list and watchlist (Binance REST + WebSocket, no API key)
- Candlestick chart with volume, OHLC readout, setup levels as dashed price lines, order book and
  recent trades in one Book/Trades panel
- Paper order entry: market and limit orders, validation, estimated total and fees, percent chips,
  Buy/Sell keyboard keys
- Open orders, order history, cancel, and limit fills when the live price crosses
- Portfolio: equity drawn against **net deposited**, positions with a cushion to their setup level,
  allocation, closed trades and open orders
- Paper funds: USDT cash deposits/withdrawals plus simulated crypto transfers (BTC, ETH, SOL and EVM
  assets) with network and address input, recorded in a transaction ledger grouped by day
- Key guard: a 12/24-word seed phrase or 64-hex private key typed into an address field is cleared,
  never stored, and replaced with a danger notice

## Stack

Tauri v2 · React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Supabase (auth, Postgres,
RLS, RPC) · lightweight-charts · decimal.js

## Quick start

```bash
npm install
cp .env.example .env          # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

supabase link --project-ref <project-ref>
supabase db push              # applies supabase/migrations

npm run tauri dev
```

### Windows desktop (recommended)

The desktop window is GPU-composited on WebView2 — the target platform and the smoothest path. On
Windows:

```powershell
git clone https://github.com/aangwijaya/dispel.git
cd dispel
copy \\wsl.localhost\Ubuntu\home\<you>\projects\dispel\.env .env   # or recreate from .env.example
npm install
npm run tauri dev        # or: npm run tauri build
```

Prerequisites: Node 20+, the Rust MSVC toolchain (`rustup default stable-x86_64-pc-windows-msvc`)
and the WebView2 runtime (preinstalled on Windows 11). Install dependencies from a native Windows
path, not from `\\wsl.localhost\...` — `npm install` fetches OS-specific binaries.

### Build an installer for another PC

`.env` values are baked into the frontend at build time, so the installer carries everything it needs:
the target PC gets no repo, `.env`, or keys. `npm run build` (and therefore `tauri build`) fails with a
clear message when they are missing. Build on Windows:

```powershell
npm run tauri build
```

Artifacts:

| File | Use |
| --- | --- |
| `src-tauri/target/release/bundle/nsis/Dispel_<version>_x64-setup.exe` | Recommended — per-user install, carries the offline WebView2 installer |
| `src-tauri/target/release/bundle/msi/Dispel_<version>_x64_en-US.msi` | MSI alternative |
| `src-tauri/target/release/dispel.exe` | Portable — runs without installing, needs WebView2 already present |

Give the target PC the `.exe` (or `.msi`). It needs Windows 10/11 x64 and internet at run time
(Supabase auth/data and Binance prices; Binance falls back to `data-api.binance.vision` /
`data-stream.binance.vision` when blocked). WebView2 is covered by
`bundle.windows.webviewInstallMode: offlineInstaller` in `tauri.conf.json`, which adds ~127 MB to the
installer; switch it to `downloadBootstrapper` for a ~5 MB installer when the target is online.
Unsigned builds trigger SmartScreen (“Windows protected your PC” → *More info* → *Run anyway*); a
code-signing certificate via `bundle.windows.signCommand` removes it.

There is no auto-updater: bump `version` in `package.json`, `src-tauri/Cargo.toml`,
`src-tauri/tauri.conf.json` and the sign-in top bar (`src/features/auth/LoginForm.tsx`), add a
`CHANGELOG.md` entry, rebuild, and send the new installer. Tag `vX.Y.Z` to publish through the
Release workflow.

### GitHub Actions (all three platforms)

`.github/workflows/release.yml` builds on GitHub's own runners, so a WSL or Windows machine only has to
push. It runs manually (Actions → Release → Run workflow) or on a `v*` tag; every run uploads the
bundles as artifacts and a tag run also opens a draft release. Add these repository secrets
(Settings → Secrets and variables → Actions):

| Secret | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | baked into the frontend at build time |
| `VITE_SUPABASE_ANON_KEY` | publishable key, the same value as `.env` |

macOS and Windows builds are unsigned: Gatekeeper needs a right-click → Open and SmartScreen needs
*More info* → *Run anyway* until signing certificates are configured.

### Linux / WSLg

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

On WSLg the app rasterizes on the CPU and moves its windows through the WSL compositor, so window
drag/resize and long scrolls stay less smooth than on Windows even with the lite rendering mode.
`wsl --shutdown` (from Windows) often restores `/dev/dri` and GPU rendering; try `wsl --update` if
it stays missing. Use WSL for development and the Windows build for daily use.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run tauri dev` | Run the desktop app |
| `npm run dev` | Frontend only in a browser |
| `npm run build` | Typecheck + production frontend build |
| `npm test` | Unit tests (vitest) |

## Data notes

- The market read is produced by TypeSafe Jev on a 15-minute schedule and stored server-side in
  `public.market_reads` (see “Jev market read” below). The client currently still renders the labeled
  demo read until the live client layer ships; the `Demo data` badge disappears when it does.
- The 7-day equity and allocation history on Portfolio is demo design data; the current figures
  (equity, cash, positions, P/L, fees, net deposited) are real.
- Realized P/L is tracked per market in Postgres (`paper_positions.realized_pnl`). The closed-trades
  table lists real filled sells and shows a market's total realized P/L once its position is flat.

## Google sign-in

The Google button uses Supabase `signInWithOAuth` (PKCE). The desktop app opens the system browser
and catches the redirect on a loopback server (`http://localhost:52423`, falling back to 52424 and
52425), so Google never needs a custom scheme. Setup (once per project):

1. **Google Cloud Console** → APIs & Services → OAuth consent screen (External; add test users while
   unverified), then Credentials → Create credentials → OAuth client ID → Web application with the
   authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase dashboard** → Authentication → Providers → Google: enable and paste the Client ID and
   Client Secret. The secret stays in Supabase; the app only ever sees the publishable key.
3. **Supabase dashboard** → Authentication → URL Configuration: set the Site URL to a real URL
   (`http://localhost:3000`) and add the loopback redirects `http://localhost:52423`,
   `http://localhost:52424`, `http://localhost:52425` (plus their `http://127.0.0.1:...` twins if you
   want them). Wildcards are not valid in the port, so list each port explicitly.

Email/password keeps working without any of this. In a plain browser (`npm run dev`) the Google
button reports that it needs the desktop app. The auth URL opens in the default browser; the flow
times out after 3 minutes.

## Jev market read

TypeSafe Jev supplies the judgments (regime, stance, bias, trend strength, risk, per-candidate worth,
setup type, target-first probability and setup risk). All numbers, levels, events and UI copy are
computed in code under `supabase/functions/_shared/read/`; the Edge Function only does I/O.

Setup (once per project):

```bash
# 1. Enable pg_cron and pg_net in the Supabase dashboard (Database -> Extensions).
# 2. Function secrets (never in .env or the repo):
supabase secrets set TYPESAFE_API_KEY=<key> READ_CRON_SECRET=$(openssl rand -hex 32)
# 3. The same cron secret and the function URL, stored in Vault so the migration never
#    contains a secret (run in the SQL editor):
#    select vault.create_secret('<the same READ_CRON_SECRET value>', 'read_cron_secret');
#    select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/market-read', 'market_read_url');
#    select public.schedule_market_reads();  -- idempotent; schedules after the extensions exist
# 4. Apply migrations, then deploy the function. The function authenticates with the
#    x-cron-secret header (not a Supabase JWT), so it deploys with --no-verify-jwt:
supabase db push
supabase functions deploy market-read --no-verify-jwt
```

The migration schedules `market-read` every 15 minutes and a retention sweep daily (rows older than
14 days are deleted). Without the Vault secrets the migration still applies and only logs a notice.

Manual trigger and checks:

```bash
curl -sS -X POST "https://<project-ref>.supabase.co/functions/v1/market-read" \
  -H "x-cron-secret: $READ_CRON_SECRET" -H "Content-Type: application/json" -d '{}'
# Without the header the function must answer 401.
```

```sql
-- In the SQL editor:
select jobname, schedule, active from cron.job order by jobname;
select id, created_at, as_of, status, model from public.market_reads order by created_at desc limit 5;
select status_code, content, created from net._http_response order by created desc limit 5;
```

`status = 'ok'` means fresh Jev answers. `status = 'degraded'` means Jev was unavailable and the
market-wide answers from the last `ok` read (at most 45 minutes old) were reused with fresh facts;
degraded reads publish no setups. Home marks them as partial (with the time of the reused judgment)
and shows "Setups paused" instead of an empty list. If Binance cannot be reached from the project region,
the function returns 503 and writes nothing, so the schedule simply retries in 15 minutes.

### Inputs (derivatives + on-chain)

Besides spot prices, every read gathers optional inputs; a failing source is recorded in
`inputs_health` and left out of the state instead of failing the read:

| Source | Facts |
| --- | --- |
| Binance USDⓈ-M futures | funding (8h), open interest and 1h/4h/24h OI history |
| Gate.io futures | funding, OI history, 24h long/short liquidations, long/short account ratio |
| Hyperliquid | hourly funding (normalised to 8h) and open interest per coin |
| Coin Metrics Community | BTC/ETH exchange netflow, exchange supply, active addresses (daily) |
| DefiLlama | total stablecoin supply (daily) |
| mempool.space | BTC mempool size and fastest fee (live) |

Coin Metrics Community data is used under **CC BY-NC 4.0** (personal, non-commercial project) with
attribution shown in the Home meta strip. On-chain facts are refetched only when the UTC date changes
and are reused from the previous row otherwise; open-interest windows fall back to our stored
snapshots. The computed facts are kept in `market_reads.inputs` and per-source health in
`inputs_health`. `POST {"probe":true}` with the cron secret returns a per-source probe report from
the deployed region without calling Jev or writing a row.

## How money works

All balance, position, average-entry and realized-P/L math runs inside Postgres `numeric`
columns via security-definer RPCs (`place_order`, `fill_order`, `cancel_order`,
`adjust_paper_funds`, `transfer_paper_crypto`). The client cannot update balances or insert orders
directly — RLS blocks it. The frontend only sends exact, validated payloads and uses decimal.js for
estimates and display.

Paper fills and crypto deposits use the client-observed market price; server-side checks enforce
ownership, order state, limit-price invariants, address formats and non-negative balances. Crypto
deposits/withdrawals are simulated only: addresses are public strings validated per network and
never used for signing. Real on-chain movement and exchange execution are out of scope and would
require a separate custody/signing service.

Market data tries `api.binance.com` / `stream.binance.com` first and automatically falls back to
`data-api.binance.vision` / `data-stream.binance.vision` when blocked.

## Design

`DESIGN.md` is the source of truth; `design/` holds the reference mocks (and the retired Candle Light
artwork under `design/assets/`). The theme is dark only (light mode was retired with the refactor). The
Tauri window can be resized down to 720×600; below 720px (web/mobile) the sidebar becomes a bottom tab bar.

### Software renderers (WSLg, VMs)

`src/lib/perf.ts` probes WebGL at startup. On a software renderer (llvmpipe, no `/dev/dri`) it sets
`data-perf="lite"` on `<html>`, which drops the sigil's SMIL rotation, stops the animated conic border,
the live-price tip breath and the `.eq-chart` pulse, and replaces the `backdrop-filter` surfaces with
solid fills. The look is unchanged; the per-frame paint cost is not. Force a mode with
`localStorage.setItem('dispel-perf', 'full')` or `'lite'`.

If the desktop app feels slower than the browser on the same machine, that is the renderer, not the
page: see the Windows/Linux notes in Quick start.
