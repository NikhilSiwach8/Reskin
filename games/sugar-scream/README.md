# Sugar Scream

A Halloween reskin of the **pay-anywhere tumbling slot** format made famous by Pragmatic Play's *Sweet Bonanza*, built for [Stake Engine](https://stake-engine.com/). It has a 6x5 board of haunted candy, tumbles, a Skull Lollipop scatter and Jack-o'-Lantern multipliers, plus three bonuses this format doesn't have:

| New bonus | What it does |
|---|---|
| **Witch's Spell** | Base game, 1 in 56 spins: the Witch flies over the board before it is evaluated and turns a handful of candies into one kind, always creating a win. |
| **Trick or Treat** | Exactly 3 Skull Lollipops (one short of free spins) start a doorstep pick bonus: knock on up to 3 of 9 doors for Treats (1x to 50x), Tricks, or the Golden Lollipop, which awards free spins. |
| **Haunted Cauldron** | In free spins, the Jack-o'-Lanterns on each winning spin are poured into a Cauldron that keeps multiplying every later win, instead of only the spin they land on. |
| **Full Moon** (super free spins) | 5+ Lollipops: 12 spins, the Cauldron starts at x5 and every Jack-o'-Lantern counts double. |
| **Loot Box** | Drops on 1 in 1,500 base spins, or buy it for 92x: open one of 6 boxes for a Big (15x+), Mega (40x+), Monster (100x+) or Sugar Scream (500x+) win, or the 5,000x Max Win (1 in 1,000 boxes). |

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
| `npm run check:build` | Play the production build from a CDN-style sub-folder; fails on any 404, page error or balance mismatch |

## Math summary

The published book set has 100,000 natural books for base and Ante Bet and 35,000 / 30,000 for the Haunted Cauldron / Full Moon buys (their books are about 13x larger, and this keeps the math upload in one zip under 50 MB), seed 1313, target RTP 96%. Exact figures are in [docs/MATH_REPORT.md](docs/MATH_REPORT.md) and `public/math.json`. They are exact for that book set and its weights; they are **not** a certification.

| Mode | Cost | RTP | Hit rate | Std dev | Max win | Max win frequency |
|---|---|---|---|---|---|---|
| base | 1x | 96.00% | 1 in 2.25 | 11.81x | 5,000x | 1 in 1.45 million (estimate) |
| ante (Ante Bet) | 1.25x | 96.00% | 1 in 2.27 | 14.67x | 5,000x | 1 in 2.1 million (estimate) |
| bonus (Buy Haunted Cauldron) | 100x | 96.00% | 1 in 1.00 | 130.14x | 5,000x | 1 in 200,000 buys (estimate) |
| fullmoon (Buy Full Moon) | 300x | 96.00% | 1 in 1.00 | 298.31x | 5,000x | 1 in 18,347 buys (estimate) |
| lootbox (Buy Loot Box) | 92x | 96.00% | 1 in 1.00 | 271.96x | 5,000x | 1 in 1,000 buys |

Base-game feature frequencies: Witch's Spell 1 in 58, Loot Box 1 in 1,405, Trick or Treat 1 in 72, Haunted Cauldron free spins 1 in 370, Golden Lollipop (Trick or Treat into free spins) 1 in 995, Full Moon 1 in 4,094. In the base game, Trick or Treat returns 19.1% of RTP and Witch's Spell 10.2%.

Ante Bet triggers free spins about 1.7 times as often (1 in 215) and Trick or Treat about 1.5 times as often (1 in 49). The weighting adjusts the raw simulation only moderately: rounds paying at least the cost are 0.94x as likely as simulated in base and in Ante Bet. Buy prices follow each feature's simulated value (raw 101.8% for Haunted Cauldron at 100x, 103.8% for Full Moon at 300x). The 5,000x cap is reached only through free spins; its probability comes from a forced free-spin search (see the report).

## Deploying to Stake Engine

Build the upload zips with `npm run math:publish && npm run build && npm run release`. This verifies every book and lookup row, then checks the production build (`npm run check:build`: it serves `dist/` from a CDN-style sub-folder, plays spins and both buys, and fails on any missing asset, page error or balance mismatch). Finally it writes two zips to `release/`, each under 50 MB:

- `sugar-scream-math.zip` (about 41 MB): `index.json`, plus `books_<mode>.jsonl.zst` and `lookUpTable_<mode>_0.csv` for `base`, `ante`, `bonus` and `fullmoon`.
- `sugar-scream-frontend.zip` (about 8 MB): the static build, with `index.html` at the root.

