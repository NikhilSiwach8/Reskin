# Sugar Scream

A Halloween reskin of the **pay-anywhere tumbling slot** format made famous by Pragmatic Play's *Sweet Bonanza*, built for [Stake Engine](https://stake-engine.com/). It has a 6x5 board of haunted candy, tumbles, a Skull Lollipop scatter and Jack-o'-Lantern multipliers, plus three bonuses this format doesn't have:

| New bonus | What it does |
|---|---|
| **Witch's Spell** | Base game, 1 in 40 spins: the Witch flies over the board before it is evaluated and turns a handful of candies into one kind, always creating a win. |
| **Trick or Treat** | Exactly 3 Skull Lollipops (one short of free spins) start a doorstep pick bonus: knock on up to 3 of 9 doors for Treats (1x to 50x), Tricks, or the Golden Lollipop, which awards free spins. |
| **Haunted Cauldron** | In free spins, the Jack-o'-Lanterns on each winning spin are poured into a Cauldron that keeps multiplying every later win, instead of only the spin they land on. |
| **Full Moon** (super free spins) | 5+ Lollipops: 12 spins, the Cauldron starts at x5 and every Jack-o'-Lantern counts double. |

Theme, art, names and code are original; only the game format is borrowed. See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the full rules, the reskin mapping, the round flow and the book event contract.

| Part | What it is | Where |
|---|---|---|
| Outcome engine | Deterministic TypeScript rules engine (pay-anywhere evaluation, tumbles, every feature) | `src/engine/` |
| Math pipeline | Simulates rounds, writes Stake RGS files (`index.json`, `books_*.jsonl.zst`, `lookUpTable_*_0.csv`) and a math report | `src/math/` |
| Game client | PixiJS 8 + DOM UI static web app that replays RGS outcomes | `src/client/`, `index.html` |
| Local RGS | Vite dev-server mock of the Stake RGS API, serving the generated books | `src/rgs/mockRgs.ts` |
| Art | Painted art in `art/source/`, imported to WebP by `tools/import-painted.py` (symbols, buttons, panels, backgrounds, screens, effects). Vector SVG fallbacks come from `tools/render-art.mjs` | `art/source/`, `tools/import-painted.py`, `tools/render-art.mjs`, `public/assets/` |
| Tests | 21 unit tests (vitest) and a 12-scenario browser smoke test (Playwright) | `tests/`, `tools/smoke.mjs` |

## Quick start

Requires Node 22.15+ (native Zstandard support).

```bash
cd games/sugar-scream
npm install
npm run math:dev     # ~1.5 min: 20,000 books per mode in math-output/dev for the local RGS
npm run dev
```

Open <http://localhost:5173/?sessionID=dev&rgs_url=localhost:5173/rgs&lang=en&currency=USD>.

