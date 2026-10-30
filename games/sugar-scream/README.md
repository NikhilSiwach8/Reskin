# Sugar Scream

A Halloween reskin of the **pay-anywhere tumbling slot** format made famous by Pragmatic Play's *Sweet Bonanza*, built for [Stake Engine](https://stake-engine.com/). It has a 6x5 board of haunted candy, tumbles, a Skull Lollipop scatter and Jack-o'-Lantern multipliers, plus three bonuses this format doesn't have:

| New bonus | What it does |
|---|---|
| **Witch's Spell** | Base game, 1 in 56 spins: the Witch flies over the board before it is evaluated and turns a handful of candies into one kind, always creating a win. |
| **Trick or Treat** | Exactly 3 Skull Lollipops (one short of free spins) start a doorstep pick bonus: knock on up to 3 of 9 doors for Treats (1x to 50x), Tricks, or the Golden Lollipop, which awards free spins. |
| **Haunted Cauldron** | In free spins, the Jack-o'-Lanterns on each winning spin are poured into a Cauldron that keeps multiplying every later win, instead of only the spin they land on. |
| **Full Moon** (super free spins) | 5+ Lollipops: 12 spins, the Cauldron starts at x5 and every Jack-o'-Lantern counts double. |
| **Pumpkin Patch** (in Full Moon) | When a Full Moon spin wins, each Jack-o'-Lantern has a 20% chance to split: a copy with the same value sprouts on a candy, counts in that spin's multiplier and is poured into the Cauldron too, so splits snowball. |
| **Loot Box** | Drops on 1 in 1,500 base spins, or buy it for 92x: open one of 6 boxes for a Big (15x+), Mega (40x+), Monster (100x+) or Sugar Scream (500x+) win, or the 5,000x Max Win (1 in 1,000 boxes). |
| **Graveyard Lock** (buy, 77x) | Hold and win, a different way of paying: no candies at all. 6 Soul Orbs with cash values (1x to 50x) lock on an empty board with 3 respins; every new orb that lands locks and resets the respins. Mini (25x) and Major (100x) jackpot orbs, Lantern Orbs that double every orb in their reel, and filling all 30 graves pays the 5,000x Grand. The round pays the sum of the orbs. |

Theme, art, names and code are original; only the game format is borrowed. See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the full rules, the reskin mapping, the round flow and the book event contract.

| Part | What it is | Where |
|---|---|---|
| Outcome engine | Deterministic TypeScript rules engine (pay-anywhere evaluation, tumbles, every feature) | `src/engine/` |
| Math pipeline | Simulates rounds, writes Stake RGS files (`index.json`, `books_*.jsonl.zst`, `lookUpTable_*_0.csv`) and a math report | `src/math/` |
| Game client | PixiJS 8 + DOM UI static web app that replays RGS outcomes | `src/client/`, `index.html` |
| Local RGS | Vite dev-server mock of the Stake RGS API, serving the generated books | `src/rgs/mockRgs.ts` |
| Art | Painted art in `art/source/`, imported to WebP by `tools/import-painted.py` (symbols, buttons, panels, backgrounds, screens, effects). Vector SVG fallbacks come from `tools/render-art.mjs`. The interface kit (dialog frame, crest, candy-cane strip, logo) is cut from the same painting by `tools/derive-ui.py`, so every dialog, label, toggle and button is painted, with no emoji or drawn gradients | `art/source/`, `tools/import-painted.py`, `tools/derive-ui.py`, `tools/render-art.mjs`, `public/assets/` |
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

