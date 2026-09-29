# Prompts: live market read with TypeSafe Jev (for opencode)

Paste these into opencode **one phase at a time**. Start each phase in the **Plan** agent (Tab), review
the plan, then switch to **Build**. opencode reads `AGENTS.md` automatically; these prompts add the
Jev-specific context it can't infer.

Checked against TypeSafe docs on 2026-09-28 (<https://docs.typesafe.ai/llms.txt>). If the API has
changed, the Phase 1 spike will show it before any real code is written.

---

## Before you start (human setup, not for the agent)

1. **TypeSafe account + API key**: <https://console.typesafe.ai/keys>. Try a request in the playground
   first: <https://console.typesafe.ai/playground>. Check pricing and rate limits in the console. The
   public docs don't list them.
2. **Keep the key off the client.** Never put it in `.env` with a `VITE_` prefix (Vite ships those
   into the bundle) and never in the Tauri app. It lives only as a Supabase secret.
3. **Supabase CLI** (already installed, v2.114): `supabase login`, then `supabase link --project-ref <ref>`.
4. **Secrets** (run these yourself after Phase 3 exists):
   ```bash
   supabase secrets set TYPESAFE_API_KEY=ts_...
   supabase secrets set READ_CRON_SECRET=$(openssl rand -hex 32)
   ```
5. **Extensions**: enable `pg_cron` and `pg_net` in the Supabase dashboard (Database → Extensions).
6. **Agent skill (optional, recommended)**: `npx skills add typesafe-ai/skills --skill typesafe-ai`
   (project-local; choose opencode when asked). If opencode doesn't pick it up, the prompts below
   point it at the docs URLs, which it can fetch itself.
7. **Region check**: Binance blocks some regions (the US in particular). The read runs on Supabase's
   servers, so Phase 1 checks that `data-api.binance.vision` answers from your project's region.

---

## Kickoff prompt (paste first, in Plan mode)

```text
We are replacing the demo market read on Home with a live one decided by TypeSafe Jev.
Read AGENTS.md, DESIGN.md Part C, docs/specs/2026-09-27-ui-refactor.md, src/types/read.ts,
src/lib/read/demo.ts and .claude/skills/typesafe-ai/SKILL.md before planning anything.

## What Jev is (read the docs, don't assume)
Jev is a "System One" decision model, NOT an LLM. It cannot write text. You POST a `state` (JSON) and
a map of typed `questions`, and it returns typed answers with probabilities:
- choice: pick one key from `criteria` (map, max 255) → { choice, probabilities, confidence }
- score: rate on an ordered rubric `criteria` (array, 2–10 levels) → { score, legend, probabilities, confidence }
- noul: yes/no → { noul: probability 0–1 } (no confidence)
Endpoint: POST https://api.typesafe.ai/v1/systemone, header `Authorization: Bearer <TYPESAFE_API_KEY>`,
body { model: "jev-latest", state, questions }. Errors: 401 bad key, 422 bad body, 429 rate limit,
529 overloaded (retry 429/529 with exponential backoff).
Question IDs (the map keys) are NOT sent to the model: every question's `instructions` must be
self-contained and point at the state with backticked paths, e.g. "Judge the setup described in
`candidates.SOL`". Score levels must each describe a concrete situation, not a bare label. Include a
no-match option where nothing may fit (e.g. setup type `none`). Typed output guarantees the shape,
not the truth: log raw answers so accuracy can be checked against what the market did next.
Docs index: https://docs.typesafe.ai/llms.txt. Fetch https://docs.typesafe.ai/api.md,
https://docs.typesafe.ai/primitives.md, https://docs.typesafe.ai/confidence.md and
https://docs.typesafe.ai/concepts/how-to-build-with-system-one.md before writing code, and follow them
over this prompt if they disagree.

## Division of labour (this is the core design rule)
- CODE computes every number and fact: prices, % changes, trend (higher highs/lows), RSI, volume vs
  7-day average, ATR vs 30-day median, breadth, support/resistance, invalidation/target levels,
  cushion %, events (level tests, volume spikes, volatility spikes), and all UI text.
- JEV makes only the judgments: regime, stance, bias, trend strength, risk, per-candidate
  "worth investigating", setup type and odds. One request per cycle with all questions fanned out
  (https://docs.typesafe.ai/patterns/fan-out.md).
- Explanations, caution lines and "What we see" bullets are deterministic TEMPLATES in code, filled
  from the computed facts and Jev's answers, written in the DESIGN.md C4 voice. Jev never writes copy.
- Confidence gating (docs/confidence.md): if the stance choice has confidence < 0.5, publish stance
  "unclear" ("No clear read"). Map stance confidence to the UI's Confidence stat:
  <0.5 Low, 0.5–0.9 Medium, >0.9 High.

## Architecture (security rules from AGENTS.md apply)
- The API key never reaches the client or the Tauri app. No VITE_ variable, no custom Tauri command.
- A Supabase Edge Function `market-read` (Deno, plain fetch, no SDK dependency) runs every 15 minutes
  via pg_cron + pg_net. It rejects any call without header `x-cron-secret` == env READ_CRON_SECRET.
- It fetches Binance public klines/tickers for the 18 markets in src/lib/markets.ts server-side
  (data-api.binance.vision), computes facts, calls Jev once, composes a MarketRead and inserts it into
  a new table `market_reads`.
- `market_reads`: id, created_at, as_of, status ('ok' | 'degraded'), model, read jsonb (the
  market-wide part of MarketRead), answers jsonb (raw Jev answers, for auditing/calibration), usage
  jsonb. RLS enabled; SELECT for authenticated; no insert/update/delete policies (only the service
  role writes). Index on created_at desc. A daily cron deletes rows older than 14 days.
- The client reads the latest row (on load, on window focus, and every 5 minutes), validates it with
  a sanitizer (AGENTS.md: validate every payload) and falls back to the labeled demo read if there is
  no row, the row is invalid, or it is older than 45 minutes (then show the DESIGN C5 "Stale read"
  state; the offline rule stays).
- Per-user parts stay client-side: Exposure check (open positions vs the read's setup levels) and
  "Since your last visit" (diff against the last read id the user saw, kept in localStorage).
- Pure logic (indicators, state builder, question set, answer mapper, composer, templates) lives in
  supabase/functions/_shared/read/ as plain TypeScript with no Deno or Node APIs, so vitest can test
  it. Extend the vitest include to cover it. The Edge Function file only does I/O.
- Naming: internal code may say jev (e.g. jevClient.ts); "JEV" never appears in UI copy (DESIGN C0).
  The TopBar "Demo data" badge disappears when the read comes from Jev and is fresh.

## Phases (stop after each for my review; keep typecheck/test/build green per AGENTS.md)
1. Spike: a throwaway script (scripts/jev-spike.ts, run with `npx tsx`, key from the shell env,
   never committed) that sends one realistic state + the full question set and prints the response,
   latency and usage. Also check that data-api.binance.vision answers. No app changes.
2. Engine: pure modules + unit tests with fixture klines and a recorded Jev response fixture.
3. Backend: migration for market_reads + RLS, the Edge Function, cron SQL (as a migration or a
   documented snippet), README setup steps.
4. Client: src/lib/read/live.ts (fetch + sanitize + staleness), wire Home/Trade/Login to use it with
   the demo fallback, Exposure check + since-diff from real data.
5. Verification + docs: run the function locally with `supabase functions serve`, trigger it once,
   confirm a row, open the app, confirm the badge and states. Update README and the spec.

Produce the plan for Phase 1 only now. List the exact question set (keys, types, criteria text)
you intend to send, and the exact state shape, so I can review them before anything runs.
```

---

## Reference: the question set to steer the plan toward

Give this to the agent if its proposal drifts. Keys are stable because the mapper depends on them.

**State** (object, English, compact; all numbers computed in code):
```json
{
  "as_of_utc": "2026-09-28T14:30:00Z",
  "universe": "18 Binance USDT spot pairs",
  "previous_read": { "stance": "wait", "regime": "cautious", "age_minutes": 15 },
  "breadth": { "up_24h": 12, "down_24h": 6 },
  "btc": { "change_24h_pct": 1.12, "trend_4h": "higher highs and higher lows", "rsi_1h": 58,
           "volume_vs_7d_pct": 18, "atr_vs_30d_median": 1.0,
           "nearest_resistance": 119200, "nearest_support": 115800, "distance_to_resistance_pct": 0.66 },
  "eth": { "...": "same fields" },
  "candidates": {
    "SOL": { "pattern_facts": "retest of broken resistance 208 held twice on rising volume",
             "price": 212.84, "invalidation": 206.5, "target": 219.0, "horizon": "15m-1h",
             "rsi_15m": 61, "volume_vs_20p": 2.1 }
  }
}
```

**Market-wide questions**
| key | type | criteria |
|---|---|---|
| `regime` | choice | `risk_off`, `cautious`, `neutral`, `constructive`, `risk_on`, each with a one-line description |
| `stance` | choice | `favorable` (clear direction, conditions support looking for setups), `wait` (mixed direction or elevated volatility; nothing worth chasing), `unclear` (too little happening to lean either way), `reduce_risk` (sellers in control or support broken; protect what you hold) |
| `bias` | choice | `bullish`, `bearish`, `mixed`, `neutral` |
| `trend_strength` | score | 5 levels from "no side in control" to "one side in firm control" → UI 0–100 as the probability-weighted level |
| `risk` | score | 3 levels: low / medium / high cost of being wrong right now |

**Per candidate** (code pre-screens at most 6 candidates; keys like `SOL_worth`)
| key | type | meaning |
|---|---|---|
| `<SYM>_worth` | noul | "Is the setup described in `candidates.<SYM>` worth a trader investigating now, given the market in `btc`, `eth` and `breadth`?" |
| `<SYM>_type` | choice | `breakout_retest`, `momentum_turn`, `range_break`, `rejection_at_resistance`, `none` |
| `<SYM>_target_first` | noul | "Will the price in `candidates.<SYM>` reach `candidates.<SYM>.target` before `candidates.<SYM>.invalidation` within `candidates.<SYM>.horizon`?" → UI "Odds" |
| `<SYM>_risk` | score | 3 levels |

Code keeps candidates with `worth ≥ 0.6`, at most 5, **ordered by horizon, never by odds** (DESIGN C3),
and confidence per setup = the `_type` choice confidence mapped to Low/Medium/High.

**Numbers that are never asked of Jev**: volatility level (from ATR ratio), breadth, levels, cushion,
evidence states, events, ribbon/shift (a shift = regime differs from the previous row).

---

## Follow-up prompts

**After reviewing the Phase 1 plan**
```text
Plan approved with these changes: <your edits>. Build Phase 1. Run the spike with TYPESAFE_API_KEY
from my shell (I'll export it). Show me the raw response, latency, usage, and whether
data-api.binance.vision answered. Don't touch src/ yet.
```

**Phase 2**
```text
Phase 1 looked right. Plan Phase 2 (pure engine in supabase/functions/_shared/read/ + vitest
coverage). Record the spike response as a fixture. The composer must output exactly the market-wide
fields of MarketRead from src/types/read.ts; don't duplicate those types, import them. Templates
follow DESIGN.md C4 (no emoji, no exclamation marks, no first person, one caution per read).
```

**Phase 3**
```text
Plan Phase 3: migration for market_reads + RLS (select for authenticated only), the market-read Edge
Function (x-cron-secret check, 429/529 backoff with at most 3 tries, 20s timeout, on Jev failure
insert status 'degraded' reusing the previous read's judgments and fresh facts), cron schedule every
15 minutes, retention cron daily. Document the secrets and cron setup in README.
```

**Phase 4**
```text
Plan Phase 4: src/lib/read/live.ts with a sanitizer for the market_reads row, freshness rules
(fresh <20 min, stale 20–45 min shows the stale state, >45 min falls back to demo with the Demo data
badge), polling on load/focus/5 min. Wire Home, the Trade context strip/levels and the Sign-in
preview through one hook. Exposure check from real positions vs setup invalidation levels;
"Since your last visit" from the last seen read id in localStorage.
```

**Phase 5**
```text
Verify end to end: supabase functions serve, trigger once with the cron secret, confirm the row,
run the app, check favorable/wait/unclear/reduce-risk rendering from real rows (insert test rows if
the market won't cooperate), stale and offline states, and that no request from the client ever
contains the TypeSafe key. Update README and docs/specs.
```

---

## Phase 6: derivatives positioning + on-chain activity

The live pipeline (Phases 1–5) is already built. This phase adds two new inputs to the Jev state.
Sources were probed on 2026-09-30. From this dev machine, Binance futures, Bybit, OKX and Deribit
were **blocked** (ISP), while **Hyperliquid** and **Gate.io** answered. The Edge Function runs from
the Supabase project in **ap-northeast-1 (Tokyo)**, so what matters is what answers from there: the
prompt makes the agent probe from the deployed function before relying on any source.

Personal, non-commercial project: Coin Metrics Community data (CC BY-NC 4.0) is allowed with attribution.

```text
Plan Phase 6: add derivatives positioning (funding rate, open interest) and on-chain activity to the
Jev read. Extend the existing engine in supabase/functions/_shared/read/ (marketData.ts, facts.ts,
state.ts, questions.ts, answers.ts, compose.ts, templates.ts, types.ts) and
supabase/functions/market-read/index.ts. Keep every rule from AGENTS.md and the kickoff prompt:
code computes all numbers and all copy; Jev only judges; every payload goes through a sanitizer;
pure logic stays testable with vitest; no new runtime dependency; the API key stays server-side.

## Sources (all free, no key)
Derivatives, per venue, each optional:
- Binance USDⓈ-M (largest venue, may be geo-blocked from Tokyo):
  GET https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT  (lastFundingRate, 8h)
  GET https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT
  GET https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=25
- Gate.io (verified reachable):
  GET https://api.gateio.ws/api/v4/futures/usdt/contracts/BTC_USDT  (funding_rate, 8h)
  GET https://api.gateio.ws/api/v4/futures/usdt/contract_stats?contract=BTC_USDT&interval=1h&limit=25
      (open_interest_usd, long_liq_usd, short_liq_usd, lsr_account)
- Hyperliquid, an on-chain perp venue (verified reachable):
  POST https://api.hyperliquid.xyz/info {"type":"metaAndAssetCtxs"}  (per coin: funding [HOURLY],
  openInterest [in coins], markPx, premium, dayNtlVlm)
  POST https://api.hyperliquid.xyz/info {"type":"fundingHistory","coin":"BTC","startTime":<ms>}
  Hyperliquid has no OI history: compute its OI change from our own stored snapshots.
On-chain (daily, about one day behind; refetch only when the UTC date changes, otherwise reuse the
previous market_reads row's on-chain facts):
- Coin Metrics Community: https://community-api.coinmetrics.io/v4/timeseries/asset-metrics
  ?assets=btc,eth&metrics=FlowInExNtv,FlowOutExNtv,SplyExNtv,AdrActCnt&frequency=1d&page_size=35&paging_from=end
  (10 requests / 6 s per IP; a "-status":"flash" value is preliminary). USDT/USDC: SplyCur.
- DefiLlama: https://stablecoins.llama.fi/stablecoincharts/all (total stablecoin supply).
- mempool.space: /api/v1/fees/recommended and /api/mempool (live BTC congestion, every cycle).

## Step 0: probe from the deployed region (before building on any source)
Add a probe mode to market-read: POST with the x-cron-secret header and {"probe":true} returns
per-source { ok, http_status, latency_ms } without calling Jev or writing a row. I will deploy and
run it once. Design so any source can be missing: record per-source health in a new
`inputs_health` jsonb column on market_reads (migration), and omit failed sources from the state.

## Facts code computes (pure functions + fixture tests per provider payload)
- Funding normalised to an 8h-equivalent rate (Hyperliquid is hourly × 8). Per coin: current,
  24h average, and an OI-weighted average across the venues that answered.
- Open interest in USD per venue and summed: change over 1h, 4h, 24h (%). Use Binance/Gate history
  where available, and our stored snapshots otherwise.
- Price vs OI relationship as numbers only (price change % and OI change % over the same window).
- Gate: 24h long vs short liquidations (USD) and the long/short account ratio.
- On-chain: BTC/ETH exchange netflow (today, 7-day sum, vs 30-day daily average), exchange supply
  30-day change %, active addresses vs 30-day average %, stablecoin supply 7d/30d change %, and the
  BTC mempool tx count and fastest fee vs a 7-day median kept from our own rows.
Derivatives facts apply market-wide (BTC, ETH) AND per setup candidate when that coin trades on a
venue. On-chain facts are market-wide only.

## State and questions
- State: add `derivatives` (with `venues_answered`) and `onchain` (with `as_of_date` per source)
  objects. Per candidate, add `candidates.<SYM>.derivatives` when available.
- Mention `derivatives` and `onchain` in the regime, stance and risk instructions.
- New market-wide Choice `positioning`, self-contained, e.g. "Given `derivatives`, how are traders
  positioned?" with criteria crowded_long / crowded_short / building_leverage / deleveraging /
  balanced, each with a concrete description.
- New market-wide Choice `onchain_alignment`: "Does the on-chain activity in `onchain` support,
  contradict, or say nothing clear about the price trend in `btc` and `eth`?"
  (supports / contradicts / unclear).
- Per candidate: include derivatives facts in the state that `<SYM>_worth` and
  `<SYM>_target_first` already read, and say so in their instructions. No new per-candidate question.

## UI (DESIGN.md C3; no engine name anywhere)
- "Why this read" grows from 6 to 8 wells: add "Positioning" and "On-chain". Lay them out 4 × 2 on
  desktop, 2 columns below 760px. The On-chain well shows its data date ("as of Sep 28"). A well
  whose source failed shows "Unavailable", not stale numbers.
- Changes panel: new code-detected events: funding flips sign, OI moves more than ±5% in 1h,
  24h liquidations above a threshold, 3+ days of exchange outflows. Voice per DESIGN C4.
- Meta strip: "On-chain data: Coin Metrics" (licence attribution). README: note the non-commercial
  licence and list every source.

## Verification
typecheck/test/build green; fixtures for every provider payload including error and partial
responses; a pipeline test where Binance fails but Gate and Hyperliquid answer; the probe run from
the deployed function (I'll paste you the output); a real row showing the new facts, the two new
answers and inputs_health. Store all new facts in the row so we can later check whether they improved
the read.

Plan only for now. Show me the updated state shape, the two new questions with full criteria text,
and the migration, before writing code.
```