Every new `sessionID` starts with 1,000.00 USD. In development a **DEV** panel (top right) plays a real book of a chosen type (loss, win, long tumble chain, big win, Witch's Spell, Trick or Treat, Golden Lollipop, Haunted Cauldron, Full Moon, retrigger, each buy, max win) through the normal play, validate, present and end-round path.

Launch parameters: `social=true` (stake.us wording), `currency=EUR`, `lang=de` (falls back to English), and `replay=true&game=x&version=1&mode=base&event=<book id>`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with the local RGS |
| `npm test` | Unit tests: pays, tumble gravity, compact tumble replay, every feature, Cauldron arithmetic, retrigger accounting, validator, determinism, weights |
| `npm run test:e2e` | Plays 12 scenarios in headless Chromium at desktop and phone sizes; checks that rounds settle to the cent with no page errors (needs `math:dev` first) |
| `npm run typecheck` | TypeScript strict check |
| `npm run math:dev` | 20,000 books per mode in `math-output/dev` (fast compression) |
| `npm run math:publish` | 100,000 books per mode in `math-output/publish` (zstd level 19), plus `public/math.json` for the rules panel |
| `node --experimental-strip-types src/math/tune.ts base 200000` | Raw (unweighted) feature statistics for tuning |
| `npm run art` | Rewrite the SVG assets in `public/assets/` |
| `npm run art:painted` | Import painted art: drop `sym_<ID>.webp`/`.png` (transparent) into `art/source/`; the game uses it instead of the SVG |
| `npm run build` | Typecheck and build the static client into `dist/` |

## Math summary

The published book set has 100,000 natural books per mode, seed 1313, target RTP 96%. Exact figures are in [docs/MATH_REPORT.md](docs/MATH_REPORT.md) and `public/math.json`. They are exact for that book set and its weights; they are **not** a certification.

| Mode | Cost | RTP | Hit rate | Std dev | Max win | Max win frequency |
|---|---|---|---|---|---|---|
| base | 1x | 96.00% | 1 in 2.24 | 13.97x | 5,000x | 1 in 87 million (estimate) |
| ante (Ante Bet) | 1.25x | 96.00% | 1 in 2.23 | 12.94x | 5,000x | 1 in 21 million (estimate) |
| bonus (Buy Haunted Cauldron) | 100x | 96.00% | 1 in 1.00 | 130.59x | 5,000x | 1 in 200,000 buys (estimate) |
| fullmoon (Buy Full Moon) | 300x | 96.00% | 1 in 1.00 | 300.62x | 5,000x | 1 in 18,347 buys (estimate) |

Base-game feature frequencies: Witch's Spell 1 in 43, Trick or Treat 1 in 72, Haunted Cauldron free spins 1 in 370, Golden Lollipop (Trick or Treat into free spins) 1 in 995, Full Moon 1 in 4,094. In the base game, Trick or Treat returns 19.1% of RTP and Witch's Spell 10.2%.

Ante Bet triggers free spins about 1.7 times as often (1 in 215) and Trick or Treat about 1.5 times as often (1 in 49). The weighting adjusts the raw simulation only moderately: rounds paying at least the cost are 0.94x as likely as simulated in base and in Ante Bet. Buy prices follow each feature's simulated value (raw 102.6% for Haunted Cauldron at 100x, 104.3% for Full Moon at 300x). The 5,000x cap is reached only through free spins; its probability comes from a forced free-spin search (see the report).

## Deploying to Stake Engine

1. **Math.** Run `npm run math:publish` and upload the nine files in `math-output/publish/`: `index.json`, plus `books_<mode>.jsonl.zst` and `lookUpTable_<mode>_0.csv` for `base`, `ante`, `bonus` and `fullmoon`.
2. **Frontend.** Run `npm run build` and upload `dist/`. The build is static, uses relative paths, and bundles all fonts and art, so it makes no external requests. The dev panel and local RGS are left out.
3. **Launch / test / approval.** Same as [Midnight Vault](../midnight-vault/README.md#deploying-to-stake-engine): test authenticate, play, end-round, resume, replay, social mode and the jurisdiction flags on the real RGS, then submit replay IDs per mode.

## Verified

Checked in this environment (headless Chromium at 1600x900, 390x844, 360x640 and 844x390):

- 21 unit tests pass. All 12 end-to-end scenarios (loss, win, tumble chain, Witch's Spell, Trick or Treat, Golden Lollipop, Haunted Cauldron from the base game, Full Moon from Ante Bet, retrigger, both buys, max win) settle to the cent with no page errors.
- The client validates every book with the engine's validator before playing it, rebuilding every tumble from the compact events.
- Spacebar spin, slam stop, turbo, autoplay with confirmation and stop-on-feature, Ante Bet toggle, buy confirmation, mute plus separate music and effects switches, reduced motion, social-mode wording, replay mode, active-round resume.
- The production build contains no dev code and makes no external requests.

## Unfinished / not verified

- **Not deployed to Stake Engine** (no account here). Built against the documented RGS contract and tested against the local mock only.
- **Math is not certified.** Figures are exact for the published book set; the win-cap probability is a simulation estimate.
- **Art:** the game uses the supplied painted art throughout: all 11 symbols, the board frame, backgrounds for the base game and both free-spin modes, every HUD button and panel, the Trick-or-Treat street, doors and reveals, the loading, intro, free-spin intro and feature-complete screens, the five win screens (Big, Mega, Monster, Sugar Scream, Max Win), the Witch's Spell witch, and the spell and candy-pop effects. The vector SVGs in `public/assets/` remain only as fallbacks.
- **Sound is procedural** (Web Audio synthesis), with no composed music.
- **Devices:** only headless Chromium was tested. Real phones, Safari and Firefox still need testing.
- **English only**; other `lang` values fall back to English.
