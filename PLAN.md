# PLAN.md

Implementation plan for Swift Trade. Status: MVP implemented; this document records the scope,
architecture and the phase breakdown used to build it.

## Goal

A desktop paper-trading terminal with real live market data and simulated money. No exchange
credentials, no custody, no real funds. Prioritize information density, readability and fast
scanning; light theme default with a dark theme toggle.

## MVP scope

### Included

- Email/password auth, session restore, protected shell
- Live market list + watchlist (Binance public REST/WS, no API key)
- Trading workspace: header stats, candlestick chart + volume + timeframes, order book, recent trades
- Order entry: market and limit, buy/sell, estimated total and fees, strict validation
- Paper orders: instant market fills, limit fills when the live price crosses, cancel
- Open orders / order history; portfolio with cash, positions, average entry, unrealized P/L
- AddressDisplay component (first-4/last-4 highlight rule)
- Light + dark themes; compact density; tabular numerals

### Deferred

- Real order execution (requires a separate signing/execution service)
- Deposits/withdrawals/activity ledger, transactions, wallets
- Multiple portfolios/accounts, settings page, alerts/notifications, auto-update
- OAuth, order matching beyond the simple limit-cross rule

## Architecture

```
Binance REST (klines, 24h tickers)     Binance WS (ticker/depth/aggTrade/kline)
                 \                    /
                  v                  v
                  src/lib/market/ (binance.ts, stream.ts, format.ts)
                                |
                                v
                         React features (UI)
                                |
      React ---> Supabase JS ---> Auth (email/password, session restore)
        |                     \-> Tables + RLS (paper_accounts, paper_positions,
        |                          orders, watchlist_items)
        |                     \-> RPCs (place_order, fill_order, cancel_order)
        |                            [authoritative money math in Postgres numeric]
        |
        +---> Tauri (window/shell only; no custom Rust commands)
```

- **React**: UI, client state, market-data streaming, validation, Supabase calls.
- **Tauri/Rust**: scaffold and window configuration only. No command has a justified native need.
- **Supabase**: auth, persistence, RLS, atomic paper settlement via SQL functions.
- **Binance**: public REST + WebSocket market data. Host fallback to `*.binance.vision` when
  primary hosts are blocked.

## Database

Five migrations in `supabase/migrations` (init, watchlist, paper trading). All money columns are
`numeric`; all writes to financial tables go through security-definer functions with
`set search_path = ''` and `auth.uid()` checks.

| Table | Purpose | Ownership / RLS |
| --- | --- | --- |
| `paper_accounts` | Simulated cash (seeded with 100,000 USDT by an `auth.users` trigger) | Select own only; writes via RPC |
| `paper_positions` | Holdings: quantity, avg entry, realized P/L; PK `(user_id, symbol)` | Select own only; writes via RPC |
| `orders` | Market/limit orders: status, limit price, fill price, fee, timestamps | Select own only; writes via RPC |
| `watchlist_items` | Single watchlist per user; unique `(user_id, symbol)` | Full CRUD scoped to `auth.uid()` |

RPCs:

- `place_order(p_symbol, p_side, p_type, p_price, p_quantity, p_reference_price)` — validates
  shape and invariants; market orders fill immediately with a 0.1% fee; limit orders stored open.
- `fill_order(p_order_id, p_fill_price)` — settles owned open limit orders; enforces crossing.
- `cancel_order(p_order_id)` — cancels owned open orders.
- `settle_order_fill(...)` — internal settlement (cash, position, weighted average, realized P/L).

## Domain types

`src/types/market.ts`: `Timeframe`, `Market`, `Ticker`, `Candle`, `DepthLevel`, `OrderBook`,
`MarketTrade`. `src/types/trading.ts`: `Order`, `OrderSide`, `OrderType`, `OrderStatus`,
`PaperAccount`, `Position`. Numeric transport values are strings; only the chart converts to
`number` at the rendering boundary.

## Realtime strategy

| Data | Mechanism |
| --- | --- |
| Selected ticker, market list tickers | Binance WS `@ticker` via one shared connection |
| Order book | Binance WS `depth20@100ms` |
| Recent trades | Binance WS `@aggTrade`, capped at 50 |
| Chart candles | REST klines on load/timeframe change + `@kline_<tf>` for the live candle |
| Watchlist | Supabase query + optimistic writes, no realtime |
| Orders / portfolio / profile | Supabase queries + refetch after RPC, no realtime |

No polling. Supabase Realtime is deferred until it has a concrete use (real execution or
multi-window sync).

## Security and validation

- RLS `to authenticated` with `(select auth.uid())` on every user-owned table. No insert/update
  policies for financial tables; direct client writes fail.
- `restFetch` only accepts JSON (ISP block pages return HTTP 200 HTML) and falls back hosts.
- All external data is parsed field-by-field; unknown fields are dropped.
- Forms validate via `src/lib/validation.ts`; RPC payloads are constructed explicitly.
- Only the publishable/anon key exists client-side; `service_role` is never used.
- Tauri: no custom commands; strict CSP for Supabase + Binance hosts.

## Financial precision

- Postgres `numeric(24,8)` for prices/balances/fees, `numeric(38,18)` for quantities. All
  authoritative math (fills, weighted average, realized P/L) happens in SQL.
- Frontend uses `decimal.js` (`src/lib/decimal.ts`) for estimates and display only; never raw
  float arithmetic for money.
- Display formatting via `Intl.NumberFormat` with per-market precision and tabular numerals.

## UI structure

```
App
├── AuthGate
│   └── LoginForm
└── AppShell (Sidebar + TopBar)
    ├── Trade
    │   └── TradingWorkspace
    │       ├── MarketList (watchlist first, live tickers)
    │       ├── MarketHeader (last, 24h change, high/low/volume)
    │       ├── TradingChart (candles + volume + timeframes)
    │       ├── BottomPanel (Open Orders | Order History)
    │       └── aside: OrderEntry, OrderBook, RecentTrades
    └── Portfolio (summary cards + positions table)
```

Themes follow DESIGN.md tokens (light default) with a dark variant from the same palette and
semantic up/down/accent tokens. Compact density for data tables.

## Phases

| Phase | Scope | Status |
| --- | --- | --- |
| 0 — Foundation | Tauri + React + TS + Vite + Tailwind scaffold, themes, tooling | Done |
| 1 — Auth + shell | Supabase migration 0001, auth gate, AppShell | Done |
| 2 — Market data | Binance REST/WS boundary, sanitizers, market list, watchlist | Done |
| 3 — Workspace | Chart, order book, recent trades, header | Done |
| 4 — Orders | Migration 0003 + RPCs, order entry, fill checker, bottom panel | Done |
| 5 — Portfolio | Balances, positions, live valuation, P/L | Done |
| 6 — Hardening | Unit tests, CSP, error/empty states, build verification | Done |

## Verification performed

- `npm run typecheck`, `npm test` (29 tests), `npm run build` — green.
- `cargo check` and `tauri build --debug --no-bundle` — green; app window launches.
- Database integration run against a scratch user with rollback: seed balance, market fill, fee,
  weighted average, realized P/L, insufficient balance/position, limit open/fill/cancel,
  limit-not-crossed, RLS blocking direct balance update and direct order insert — 22/22 passed.
- Tauri WebKitGTK probe: chart renders (canvas sized, live data, zero JS errors).

## Pending / follow-ups

- Windows bundle verification on a Windows machine (`npm run tauri build`).
- Optional: `tauri-plugin-window-state` for window size/position persistence.
- Revisit Supabase Realtime only when real execution or multi-window sync is added.
- Any wallet/key-signing feature requires a security model design before implementation.
