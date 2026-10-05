# Changelog

All notable changes to Dispel are documented in this file. Keep the newest version at the top.
The app version lives in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`
(plus the sign-in top bar in `src/features/auth/LoginForm.tsx`); tag releases as `vX.Y.Z`.

## [0.1.7] — 2026-10-05

### Download size
- Windows installers drop from ~207 MB to a few MB: `webviewInstallMode` is now
  `embedBootstrapper` (Microsoft's ~2 MB bootstrapper installs WebView2 only where it is missing)
  instead of `offlineInstaller`, which carried the full runtime in every `.exe` and `.msi`.
- Size-first `[profile.release]` in `src-tauri/Cargo.toml` (LTO, one codegen unit, `opt-level = "s"`,
  strip, `panic = "abort"`): the Linux binary measures 14.0 MB → 4.2 MB (3.7 MB → 1.7 MB
  compressed). Release builds take longer in CI.
- Only the Latin, Latin Extended and (Geist Mono) symbols font subsets are bundled
  (`src/styles/fonts.css`); the Cyrillic, Greek and Vietnamese files are no longer shipped (~110 KB).

## [0.1.6] — 2026-10-04

### Site
- The download page plays the 15-second motion reel right above the download buttons, at the
  column width (`docs/media/dispel-preview.mp4`, a 1080p web encode of
  `design/motion/dispel-reel.mp4`, ~4 MB, with the end card as its poster). It autoplays muted and
  loops; **Sound on** restarts it from the top with the score and lets it play once, ending on the
  end card above the downloads. Pause/Play sits under the video and on the video itself. The frame
  carries the app's live border, which makes one lap per loop and stops when the video stops. With
  reduced motion the reel waits on its poster until played.
- Shorter intro that no longer repeats the reel: "Crypto paper trading" / **Real markets. No real
  money.** The paragraph under it is gone (the platforms are on the buttons) and "no exchange keys"
  moved into the Data note.

## [0.1.5] — 2026-10-04

### Trade chart
- Indicators: EMA 20, EMA 50, EMA 200 and SMA 20 drawn over the candles, and RSI 14 in its own
  pane below the price pane (30 / 70 guides, 50 midline). Chips in the chart toolbar switch them on
  and double as the legend; EMA 20 and EMA 50 are on by default. The choice is remembered on the
  device. Active values join the OHLC readout and follow the crosshair. Design:
  `design/trade-indicators.html`.
- New timeframes: **1w** and **1mo** (Binance `1M`, labelled so it cannot be read as 1 minute).
- The candle price scale now uses the market's price precision. Low-priced pairs (PENGU, DOGE)
  previously collapsed onto 0.01 steps, which also misplaced the live-price tip.
- The Setup levels and Volume toggles wrap together, so Volume never sits alone on a row.
- Live kline ticks that arrive before a market's history has loaded are ignored instead of being
  appended to the previous market's series.

### Market read (Jev)
- `ema` and `rsi` moved to `src/lib/market/indicators.ts`, shared by the chart and the Edge
  Function. EMA is now seeded with the SMA of its first period (TradingView-style) and both return
  `null` during warm-up instead of 0 or an unseeded value, so `ema50` 4h / `rsi1h` facts can shift
  slightly and a short 1h history no longer reads as an RSI cross of 50.

## [0.1.4] — 2026-10-04

### Paper transfers
- Crypto deposit entry prices are read on the server. Deposits and withdrawals now go through the
  `paper-order` Edge Function (`action: "transfer"`), which validates the asset, network and
  address with `src/lib/networks.ts` and fetches the live Binance price for deposits itself.
  Clients can no longer set a deposit's average entry price (and with it realized P/L). No UI change.
- Migration `20261004000002_server_priced_transfers.sql` replaces `transfer_paper_crypto` with a
  `p_user_id` variant executable by the service role only. Redeploy `paper-order` together with it.
- Removed OP from the transferable assets; its market was dropped in 0.1.2, so transfers already
  failed with "Unsupported asset.".
- `Parsed` moved to `src/types/parsed.ts` so the Edge Function can import the address validators
  without pulling in `decimal.js`.

## [0.1.3] — 2026-10-04

### Paper trading
- Fill prices are read on the server. Placing an order and filling a limit order now go through the
  new `paper-order` Edge Function, which checks the user's JWT, fetches the live Binance price
  itself and calls `place_order` / `fill_order`. Clients can no longer send their own fill or
  reference price (previously a direct RPC call could fill a limit buy at any price below the
  limit). No UI change.
- Migration `20261004000001_server_priced_fills.sql` replaces both RPCs with `p_user_id` variants
  executable by the service role only; `cancel_order` is unchanged. Deploy the function together
  with the migration: older app builds can no longer place or fill orders once it is applied.

## [0.1.2] — 2026-10-04

### Market read (Jev)
- Universe is now **24 Binance USDT spot pairs**: added ENA, INJ, VIRTUAL, ONDO, ASTER, PENGU, SEI
  and AERO; removed DOT and OP. Breadth, the majors and candidate selection all draw from the new
  list (`src/lib/markets.ts`, shared by the app and the edge function).

### Site
- Added `docs/privacy.html` (linked from the download page) so the Google OAuth consent screen has
  a home page and privacy policy URL for publishing the app.

## [0.1.1] — 2026-10-04

### Market read (Jev)
- Risk is published as the highest level at least 40% likely, so a medium/high split reads as high
  instead of averaging down. A raised risk carries `stats.riskRaisedPct`, the chance of that level
  or higher.
- Low-confidence reads carry `stats.split`, the two most likely stances with their percentages.
- The 0.5 confidence floor now also gates bias (`mixed`), positioning and on-chain alignment
  (unclear) instead of publishing low-confidence labels.
- Degraded reads reuse answers only from an `ok` read at most 45 minutes old, and publish no setup
  odds because their levels were recomputed this cycle. They carry `judgedTime`, the time of the
  reused judgment; with no fresh `ok` read the function writes nothing and the next cycle retries.

### Home
- Market read: degraded reads show a `partial · judged HH:MM UTC` chip and dim the verdict;
  Confidence shows the two-way stance split with bars, labelled "close split" or "spread out";
  Risk explains a raised level ("43% chance of high, so it reads as high").
- Setups: a degraded cycle shows "Setups paused for this cycle" instead of "Nothing meets the bar".
  Odds bars gained a Mist tick at 50% and a "near even" marker between 40–60%; "Confidence" is
  renamed "Pattern", and hatching now reflects the weaker of pattern clarity and odds certainty.

### CI
- Tag releases now publish automatically (no draft step), and the download page falls back to the
  releases page when no release is published yet.

### Docs
- `DESIGN.md`, `README.md` and `docs/specs/2026-09-29-jev-market-read.md` document the split,
  raised risk, partial reads and the new odds treatment.
- New comparison mock `design/home-confidence.html` (current vs shipped).

## [0.1.0] — 2026-10-02

- First public release: Windows, macOS (Apple Silicon + Intel) and Linux installers built on GitHub
  Actions, download page at https://aangwijaya.github.io/dispel/.
- Tauri v2 + React 19 + Supabase paper-trading terminal: live Binance public data, paper orders and
  balances, portfolio, activity, and the Jev market read with the Astrolabe sigil artwork.
- Email/password and Google sign-in (loopback OAuth with PKCE).