Every new `sessionID` starts with 1,000.00 USD. In development a **DEV** panel (top right) plays a real book of a chosen type (loss, win, long tumble chain, big win, Witch's Spell, Trick or Treat, Golden Lollipop, Haunted Cauldron, Full Moon, Pumpkin Patch, retrigger, each buy, max win) through the normal play, validate, present and end-round path.

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

The published book set has 100,000 natural books for base and Ante Bet and 35,000 / 30,000 / 60,000 for the Haunted Cauldron / Full Moon / Graveyard Lock buys (their books are larger, and this keeps the math upload in one zip under 50 MB), seed 1313, target RTP 96%. Exact figures are in [docs/MATH_REPORT.md](docs/MATH_REPORT.md) and `public/math.json`. They are exact for that book set and its weights; they are **not** a certification.

| Mode | Cost | RTP | Hit rate | Std dev | Max win | Max win frequency |
|---|---|---|---|---|---|---|
| base | 1x | 96.00% | 1 in 2.25 | 12.16x | 5,000x | 1 in 1.29 million (estimate) |
| ante (Ante Bet) | 1.25x | 96.00% | 1 in 2.25 | 14.45x | 5,000x | 1 in 1.84 million (estimate) |
| bonus (Buy Haunted Cauldron) | 100x | 96.00% | 1 in 1.00 | 133.61x | 5,000x | 1 in 150,000 buys (estimate) |
| fullmoon (Buy Full Moon) | 300x | 96.00% | 1 in 1.00 | 319.30x | 5,000x | 1 in 5,000 buys (estimate) |
| lootbox (Buy Loot Box) | 92x | 96.00% | 1 in 1.00 | 271.96x | 5,000x | 1 in 1,000 buys |
| graveyard (Buy Graveyard Lock) | 77x | 96.00% | 1 in 1.00 | 57.08x | 5,000x | 1 in 17,825 buys (estimate) |

Base-game feature frequencies:
- Witch's Spell: 1 in 58.
- Trick or Treat: 1 in 71.
- Haunted Cauldron free spins: 1 in 374.
- Golden Lollipop (Trick or Treat into free spins): 1 in 1,155.
- Loot Box: 1 in 1,408.
- Full Moon: 1 in 5,130.

In the base game, Trick or Treat returns 17.9% of RTP and Witch's Spell 8.2%. In Full Moon, the Pumpkin Patch splits at least one Jack-o'-Lantern in about two of three rounds (1 in 1.52 Full Moon buys).

Ante Bet triggers free spins about 1.6 times as often (1 in 220) and Trick or Treat about 1.45 times as often (1 in 49). The weighting adjusts the raw simulation only moderately: rounds paying at least the cost are 0.97x as likely as simulated in base and 0.95x in Ante Bet.

Buy prices follow each feature's simulated value: raw 103.3% for Haunted Cauldron at 100x, and 104.8% for Full Moon at 300x, Pumpkin Patch included. The Full Moon draw lands fewer Jack-o'-Lanterns (weight 20, was 26) to pay for the Pumpkin Patch. Graveyard Lock is priced at its simulated value too (raw 96.2% at 77x) and is the steady buy: medium volatility (standard deviation 57x against 134x to 320x for the free-spin buys), paying back at least its price in 39% of buys. The 5,000x cap is reached only through free spins, the Loot Box and the Graveyard Lock Grand; its probability comes from a forced search (see the report).

## Deploying to Stake Engine

Build the upload zips with `npm run math:publish && npm run release`. The release builds the frontend first (so a zip never carries a stale build), verifies every book and lookup row, then checks the production build (`npm run check:build`: it serves `dist/` from a CDN-style sub-folder, plays spins and every buy, and fails on any missing asset, page error or balance mismatch). Finally it writes two zips to `release/`, each under 50 MB:

- `sugar-scream-math.zip` (about 41 MB): `index.json`, plus `books_<mode>.jsonl.zst` and `lookUpTable_<mode>_0.csv` for `base`, `ante`, `bonus` and `fullmoon`.
- `sugar-scream-frontend.zip` (about 8 MB): the static build, with `index.html` at the root.

1. **Math.** Upload the contents of `sugar-scream-math.zip` in the dashboard's math section.
2. **Frontend.** Upload `sugar-scream-frontend.zip`. The build is static, uses relative paths, and bundles all fonts and art, so it makes no external requests. The dev panel and local RGS are left out.
3. **Launch / test / approval.** Same as [Midnight Vault](../midnight-vault/README.md#deploying-to-stake-engine): test authenticate, play, end-round, resume, replay, social mode and the jurisdiction flags on the real RGS, then submit replay IDs per mode.

## Layout and animation

- **Layout** (after the format's best-known Stake titles): bottom left has a menu button that opens a settings popover (music and effects volume sliders, reduced motion, intro screen, Game Info), the Bonus tile and the balance. Bottom right has a big Spin button with Autoplay, Turbo and Sound beside it, and the bet with −/+ under it. The win meter and message bar sit under the board, and the board uses the full height between the two control groups (on phones the groups sit under the board). The board is fitted from the measured HUD on every resize, rotation and HUD size change. In landscape it takes the larger of two fits: between the two control groups, or above them at full width with room left for the free-spin panels. In portrait the spare height is shared out evenly around the board, the message and win stack, and the controls. On short landscape screens (phones turned sideways) the logo moves to the top right corner, the message bar moves to the top, and the free-spin panels shrink to one slim column. The Bonus Games sheet fits the screen without scrolling. A bet change there only updates the prices, so the cards don't reload. The Bonus tile opens a Bonus Games sheet: Ante Bet, Haunted Cauldron, Full Moon, Loot Box and Graveyard Lock cards with art, a volatility bar, the price and a Buy button (the Ante card has the sliding toggle), plus a balance and bet panel with a bet slider.
- **Animated scene** (`src/client/game/ambience.ts`, `scene.ts`): the background slowly breathes and drifts, and mode-coloured particles float up (sugar sparkles, brew bubbles in Haunted Cauldron, embers in Full Moon). Bats flap across now and then, and the base and free-spin scenes cross-fade. The frame has a pulsing glow and a flickering pumpkin. Symbols breathe, a random one wiggles now and then, and Jack-o'-Lanterns flicker. Landings squash and spring back, wins glow, big clusters, feature triggers and the max win shake the board, the Win meter counts up, and the win screens rain candy.
- **Presentation in the style of the format's best-known title:** each column drops in as a stack under gravity. Once 3 Skull Lollipops have landed, the remaining columns hold back and glow. Winning candies swell, jiggle and glow, then shatter into shards, and survivors fall with gravity while new candies drop in. A message bar under the board shows "12 × [candy] PAYS $1.20" during tumbles, the running win or free-spin total, and tips between rounds. In free spins, Jack-o'-Lanterns blast (shock ring, flash, shake) before their values fly to the Cauldron. Free spins open with a "Congratulations! You have won 10 free spins" screen and close with "You have won $X in N free spins". The panel counts spins left. In the bonuses every hit gets its own splash as it lands. In free spins that means each winning spin, once its whole tumble chain (and any Jack-o'-Lantern multiplier) has finished. In Trick or Treat it means each Treat. The winning spin that triggered the bonus gets one too. The Loot Box prize reveal is that bonus's hit screen. A bonus round closes on its total screen rather than repeating the splash. Every other winning round gets a splash: Nice Win (below 5x) or Sweet Win (5x to 15x) as a quick light splash, and Big (15x), Mega (40x), Monster (100x), Sugar Scream (500x) and Max Win punching in tier by tier over a fountain of candy and gold coins. Then the total win appears at once (no count-up).
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
- **Tension and payoff:**
  - **Tumble chains:** every chain escalates. A "TUMBLE x2, x3, ..." counter pops over the board and changes colour as it grows, the win chime climbs in pitch, a rising bell and gust mark each step, and the bursts and screen shake grow.
  - **Heavy clusters:** 12+ candies or 5x+ hit with a thump and a white blink first.
  - **Truthful tells:** the result is decided by the server before anything is shown, so these only appear when the thing they hint at really happens.
    - The witch peeks in from the side of the board before a spin that will run a 4+ tumble chain or win 15x+.
    - The Cauldron quakes before a pour of x10 or more.
  - **Free spins:**
    - The Cauldron panel heats up with its value: warm at x5, hot at x15, inferno at x50.
    - The last spin gets a "Final Spin" moment.
    - Retriggers burst into confetti.
  - **Vibration:** on phones that support it (Android), big moments vibrate: scatters, heavy clusters, chains, bonus triggers, big wins and jumpscares. Vibration can be switched off in the menu.
  - **Honest small wins:** a win smaller than what the round cost is not celebrated (no Nice Win splash). It is a net loss, shown plainly on the win meter. In a bonus, a hit below 1x the bet gets no splash.
- **Sharing, guidance and session tools:**
  - **Share a big win:** after a Big Win or more, a "Share this win" button copies a replay link. Anyone with the link watches the real round, clips included.
    - The link is only built when the launch gives the game's ID and version, which a replay needs. Otherwise the button copies the round's bet ID, which Stake's bet history can replay and share.
  - **First-session guide:** on a first visit, a short spotlight tour shows Spin, the bet, Bonus Games, Autoplay/Turbo/Sound and the menu. The menu's "How to play" runs it again.
  - **Bonus previews:** each Bonus Games card has a Preview button that plays that bonus's entrance clip. Nothing is bought.
  - **Session panel:** the menu's Session panel shows the session time, rounds, total bet, total won, net result and biggest win.
  - **Jurisdiction displays:** when the RGS sets the `displaySessionTimer`, `displayNetPosition` or `displayRTP` flags, a line in the top-left corner keeps them on screen.
- **Lettering:** chunky cartoon capitals (Luckiest Guy, Apache 2.0) with a dark outline and a dropped shadow for every title, button, meter, label and amount, in the HUD and the clips alike; Fredoka stays for running text (rules, the guide, descriptions).
- **Board looks follow the bonus:** the candy-pink board of the base game turns slime green in Haunted Cauldron and blood red in Full Moon (the frame's hue turns and its glow changes; the symbols are never tinted), and the Graveyard Lock board stands in a cold ghost light. It changes by itself on the way in and out of each bonus.
- **Video clips** (`src/client/clips.ts`, made with Remotion in [videos/sugar-scream-clips](../../videos/sugar-scream-clips)):
  - **Loading screen and intro:** the witch flies across the moon on her broom and the painted logo lands at the top (silent, held on its last frame, its first frame as the poster so it shows at once). When loading is done the progress bar fades, three framed feature cards fly in under the logo (the Cauldron multipliers, the Skull Lollipop scatter, the 5,000x max win) and a pulsing CLICK TO CONTINUE follows; a tap anywhere enters the game. The intro can be switched off in the menu; reduced motion stands the cards on the painted witch art.
  - **Bonus entrances:** the bonus entry clip (candy tunnel, hallway, the doors open, into the bonus world) replaces the CSS door transition. The scene switches while the camera dives through the doorway.
  - **Big wins:** the win clip for the highest tier reached plays for Big Win and above. It climbs through the tiers, and the real amount lands on it.
  - **Moments:**
    - A Witch's Spell cut-in (the witch streaks across before her spell lands).
    - A retrigger burst ("+5 Free Spins").
    - The Golden Lollipop reveal.
    - A free-spins total screen with the real win and spin count overlaid.
  - **Jumpscares:** one of seven jumpscares (ghost, witch, pumpkin, skull, eyeball, bat, poison apple) can follow a losing base game spin (1 in 6), never in the first two rounds, autoplay, turbo or the bonuses, at most every 40 seconds and never the same one twice in a row. It can be switched off in the menu.

  Each clip comes as a landscape (1280x720) and a portrait (540x960) cut, and the one matching the screen plays full screen. Turbo, slam stop and autoplay play the clips faster, and a tap skips them. The game's music steps aside while a clip plays its own sound, which follows mute and the volume sliders. Reduced motion turns the clips off. If a clip cannot play (codec, network, autoplay policy), the CSS animation plays instead. The jumpscare's flashes stay under three a second (photosensitivity).
- **Animated interface:** floating logo, breathing spin button, light sweep and hop on Buy, glowing Ante when on, pulsing info button, bubbling Cauldron panel and breathing Trick-or-Treat doors. Everything stops with reduced motion.

## Verified

Checked in this environment (headless Chromium at 1600x900, 390x844, 360x640 and 844x390):

- 21 unit tests pass. All 12 end-to-end scenarios (loss, win, tumble chain, Witch's Spell, Trick or Treat, Golden Lollipop, Haunted Cauldron from the base game, Full Moon from Ante Bet, retrigger, both buys, max win) settle to the cent with no page errors.
- The client validates every book with the engine's validator before playing it, rebuilding every tumble from the compact events.
- Spacebar spin, slam stop, turbo (Loot Box and Trick-or-Treat picks always wait for the player, in autoplay too, with no time limit, and the doors and boxes wiggle after 5 s without a pick; only replays pick by themselves), autoplay with confirmation and stop-on-feature, Ante Bet toggle, buy confirmation, mute plus separate music and effects switches, reduced motion, social-mode wording, replay mode, active-round resume.
- The production build contains no dev code and makes no external requests.

## Unfinished / not verified

- **Not deployed to Stake Engine** (no account here). Built against the documented RGS contract and tested against the local mock only.
- **Math is not certified.** Figures are exact for the published book set; the win-cap probability is a simulation estimate.
- **Art:** the game uses the supplied painted art throughout: all 11 symbols, the board frame, backgrounds for the base game and both free-spin modes, every HUD button and panel, the Trick-or-Treat street, doors and reveals, the loading, intro, free-spin intro and feature-complete screens, the five win screens (Big, Mega, Monster, Sugar Scream, Max Win), the Witch's Spell witch, and the spell and candy-pop effects. The vector SVGs in `public/assets/` remain only as fallbacks.
- **Music licence:** the supplied Halloween track (`art/source/audio/halloween-music.mp3`, "prettyjohn1-halloween-halloween-music-620626") must be licensed for commercial use before release. The sound effects are spooky and synthesized in Web Audio (no samples, so nothing to license):
  - **Spins:** a ghostly gust as the board falls, coffin-lid thuds as candies land, a wet splat for each tumble and a haunted music-box chime for each win.
  - **Bonus symbols:** a church bell tolls for each Skull Lollipop, and Jack-o'-Lanterns burst into flame.
  - **Bonus entrance:** wind howls down the hallway, knuckles knock, the doors creak open, a whoosh carries you through and an organ chord greets the bonus.
  - **Features:** the witch cackles over the Witch's Spell and big wins, ghosts wail on Tricks, the cauldron bubbles, and the organ closes a bonus with a minor cadence.
- **Devices:** only headless Chromium was tested. Real phones, Safari and Firefox still need testing.
- **English only**; other `lang` values fall back to English.
