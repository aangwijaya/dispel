# AGENTS.md

Instructions for coding agents working in this repository. Read this before making changes.

## Project

Swift Trade — desktop paper-trading terminal for crypto spot markets. Live public market data
from Binance, simulated orders and balances stored in Supabase. No real funds, no exchange API
keys, no custody.

Tauri v2 (Rust scaffold only) · React 19 · TypeScript strict · Vite · Tailwind CSS v4 ·
Supabase (auth, Postgres, RLS, RPC) · lightweight-charts · decimal.js.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | `tsc -b` across app + node configs |
| `npm test` | Vitest unit tests |
| `npm run build` | Typecheck + production frontend build |
| `npm run tauri dev` | Run the desktop app (compiles Rust) |
| `npm run tauri build` | Build the desktop bundle |
| `supabase db push` | Apply `supabase/migrations` to the linked project |

Always finish a change with `npm run typecheck`, `npm test` and `npm run build`.

## Hard rules

- Keep it stupid simple. No abstraction layers, no global state library, no router, no contexts
  unless a real need is demonstrated.
- Strict TypeScript. No `any`, no type gymnastics, no duplicate domain types.
- Use optional chaining for anything coming from Supabase, Binance, Tauri or user input.
- Validate every input (forms, WS/REST payloads, DB rows) with `src/lib/validation.ts` or a
  local sanitizer/mapper. Accept only expected fields; send only exact payloads to RPCs.
- Money math is authoritative in Postgres (`numeric` + security-definer RPCs). The client uses
  `decimal.js` for estimates and display only. Never use raw `number` arithmetic for money.
- Never put `service_role`, exchange secrets, private keys or seed phrases anywhere in the
  frontend or repository. Only the publishable/anon key belongs in `.env` (gitignored).
- RLS is the security boundary. New user-owned tables need policies in a migration. Balance /
  position / order writes must go through security-definer RPCs, never direct table writes.
- Do not add custom Tauri commands unless native functionality is genuinely required.

## Layout

```
src/
  components/     AddressDisplay (first-4/last-4 highlight rule), PriceChange
  features/
    auth/         LoginForm
    shell/        AppShell, Sidebar, TopBar
    trading/      MarketList, MarketHeader, TradingChart, OrderBook, RecentTrades,
                  OrderEntry, TradingWorkspace, useTickers, usePaperTrading
    orders/       BottomPanel (open orders + history)
    portfolio/    Portfolio
  lib/
    market/       binance.ts (REST + sanitizers), stream.ts (single shared WS), format.ts
    orders.ts     RPC wrappers + DB row mappers
    validation.ts input parsers
    decimal.ts    decimal.js helpers
    supabase.ts   single client, env validation
    errors.ts     friendly error mapping
    markets.ts    curated market list (precision, min notional)
  types/          market.ts, trading.ts
supabase/migrations/   schema, RLS, RPCs
src-tauri/             Tauri scaffold (no commands)
```

## Gotchas

- `src-tauri/Cargo.toml` names the lib `swift_trade_lib`; `src-tauri/src/main.rs` must call
  `swift_trade_lib::run()`.
- `lightweight-charts` must keep `localization: { locale: 'en-US' }` — with `LANG=C.UTF-8`
  WebKitGTK passes an invalid locale tag and the chart render loop throws `RangeError`.
- `src/lib/market/stream.ts` is the only place that opens WebSockets. Subscribe through
  `subscribeMarket` / `subscribeKline`; never create ad-hoc `new WebSocket` in components.
- Binance hosts are blocked in some networks. Keep the automatic fallback to
  `data-api.binance.vision` / `data-stream.binance.vision`, and keep `restFetch` rejecting
  non-JSON responses (ISP block pages return HTTP 200 with HTML).
- Rotate frontend data through the public anon/publishable key only. `.env` is gitignored;
  `.env.example` documents required variables.
- No backward-compatibility shims, polyfills or legacy support. Target modern Windows WebView2.

## Verification

- Unit tests cover sanitizers, validation, decimal math and AddressDisplay.
- For DB changes, verify with SQL against a scratch user and roll back (see prior integration
  pattern in git history): market/limit fills, fees, weighted average, realized P/L, insufficient
  balance/position rejection, RLS blocking direct balance updates and direct order inserts.
- Update README.md when user-facing behavior or setup steps change.
