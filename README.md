# Swift Trade

A desktop paper-trading terminal for crypto spot markets. Live market data from Binance public
endpoints, simulated orders and balances persisted in Supabase. No real funds, no exchange API
keys, no custody.

## Features

- Email/password auth with session restore
- Live market list and watchlist (Binance REST + WebSocket, no API key)
- Candlestick chart with volume and timeframes, order book, recent trades
- Paper order entry: market and limit orders, validation, estimated total and fees
- Open orders, order history, cancel, and limit fills when the live price crosses
- Portfolio: cash balance, positions, average entry, market value, unrealized P/L
- Light and dark theme (light default)

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

## How money works

All balance, position, average-entry and realized-P/L math runs inside Postgres `numeric`
columns via security-definer RPCs (`place_order`, `fill_order`, `cancel_order`). The client
cannot update balances or insert orders directly — RLS blocks it. The frontend only sends exact,
validated payloads and uses decimal.js for estimates and display.

Paper fills use the client-observed market price; server-side checks enforce ownership, order
state, limit-price invariants and non-negative balances. Real exchange execution is out of scope
and would require a separate signing service.

Market data tries `api.binance.com` / `stream.binance.com` first and automatically falls back to
`data-api.binance.vision` / `data-stream.binance.vision` when blocked.
