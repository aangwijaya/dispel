# Changelog

All notable changes to Dispel are documented in this file. Keep the newest version at the top.
The app version lives in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`
(plus the sign-in top bar in `src/features/auth/LoginForm.tsx`); tag releases as `vX.Y.Z`.

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
