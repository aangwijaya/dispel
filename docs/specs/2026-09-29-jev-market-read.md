# Live Market Read (TypeSafe Jev) — Spec

**Date:** 2026-09-29 · **Branch:** `feat/jev-home` · **Status:** shipped, end-to-end verified

## Goal

Replace the demo market read on Home with a live read decided by TypeSafe Jev, without putting the
API key or any secret in the client. Code computes every number, level, event and UI sentence; Jev
supplies only the judgments.

## Decisions

1. **Server-side function.** A Supabase Edge Function `market-read` fetches Binance public data,
   builds the state, calls TypeSafe Jev once per cycle (one request, many questions), composes the
   market-wide `MarketRead` payload and stores it in `public.market_reads`.
2. **Code owns the facts and the copy.** `supabase/functions/_shared/read/` holds pure TypeScript:
   indicators, features, pre-screen, state builder, question set, answer mapper, C4 templates and the
   composer. The Edge Function only does I/O. Vitest covers all of it.
3. **Jev only judges.** Regime, stance, bias, trend strength, risk, per-candidate worth, setup type,
   target-before-invalidation probability and setup risk. Confidence gating (floor 0.5): stance
   below it is published as `unclear`, bias as `mixed`, positioning and on-chain alignment as
   unclear; low-confidence regime uses the probability-weighted expected step. Market and setup
   risk publish the highest level at least 40% likely, so a medium/high split reads as high.
   A low-confidence read also publishes `stats.split` (the two most likely stances), a raised risk
   publishes `stats.riskRaisedPct`, and a degraded read publishes `judgedTime`. All three are
   optional, so older rows still validate. Setup odds certainty (|2p − 1|) is derived on the client
   from `odds`.
4. **No secret in the repo.** `TYPESAFE_API_KEY` and `READ_CRON_SECRET` live in function secrets; the
   cron job reads the URL and secret from Vault at run time. `market-read` deploys with
   `--no-verify-jwt` and authenticates on `x-cron-secret` (constant-time compare, 401 otherwise).
5. **Public preview.** `public.market_read_latest` exposes only `id, created_at, as_of, status, model,
   read` to `anon` + `authenticated`. The table keeps authenticated-only RLS; `answers`/`usage` stay
   private.
6. **Client fallback.** `src/lib/read/live.ts` + `useMarketRead()` validate the row, apply freshness
   (fresh <20 min, stale 20–45 min, expired >45 min → labeled demo fallback), poll on load, focus and
   every 5 minutes, and derive `exposure` (real positions vs setup levels) and `since` (diff against
   the last seen read id in localStorage).
7. **Degraded reads.** If Jev fails but Binance works, the function reuses the previous answers with
   fresh facts and stores `status = 'degraded'`. Only answers from the last `ok` read within 45
   minutes are reused, and a degraded read publishes no setups, because their odds were judged
   against levels this cycle recomputed. With no fresh `ok` read, nothing is written. If Binance is unreachable, nothing is written and
   the next cycle retries.

## Data flow

```
pg_cron (*/15) ──► pg_net ──► market-read (x-cron-secret)
                                  ├─ Binance vision → facts, pre-screen (max 6)
                                  ├─ buildState + buildQuestions
                                  ├─ TypeSafe Jev (jev-latest, retry 429/529, 20 s timeout)
                                  └─ mapAnswers + composeRead → market_reads (ok | degraded)
client: market_read_latest ──► useMarketRead ──► Home / Trade strip + levels / Sign-in preview
        market_reads (auth) ──► previous read by id ──► diff “Since your last visit”
```

## Verified (2026-09-29)

- `supabase db push` applied `market_reads`, the cron helper + retention and the public view.
- Function deployed with `--no-verify-jwt`; no header → 401, wrong Vault secret → 401, correct secret
  → 200 `ok` (18/18 coverage, Jev ~289 ms).
- Cron produced reads on schedule (e.g. 09:45:04 UTC) after extensions + Vault secrets + the
  idempotent `select public.schedule_market_reads()`.
- App live in the browser: `Demo data` badge gone, real verdict/stats/regime/setups/changes/meta,
  seen-id written, Trade strip and read dots from the same read. Two live verdicts observed
  (`No clear read`, `Wait.`).
- Degraded path: bad Jev key → 200 `degraded` using previous answers; restored key → `ok`.
- Security: the TypeSafe key is absent from `dist/` and client sources; anon can read the view but
  gets no rows from the table.

## Known gaps

- The “Since your last visit” diff needs an authenticated session (it fetches the previous row from
  the table); the anon Sign-in preview cannot show it. Verify after signing in across two cycles.
- Stale/offline visuals were not forced; freshness and offline decision paths are unit-tested, and
  the function returns 503 (no row) when Binance is unreachable.
- Verdict variety beyond `No clear read`/`Wait.` depends on the market; test rows can force the rest.
- The TypeSafe key appeared in CLI output during setup; rotate it in the console if that transcript
  is considered sensitive, then re-run `supabase secrets set --env-file`.

## Phase 6 — derivatives positioning + on-chain activity (2026-09-30)

- **Step 0 probe from Tokyo:** all six sources answered — Binance USDⓈ-M 81 ms, Gate 384 ms,
  Hyperliquid 100 ms, Coin Metrics 328 ms, DefiLlama 79 ms, mempool 316 ms.
- **Inputs:** derivatives facts (8h-normalised funding per venue and OI-weighted average, OI in USD
  with 1h/4h/24h changes, price-vs-OI, Gate 24h liquidations and long/short ratio) and daily on-chain
  facts (Coin Metrics netflow/exchange supply/active addresses, DefiLlama stablecoin supply, live
  mempool) are stored in `market_reads.inputs`; per-source health is in `inputs_health`. A failing
  source is omitted, never fabricated; OI windows and the fee median fall back to stored snapshots.
- **Questions:** `positioning` (crowded_long / crowded_short / building_leverage / deleveraging /
  balanced) and `onchain_alignment` (supports / contradicts / unclear), sent only when the matching
  facts are present; regime, stance and risk instructions mention them when present.
- **UI:** "Why this read" is 8 wells (4 x 2 on desktop, 2 columns below 760px) and shows
  "Unavailable" when a source failed; new Changes events for funding sign flips, +-5% 1h OI moves,
  large 24h liquidations (BTC $50M / ETH $25M) and 3+ days of exchange outflows; the Home meta strip
  carries the Coin Metrics attribution (CC BY-NC 4.0, personal non-commercial use).
- **Deployment gotchas found:** Coin Metrics pages per asset, so fetch btc and eth separately;
  DefiLlama `stablecoincharts/all` uses unix-second dates and `totalCirculatingUSD.peggedUSD`.
- **Verified live:** all six sources ok, latest payload shows the two new wells with real numbers,
  and a pipeline test covers Binance futures failing while Gate + Hyperliquid answer.
