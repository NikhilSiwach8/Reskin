# Sugar Scream: game design

Sugar Scream is a Halloween reskin of the **pay-anywhere tumbling slot** format made famous by Pragmatic Play's *Sweet Bonanza*: a 6x5 board, 8 or more matching symbols anywhere win, winners burst and new symbols tumble in, a lollipop scatter triggers free spins and multiplier symbols land only during free spins.

The theme, art, names and code are original. The format is the reference; nothing is copied from the original game. Three bonuses are new to this format: **Witch's Spell**, **Trick or Treat** and the **Haunted Cauldron** persistent multiplier. There is also a **Full Moon** super version of the free spins, where the **Pumpkin Patch** splits Jack-o'-Lanterns.

All numbers below come from `src/engine/config.ts`, which also generates the in-game rules.

## The reskin

| Original format | Sugar Scream |
|---|---|
| Fruit and candy symbols | Halloween candy: Bleeding Heart, Witch's Potion, Slime Drop, Ghost Marshmallow (high); Poison Apple, Eyeball Gumball, Pumpkin Bonbon, Gummy Bat, Candy Corn (low) |
| Lollipop scatter | Skull Lollipop |
| Rainbow multiplier bombs (free spins only) | Jack-o'-Lanterns carrying x2 to x100 |
| Candy-land sky | Haunted candy graveyard under a full moon, lollipop trees |
| Ante Bet, Buy Free Spins | Ante Bet (1.25x), Buy Haunted Cauldron (100x), Buy Full Moon (300x) |

## Base game

- 6 reels x 5 rows. Each cell is an independent weighted draw (`DRAWS`). The Ante Bet uses a table with more Skull Lollipops.
- **Pay anywhere:** 8-9, 10-11 or 12+ of a paying symbol anywhere on the board pays (`SYMBOLS[*].pays`).
- **Tumble:** every cell of each winning symbol is removed, the cells above fall, and new symbols drop in from the top of each reel. Repeats until the board has no win. Tumble wins add up.
- **Scatter pay:** Skull Lollipops on the final board pay 3x (4), 5x (5) or 100x (6+).

### New: Witch's Spell (base game, random)

On any base-game spin (chance `SPELL_CHANCE`, 1 in 56) the Witch flies over the board **before it is evaluated**. She picks a paying symbol (`SPELL_SYMBOLS`, low candies more likely) and turns `SPELL_CELLS` cells into it. Lollipops and Jack-o'-Lanterns are never touched, and she always converts enough cells for at least 8, so a spell spin always wins. The tumble sequence then plays normally.

### New: Trick or Treat (exactly 3 Skull Lollipops)

The sweet spot in the original format is one lollipop short of free spins. Here it starts a doorstep pick bonus:

1. 9 front doors appear. The player knocks on up to 3.
2. Each knock draws from `KNOCK_TABLE`: a **Treat** (1x to 50x the bet), a **Trick** (a ghost, nothing), or the **Golden Lollipop**.
3. The Golden Lollipop ends the knocking and awards 10 Haunted Cauldron free spins. Treats already found are kept.

The prizes are drawn when the book is generated. The door the player clicks only decides where the next prize is shown, which the rules state. Autoplay, turbo and replay open doors automatically, and an idle player is auto-picked after 12 seconds.

### New: Loot Box (random drop, or bought for 92x)

On a base or Ante spin that triggered no other feature, a Loot Box drops with probability `LOOT_CHANCE` (1 in 1,500). The player opens one of 6 boxes. The prize is drawn from `LOOT_TABLE`, and the multiplier is a whole number drawn uniformly in the tier's range (`LOOT_TIERS`):

| Prize | Multiplier | Chance |
|---|---|---|
| Big Win | 15x to 39x | 70% |
| Mega Win | 40x to 99x | 20% |
| Monster Win | 100x to 499x | 8% |
| Sugar Scream | 500x to 2,500x | 1.9% |
| Max Win | 5,000x | 0.1% |

A Max Win box pays the 5,000x cap and ends the round. As with Trick or Treat, the box clicked only decides where the predetermined prize is shown. The `lootbox` bet mode (92x) opens a Loot Box directly, with no board. Its book is just `lootBox`, `win`, `finalWin`.

## Free spins

| Trigger | Feature | Spins | Cauldron start | Each Jack-o'-Lantern adds |
|---|---|---|---|---|
| 4 Skull Lollipops, or the Golden Lollipop | Haunted Cauldron | 10 | x0 | 1x its value |
| 5+ Skull Lollipops | Full Moon | 12 | x5 | 2x its value |

- 3+ Skull Lollipops on a free spin's final board add 5 spins (`RETRIGGER_*`).
- Free spins use their own draw tables: low candies are more concentrated (so tumbles are more frequent) and Jack-o'-Lanterns can land (Full Moon has more of them).

### New: Haunted Cauldron (persistent multiplier)

In the original format, a multiplier only multiplies the spin it lands on. Here the multipliers build up:

1. Jack-o'-Lanterns (x2 to x100, `MULT_VALUES`) can land on any free spin, including on tumble refills. They don't pay and they stay through the tumbles, falling with the board.
2. When a free spin's tumbles end **with a win**: `spin win = tumble win x max(1, sum of the spin's Jack-o'-Lanterns + Cauldron)`.
3. Then the spin's Jack-o'-Lanterns are **poured into the Cauldron** (`Cauldron += sum x pour`), so it multiplies every later winning spin.
4. Jack-o'-Lanterns on a spin without a win are lost.

