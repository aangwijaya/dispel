# Dispel

A desktop paper-trading terminal for crypto spot markets. Live market data from Binance public
endpoints, simulated orders and balances persisted in Supabase. No real funds, no exchange API
keys, no custody.

## Features

- Email/password auth with session restore
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

Linux desktop prerequisites:

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run tauri dev` | Run the desktop app |
| `npm run dev` | Frontend only in a browser |
| `npm run build` | Typecheck + production frontend build |
| `npm test` | Unit tests (vitest) |

## Data notes

- The market read, regime, setups and changes on Home are **demo design data** until an
  intelligence engine exists. They are always shown with the `Demo data` badge and are replaced by
  an offline state when the market stream is down.
- The 7-day equity and allocation history on Portfolio is demo design data; the current figures
  (equity, cash, positions, P/L, fees, net deposited) are real.
- Realized P/L is tracked per market in Postgres (`paper_positions.realized_pnl`). The closed-trades
  table lists real filled sells and shows a market's total realized P/L once its position is flat.

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

`DESIGN.md` is the source of truth; `design/` holds the reference mocks and the Candle Light
artwork. The theme is dark only (light mode was retired with the refactor). The Tauri window can be
resized down to 720×600; below 720px (web/mobile) the sidebar becomes a bottom tab bar.
