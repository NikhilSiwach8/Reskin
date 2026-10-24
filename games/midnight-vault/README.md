# Midnight Vault

A 5x5, 15-line Halloween video slot for [Stake Engine](https://stake-engine.com/): a haunted bank that opens only at midnight, Cursed Relic expanding wilds with multipliers, four base-game features, three bonus paths and a four-stage finale.

The repository contains everything that makes up a Stake Engine game:

| Part | What it is | Where |
|---|---|---|
| Outcome engine | Deterministic TypeScript rules engine (reels, paylines, relic expansion, every feature) | `src/engine/` |
| Math pipeline | Simulates rounds, writes Stake RGS files (`index.json`, `books_*.jsonl.zst`, `lookUpTable_*_0.csv`) and a math report | `src/math/` |
| Game client | PixiJS 8 + DOM UI static web app that replays RGS outcomes | `src/client/`, `index.html` |
| Local RGS | Vite dev-server mock of the documented Stake RGS API, serving the generated books | `src/rgs/mockRgs.ts` |
| Art | Original vector art set with an SVG to WebP render pipeline | `tools/art/`, `art/svg/`, `public/assets/` |
| Tests | 39 unit tests (vitest) and a 12-scenario browser smoke test (Playwright) | `tests/`, `tools/smoke.mjs` |
| Docs | Rules and feature-state documentation, asset manifest, math report | `docs/` |

## Quick start (local prototype)

Requires Node 22.15+ (native Zstandard support).

```bash
cd games/midnight-vault
npm install
npm run math:dev     # ~40 s: generates math-output/dev for the local RGS
npm run dev
```

Open <http://localhost:5173/?sessionID=dev&rgs_url=localhost:5173/rgs&lang=en&currency=USD>.

The local RGS starts every new `sessionID` with a 1,000.00 USD balance and offers bet levels from 0.10 to 100.00. In development a **DEV** panel (top right) plays a real book of a chosen type: loss, line win, relic expansion, big win, each feature, each bonus path, Vault Breach or max win. Those rounds use the normal play → validate → present → end-round path, so the panel never bypasses validation or balance handling.

Useful launch parameters: `social=true` (stake.us wording), `currency=EUR`, `lang=de` (falls back to English), and `replay=true&game=x&version=1&mode=base&event=<book id>` (bet replay).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with the local RGS |
| `npm test` | Unit tests: paylines, wilds, expansion, multipliers, every feature, free-spin accounting, win cap, book validation, weights |
| `npm run test:e2e` | Starts Vite and plays 12 scenarios in headless Chromium at desktop and phone sizes; checks rounds settle exactly with no page errors (needs `math:dev` first) |
| `npm run typecheck` | TypeScript strict check |
| `npm run math:dev` | 20,000 books per mode in `math-output/dev` (development) |
| `npm run math:publish` | 100,000 books per mode in `math-output/publish`, plus `public/math.json` for the rules panel |
| `npm run math -- --books N --out DIR --seed S --target 0.96` | Custom run |
| `npm run build` | Typecheck and build the static client into `dist/` |
| `npm run art` | Rebuild SVG sources, renders and runtime WebP/atlas from `tools/art/*.mjs` |
| `npm run art:painted` | Optional painted-art pass through the OpenAI Images API (see Art) |
| `node src/math/tune.ts base 200000` | Raw (unweighted) feature statistics for tuning; run with `node --experimental-strip-types` |

## Architecture

```
            offline                                   Stake Engine                    browser
src/engine (rules) ──> src/math (simulate, weight) ──> RGS (stores books, picks  ──> src/client (validate + replay)
                       books_*.jsonl.zst                by weight, settles money)      PixiJS stage, DOM UI, audio
                       lookUpTable_*_0.csv
                       index.json
```

- **Outcomes are decided offline.** The engine plays complete rounds and records each as a *book* of events. The RGS picks a book by weight at bet time. The client only animates the events it receives, and checks them with the same validator the tests use (`src/engine/validate.ts`). Animation timing never affects an outcome.
- **Engine modules:** `config.ts` (all rules and numbers), `reels.ts` (deterministic strips), `grid.ts`, `evaluate.ts` (paylines and multipliers), `relics.ts` (expansion, surge, overload), `round.ts` (feature orchestration and events), `validate.ts`, `rng.ts` (seeded xoshiro128**).
- **Client modules:** `main.ts` (round controller, RGS flow, autoplay, replay, resume), `rgs.ts` (documented RGS HTTP API), `game/stage.ts` (scene and responsive layout), `game/reels.ts`, `game/effects.ts` (relic blocks, paylines, particles, chains, phantom, clock, vault door), `game/player.ts` (event playback), `game/tween.ts`, `ui/hud.ts`, `ui/rules.ts` (rules generated from the engine config), `ui/text.ts` (social-mode wording), `audio.ts` (procedural Web Audio), `money.ts` (integer money formatting).
- **Money:** books use integer centi-bet; RGS amounts are integer micro-units. A win is `bet * centi / 100`, which is exact for every bet level.

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the full rules, feature state machines and the book event contract.

## Math summary

Published book set: 100,000 natural books per mode, seed 1313, target RTP 96%. The exact figures are in [docs/MATH_REPORT.md](docs/MATH_REPORT.md) and `public/math.json`. They are exact for that book set and its weights; they are **not** a certification.

| Mode | Cost | RTP | Hit rate | Std dev | Max win | Max win frequency |
|---|---|---|---|---|---|---|
| base | 1x | 96.00% | 1 in 3.62 | 16.42x | 5,000x | 1 in 7.4 million (estimate) |
| bonus (Buy Bonus) | 100x | 96.00% | every round pays | 148.33x | 5,000x | 1 in 25,000 buys (estimate) |

Base-game feature frequencies in the published set: The Thirteenth Hour 1 in 71, Lockdown Spin 1 in 208, Phantom Heist 1 in 215, Spectral Respin 1 in 216, Three Keys to the Vault 1 in 219, The Vault Breach 1 in 270,271 (exact). The weighting adjusts the raw simulation moderately: in base, rounds paying at least 1x are 0.93x as likely as simulated; in the bonus buy, rounds paying at least the 100x cost are 0.84x as likely.

## Deploying to Stake Engine

1. **Math.** Run `npm run math:publish`. Upload the five files in `math-output/publish/` (`index.json`, `books_base.jsonl.zst`, `books_bonus.jsonl.zst`, `lookUpTable_base_0.csv`, `lookUpTable_bonus_0.csv`) in the Stake Engine dashboard. The RGS verifies on upload that each lookup-table payout matches its book. Math cannot be changed after approval.
2. **Frontend.** Run `npm run build` and upload the contents of `dist/`. The build is fully static, uses relative paths, and bundles all fonts and assets (no external requests, as Stake's strict XSS policy requires). The dev panel and local RGS are not included in the build.
3. **Launch.** Stake launches the game with `sessionID`, `rgs_url`, `lang`, `currency`, `device`, `social` (and `replay`, `game`, `version`, `mode`, `event` for bet replay). The client reads all of these; nothing is hard-coded.
4. **Test on the real RGS** with the dashboard test session: authenticate, play, end-round, resume of an active round, replay, social mode, and the jurisdiction flags (turbo, autoplay, buy feature, spacebar, slam stop, minimum round duration).
5. **Approval.** Submit with replay event IDs per mode: normal win, big win, win cap, loss and bonus trigger. Book IDs for each case can be found in `books_*.jsonl.zst` (field `criteria` and the events). Create the game tile in the dashboard Tile Editor.

## Art

The supplied concept board (1536x1024) is too small to cut usable assets from, and the OpenAI image API in this environment had no credits. So every asset was hand-authored as layered vector art in code (`tools/art/*.mjs`), following the concept's direction and the brief's palette. `npm run art` renders them through headless Chromium to high-resolution PNGs, then to runtime WebP plus a symbol atlas. See [docs/ASSETS.md](docs/ASSETS.md) for the full manifest.

For a painted, more detailed look, run `OPENAI_API_KEY=... npm run art:painted -- --reference path/to/concept.png`. It writes `art/painted/<name>.png`, and `npm run art` then uses those instead of the vector renders. Review every image before shipping: Stake requires unique assets with no text or third-party marks.

## Verified

Checked in this environment (headless Chromium at 1600x900, 1280x720, 800x450, 844x390, 390x844, 360x640 and the 400x225 mini-player size):

- All 39 unit tests pass, and all 12 end-to-end scenarios settle to the cent with no page errors (`npm run test:e2e`).
- Base game, Cursed Relic expansion and multipliers, Lockdown Spin, Phantom Heist, Spectral Respin, The Thirteenth Hour, all three Three Keys paths, retriggers, The Vault Breach (all four stages), max win, big-win presentation.
- Haunted Ledger and Relic Overload indicators come from engine events.
- Rules/paytable panel with payline diagrams, RTP per mode, max win, disclaimer; social-mode wording.
- Spacebar spin, slam stop, turbo, reduced motion, mute with separate music and effects, autoplay with confirmation, bet replay, active-round resume, missing-asset fallback, production build without dev code.

## Unfinished / not verified

- **Not deployed to Stake Engine.** No Stake Engine account was available here. The client and math are built to the documented RGS contract and tested against the local mock, but not against the real RGS or dashboard.
- **Art is vector, not painted.** The style follows the concept but is simpler than the concept board's painted look (especially the frame and bonus backgrounds). The painted pass is ready to run but has not been run.
- **Sound is procedural.** Original synthesised effects and an ambient bed; no composed music track.
- **Devices.** Only headless Chromium was tested (including phone and mini-player viewport sizes). Real iOS/Android devices, Safari and Firefox still need testing.
- **Official Web SDK not used.** Stake accepts any static stack; this client is custom PixiJS rather than the Svelte-based Web SDK.
- **Math is not certified.** Figures are exact for the published book set. The win-cap probability is a simulation-based estimate (see the report).
- **Localization:** English only, which Stake allows; other `lang` values fall back to English.
- **Accessibility:** keyboard play (spacebar, tab focus) and reduced motion are supported; full screen-reader support is not.