Full Moon starts the Cauldron at x5 and pours each Jack-o'-Lantern in twice. This is the game's high-volatility path, and the usual way to reach the 5,000x cap.

**Pumpkin Patch** (Full Moon only): when a free spin's tumbles end with a win, each Jack-o'-Lantern on the board splits with probability 20% (`PUMPKIN_SPLIT`). Its copy, with the same value, replaces a random candy (never a Jack-o'-Lantern or a Skull Lollipop), so it cannot change the spin's wins or the scatter count. The copies count in the spin's multiplier and are poured into the Cauldron like any other Jack-o'-Lantern. To keep Full Moon's raw return where it was (about 106% at 300x before weighting), the Full Moon draw table lands Jack-o'-Lanterns at weight 20 (was 26).

## Win cap

Every round is capped at 5,000x (`WINCAP`). When a win would cross it, that win is reduced to reach the cap exactly, a `wincap` event is written and the round ends.

## Bet modes

| Mode | Cost | Opening |
|---|---|---|
| `base` | 1x | normal spin |
| `ante` | 1.25x | normal spin, more Skull Lollipops |
| `bonus` | 100x | board forced to exactly 4 Skull Lollipops (base symbols otherwise); its base tumbles and scatter pay count |
| `fullmoon` | 300x | board forced to exactly 5 Skull Lollipops |
| `lootbox` | 92x | opens a Loot Box directly (no board) |

Witch's Spell only appears in `base` and `ante`. A bought Haunted Cauldron can still upgrade to Full Moon if a tumble lands a fifth Lollipop.

## Round flow

```
reveal (base)
 ├─ witchSpell?                      (base / ante, 1 in 40)
 ├─ [tumbleWin → tumble]*            (until no win)
 ├─ win(spin), win(scatter)
 └─ scatters on final board
     ├─ 5+ → freeSpins(fullMoon)
     ├─ 4  → freeSpins(cauldron)
     ├─ 3  → trickOrTreat → knock x1..3 → trickOrTreatEnd → win(treat)
     │                                   └─ Golden Lollipop → freeSpins(cauldron)
     └─ else, 1 in 1,500 → lootBox → win(loot)
freeSpins:
 freeSpinsStart
 repeat: freeSpin → reveal(free) → [tumbleWin → tumble]* → multiplier? → win(spin) → cauldron? → retrigger?
 freeSpinsEnd
finalWin
```

## Book event contract

Amounts are integer centi-bet (100 = 1x). Boards are `board[reel][row]` with row 0 at the top. A `win` event is the only event that adds money; `validateBook` (`src/engine/validate.ts`) replays the whole book and rejects it if anything does not add up. The client runs the same check before animating.

| Event | Fields | Meaning |
|---|---|---|
| `reveal` | `board`, `mults`, `phase` | A whole board lands. `mults` lists Jack-o'-Lanterns and their values (free spins). |
| `witchSpell` | `symbol`, `cells`, `board` | Cells turned into `symbol`; `board` is the result. |
| `tumbleWin` | `wins[{symbol,count,pay}]`, `tumbleTotal` | Paying symbols on the current board (all of their cells win). `tumbleTotal` is the spin's running tumble win. |
| `tumble` | `fill[reel][]`, `mults` | The winning cells burst. Survivors fall and `fill[reel]` drops in on top (top to bottom). The new board is `applyTumble(board, winSymbols, fill)` (`src/engine/board.ts`). |
| `pumpkinSplit` | `splits: [{ from, to, value }]` | Full Moon, after a winning spin's tumbles and before its `multiplier`: each `from` Jack-o'-Lantern sprouts a copy of `value` on the candy at `to`. The validator replays it and checks the copies against the next `multiplier`. |
| `multiplier` | `cells`, `landed`, `cauldronBefore`, `mult`, `base` | End of a winning free spin: `mult = max(1, landed + cauldronBefore)`. `cells` is every Jack-o'-Lantern on the board, Pumpkin Patch copies included. |
| `win` | `kind` (`spin`/`scatter`/`treat`), `amount`, `totalWin` | Adds `amount` to the round total. A spin win is `base x mult`, except when clamped at the cap. |
| `trickOrTreat` | `cells`, `knocks` | Doorstep bonus starts. |
| `knock` | `index`, `prize` (`treat` + `amount` / `trick` / `lollipop`) | One door. `index` is the auto-pick door. |
| `trickOrTreatEnd` | `total`, `lollipop` | Sum of treats, and whether free spins follow. |
| `freeSpinsStart` | `kind`, `spins`, `cauldron`, `cells` | |
| `freeSpin` | `index`, `total` | |
| `cauldron` | `value` | New Cauldron value after pouring. |
| `retrigger` | `added`, `total`, `cells` | |
| `freeSpinsEnd` | `kind`, `featureWin`, `totalWin` | |
| `lootBox` | `boxes`, `tier`, `multiplier` | Loot Box: the opened box holds `tier` at `multiplier` x the bet; the next `win` (kind `loot`) pays it, clamped at the cap. |
| `wincap` | `totalWin` | The 5,000x cap was reached. |
| `finalWin` | `amount` | Always last; equals the book's `payoutMultiplier`. |

Tumble events carry only the new symbols (not the whole board), which keeps the free-spin book files about 40% smaller.