1. **Math.** Upload the contents of `sugar-scream-math.zip` in the dashboard's math section.
2. **Frontend.** Upload `sugar-scream-frontend.zip`. The build is static, uses relative paths, and bundles all fonts and art, so it makes no external requests. The dev panel and local RGS are left out.
3. **Launch / test / approval.** Same as [Midnight Vault](../midnight-vault/README.md#deploying-to-stake-engine): test authenticate, play, end-round, resume, replay, social mode and the jurisdiction flags on the real RGS, then submit replay IDs per mode.

## Layout and animation

- **Layout** (after the format's best-known Stake titles): bottom left has a menu button that opens a settings popover (music and effects volume sliders, reduced motion, intro screen, Game Info), the Bonus tile and the balance. Bottom right has a big Spin button with Autoplay, Turbo and Sound beside it, and the bet with −/+ under it. The win meter and message bar sit under the board, and the board uses the full height between the two control groups (on phones the groups sit under the board). The board is fitted from the measured HUD on every resize, rotation and HUD size change. In landscape it takes the larger of two fits: between the two control groups, or above them at full width with room left for the free-spin panels. In portrait the spare height is shared out evenly around the board, the message and win stack, and the controls. On short landscape screens (phones turned sideways) the logo moves to the top right corner, the message bar moves to the top, and the free-spin panels shrink to one slim column. The Bonus Games sheet fits the screen without scrolling. A bet change there only updates the prices, so the cards don't reload. The Bonus tile opens a Bonus Games sheet: Ante Bet, Haunted Cauldron, Full Moon and Loot Box cards with art, a volatility bar, the price and a Buy button (the Ante card has the sliding toggle), plus a balance and bet panel with a bet slider.
- **Animated scene** (`src/client/game/ambience.ts`, `scene.ts`): the background slowly breathes and drifts, and mode-coloured particles float up (sugar sparkles, brew bubbles in Haunted Cauldron, embers in Full Moon). Bats flap across now and then, and the base and free-spin scenes cross-fade. The frame has a pulsing glow and a flickering pumpkin. Symbols breathe, a random one wiggles now and then, and Jack-o'-Lanterns flicker. Landings squash and spring back, wins glow, big clusters, feature triggers and the max win shake the board, the Win meter counts up, and the win screens rain candy.
- **Presentation in the style of the format's best-known title:** each column drops in as a stack under gravity. Once 3 Skull Lollipops have landed, the remaining columns hold back and glow. Winning candies swell, jiggle and glow, then shatter into shards, and survivors fall with gravity while new candies drop in. A message bar under the board shows "12 × [candy] PAYS $1.20" during tumbles, the running win or free-spin total, and tips between rounds. In free spins, Jack-o'-Lanterns blast (shock ring, flash, shake) before their values fly to the Cauldron. Free spins open with a "Congratulations! You have won 10 free spins" screen and close with "You have won $X in N free spins". The panel counts spins left. In the bonuses every hit gets its own splash as it lands. In free spins that means every paying tumble, plus the spin's total once the Jack-o'-Lanterns multiply it. In Trick or Treat it means each Treat. The winning spin that triggered the bonus gets one too. The Loot Box prize reveal is that bonus's hit screen. A bonus round closes on its total screen rather than repeating the splash. Every other winning round gets a splash: Nice Win (below 5x) or Sweet Win (5x to 15x) as a quick light splash, and Big (15x), Mega (40x), Monster (100x), Sugar Scream (500x) and Max Win punching in tier by tier over a fountain of candy and gold coins. Then the total win appears at once (no count-up).
- **Music** (`src/client/audio.ts`): the supplied Halloween track, cut on its 8-bar phrase boundaries (about 90 BPM, 21.3 s per phrase) into seamless loops, one per area, cross-faded as the bonus doors close and open:

  | Area | Section of the track | File |
  |---|---|---|
  | Base game | Intro and build (0:00–0:42) | `music_base.mp3` |
  | Trick or Treat, Loot Box | The build (0:21–0:42) | `music_feature.mp3` |
  | Haunted Cauldron free spins | The drop (0:42–1:04) | `music_free.mp3` |
  | Full Moon free spins | The peak (1:04–1:25) | `music_fullmoon.mp3` |
  | Big Win and above, Loot Box prize, Max Win | Sting: the drop's first two bars | `sting_bigwin.mp3` |
  | Free spins total screen | Sting: the track's ending | `sting_end.mp3` |

  The loop under a sting dips and comes back after it. The cuts are made with ffmpeg from `art/source/audio/halloween-music.mp3`. If the files can't load, the old procedural music-box loop plays instead. The music slider, music switch and mute all control it.
- **Animated interface:** floating logo, breathing spin button, light sweep and hop on Buy, glowing Ante when on, pulsing info button, bubbling Cauldron panel and breathing Trick-or-Treat doors. Everything stops with reduced motion.

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
- **Music licence:** the supplied Halloween track (`art/source/audio/halloween-music.mp3`, "prettyjohn1-halloween-halloween-music-620626") must be licensed for commercial use before release. The sound effects are procedural (Web Audio synthesis).
- **Devices:** only headless Chromium was tested. Real phones, Safari and Firefox still need testing.
- **English only**; other `lang` values fall back to English.
