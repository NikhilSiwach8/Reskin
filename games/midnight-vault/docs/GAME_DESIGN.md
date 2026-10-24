# Midnight Vault: game design and feature-state documentation

This document describes the rules as implemented. The single source of truth for every number is `src/engine/config.ts`; the in-game rules panel (`src/client/ui/rules.ts`) is generated from the same file.

## 1. Overview

- 5 reels x 5 rows, 15 fixed paylines, wins pay left to right from reel 1.
- Bet modes: **base** (1x bet) and **bonus** (Buy Bonus, 100x bet).
- Maximum win: **5,000x bet** in every mode. A round that reaches it ends immediately and pays exactly 5,000x.
- All amounts in the engine and the books are integers in *centi-bet* units (100 = 1x bet). The RGS reports `payoutMultiplier` as `centi / 100`. The client multiplies by the integer bet (RGS micro-units), so no floating-point money arithmetic is involved.

## 2. Symbols

| ID | Name | Category | 3 / 4 / 5 (x total bet) | Special behaviour |
|---|---|---|---|---|
| RL | Cursed Relic | wild | 0.25 / 0.75 / 2.5 | Substitutes for everything except VK; carries a multiplier; may expand |
| VK | Vault Key | scatter | - | 3-4 trigger Three Keys to the Vault, 5 trigger The Vault Breach |
| GB | Gold Bag | high | 1 / 3 / 10 | - |
| TC | Treasure Chest | high | 0.8 / 2.5 / 8 | - |
| LG | Haunted Ledger | high | 0.6 / 2 / 6 | +1 seal progress in bonus rounds |
| VD | Vault Door | high | 0.5 / 1.5 / 5 | 3+ trigger Lockdown Spin |
| PH | Phantom | high | 0.5 / 1.5 / 5 | 3+ trigger Phantom Heist |
| CL | Thirteenth Clock | high | 0.5 / 1.5 / 5 | 3+ trigger The Thirteenth Hour |
| EL | Spectral Elixir | high | 0.5 / 1.5 / 5 | 3+ trigger Spectral Respin |
| A, K | A, K | low | 0.2 / 0.5 / 1.5 | Transformable by the Phantom |
| Q, J, T | Q, J, 10 | low | 0.1 / 0.3 / 1 | Transformable by the Phantom |

Wild, scatter and trigger behaviour is defined in configuration (`SYMBOLS`, `FEATURES`), never by the art.

**Reel strips.** Every reel set is built deterministically from a composition table (`REEL_SETS`) and shuffled with a fixed seed. The six spaced symbols (VK, RL, VD, PH, CL, EL) are kept at least 5 positions from their own copies, so each shows at most once per reel window. A count such as "3 Vault Doors" therefore always means three different reels.

## 3. Payline evaluation

1. For each of the 15 lines, take the 5 symbols along the line.
2. Count the leading Relics (`wildRun`).
3. Candidate A: if `wildRun >= 3`, Relic pays for `wildRun`.
4. Candidate B: the first non-Relic symbol, if substitutable, extended through matching symbols and Relics; pays for 3+.
5. Pay the higher of A and B (B on ties), never both.
6. **Multiplier:** the sum of the multipliers of the *distinct* relic blocks whose cells are inside the winning combination, or 1 if none. A block crossing the line on several cells counts once. `win = basePay x multiplier`.

## 4. Cursed Relic expansion (authoritative order)

1. Every newly landed Relic draws a multiplier and an expansion size from the active relic table. Relic Overload can raise the minimum size and modify the multiplier (`(m + bonus) x factor`).
2. Each new Relic becomes a 1x1 block.
3. Relics are processed in reading order (reel 1 top to bottom, then reel 2, ...).
4. A Relic of size *n* grows right and down. If it would leave the grid it is shifted left/up, so the landing cell always stays inside.
5. The square is rejected if it contains a Vault Key, a cell of another block that is already larger than 1x1 or pre-existing (surges, Phantom wilds), or a caller-defined obstacle. A rejected square is retried one size smaller, down to 1x1.
6. New 1x1 Relics inside an accepted square are absorbed: their multiplier is added to the block and they do not expand.
7. The client receives the final blocks (`relicExpand`) and draws them exactly.

| Table | Multipliers | Sizes (weight per 1000) |
|---|---|---|
| base | 1, 2, 3, 5 | 1: 820, 2: 140, 3: 35, 4: 5 |
| respin (Lockdown, Spectral) | 1, 2, 3, 5 | 1: 780, 2: 170, 3: 42, 4: 8 |
| free (Thirteenth Hour, Phantom Payday, Midnight Countdown, Haunting) | 1, 2, 3, 5 | 1: 750, 2: 200, 3: 45, 4: 5 |
| cursedFortune (also Vault Breach stages 3-4) | 2, 3, 5, 10, 25, 50, 100 | 1: 750, 2: 210, 3: 35, 4: 5 |

**Relic Surge** places a guaranteed block of a given size at a random free square (no Keys, no existing blocks). Multipliers: 2x2: 1/2/3, 3x3: 1/2/3/5, 4x4: 1/2/3.

## 5. Base game state machine

```
IDLE --bet--> REVEAL --(landed grid)--> detect feature (priority order)
   Vault Breach (5 VK) > Three Keys (3-4 VK) > Thirteenth Hour (3 CL) > Lockdown (3 VD) > Spectral Respin (3 EL) > Phantom Heist (3 PH) > none
   none / Thirteenth Hour / Three Keys / Vault Breach: expand relics -> pay trigger spin -> run sequence feature (if any)
   Lockdown / Spectral / Phantom: modify this spin -> expand relics -> pay the FINAL grid only
-> FINAL WIN -> (payout > 0 ? end-round : auto-complete) -> IDLE
```

At most one feature runs per base spin. Trigger counting uses the landed grid, before any expansion. A Blackout presentation (the reels go dark before the reveal) is chosen for 35% of feature-triggering reveals; it is cosmetic only.

### 5.1 Lockdown Spin (3+ Vault Doors)

| State | Rule |
|---|---|
| Start | Reels containing a VD lock. Relics on the trigger grid do not expand yet. |
| Respin | Unlocked reels respin from the `lockdown` reel set (no Keys). A VD on a respun reel locks that reel and resets respins to 3. |
| End | Respins reach 0, or all 5 reels are locked. No retrigger. |
| Resolve | Chains break; every VD on the final grid becomes a Relic (`doorsOpen`); Relics expand (respin table); the final grid is paid once. |

Locked reels never change between respins (covered by tests).

### 5.2 Spectral Respin (3+ Spectral Elixirs)

All EL and RL cells are held; every other cell respins once from the `spectral` reel set; Relics expand (respin table); the final grid is paid. No retrigger.

### 5.3 Phantom Heist (3+ Phantoms)

The Phantom steals the most common low symbol (ties go to the higher payer, order A, K, Q, J, 10) and turns every copy into one target: Relic 20%, Gold Bag 30%, Treasure Chest 30%, Haunted Ledger 20%. Relic targets become 1x1 relic blocks with multiplier 1/2/3/5. Then Relics expand (base table) and the grid is paid. Transformations never persist into later spins.

### 5.4 The Thirteenth Hour (3+ Clocks)

1. The trigger spin is paid.
2. The clock starts at IX. 4 special spins follow on the `clock` reel set (no Keys, so no bonus retrigger).
3. Each CL landing advances the clock 1 hour, capped at XIII.
4. The Final Countdown Spin: Relic Surge with size by hour (IX-XI 2x2, XII 3x3, XIII 4x4), then normal relic expansion, then pay.
5. The feature ends. No retrigger. A guaranteed surge is not a guaranteed win.

## 6. Three Keys to the Vault

| Item | Rule |
|---|---|
| Trigger | 3 VK: 8 spins, 4 VK: 10 spins. The trigger spin is paid first. |
| Path | Random: Cursed Fortune 40%, Phantom Payday 35%, Midnight Countdown 25%. Bonus buy: 37 / 35 / 26, plus Vault Breach 2%. |
| Retrigger | 3+ VK in one free spin: +4 spins; total capped at 30. |
| End | Spins exhausted, or win cap. Returns to the base game. |

### 6.1 Cursed Fortune: Relic Overload and the Relic Seal

Per spin: (1) charge += Relics landed + Ledgers landed; (2) the level updates; (3) Relics expand with the cursedFortune table at the current level; (4) pay. Charge persists for the whole bonus and resets at the end.

| Level | Charge | Effect |
|---|---|---|
| 0 | 0-4 | - |
| 1 | 5+ | Relics expand to at least 2x2 |
| 2 | 11+ | +2 added to every new Relic's multiplier |
| 3 | 16+ | At least 3x3, and multiplier (m + 2) x 2 |

Overlapping relics follow section 4 (absorption adds multipliers).

### 6.2 Phantom Payday: the Phantom Seal

Per spin: seal progress += Phantoms + Ledgers landed; level = number of thresholds reached (3, 6, 10). If at least one Phantom landed: marks = min(10, 2 + 3 x Phantoms + level), random low cells transform into one target drawn from the level's table. Level 3 can produce Relic wilds (multiplier 1/2/3/5). Then expand (free table) and pay.

### 6.3 Midnight Countdown: the Clock Seal

The clock starts at IX. Each CL or LG landing advances it 1 hour. Reaching XIII strikes: one extra Final Countdown Spin is added (counts toward the 30-spin cap), and the clock resets to IX. That spin begins with a 4x4 Relic Surge before relic expansion and payment. At the spin cap the clock stays at XIII without adding spins.

## 7. The Vault Breach

Trigger: 5 VK in the base game, or the 2% Vault Breach path of the bonus buy. 9 spins, no retriggers.

| Stage | Spins | Rule |
|---|---|---|
| 1 The Seal Breaks | 0 | Presentation: the vault door rolls away |
| 2 The Haunting | 4 | Each spin: a Phantom Heist marks 4/5/6/8 low cells; target Relic 15% / GB 30% / TC 30% / LG 25%; Phantom Seal += cells transformed |
| 3 Relic Overload | 4 | Charge starts at 5 (level 1). If no Relic lands, one random low cell becomes a Relic before the reveal. Charge += Relics + Ledgers. cursedFortune table. |
| 4 The Final Heist | 1 sequence | 4x4 Relic Surge, then a Lockdown where reels containing Relics lock (3 respins, reset when a Relic lands on an unlocked reel). Final grid expands at the carried Overload level and pays. |

The Clock Seal shows the stage (1-4). The Relic and Phantom seals show their stage progress.

## 8. The Haunted Ledger

Seals are rendered from `ledger` events emitted by the engine; they never show decorative or invented values.

| Seal | Cursed Fortune | Phantom Payday | Midnight Countdown | Vault Breach |
|---|---|---|---|---|
| Relic | Overload charge (thresholds 5/11/16) | - | - | Stage 3 charge |
| Phantom | - | Seal progress (3/6/10) | - | Cells transformed in stage 2 |
| Clock | - | - | Hours since IX, strikes as level | Current stage |

All seals reset when the bonus ends.

## 9. Book event contract

A book is `{ id, payoutMultiplier, events[], criteria }`. The client validates every book (`src/engine/validate.ts`) before playing it. If validation fails, the round is not animated and the client shows that the server settles the result.

| Event | Fields | Client presentation |
|---|---|---|
| `reveal` | board, reelSet, phase, anticipation, blackout | Spin and stop reels on the board |
| `relicExpand` | blocks (with absorbed cells), board | Grow block frames from origin, multiplier badges |
| `relicSurge` | block, board | Shockwave and guaranteed block |
| `featureTrigger` | feature, cells | Pulse trigger symbols, feature banner |
| `phantomHeist` | cells, target, mult?, board | Portal, Phantom sweep, cell transformation |
| `lockdownStart` / `lockdownRespin` / `lockdownEnd` | lockedReels, newLocks, respinsLeft, board | Chains and lock badges, partial respins |
| `doorsOpen` | cells, board | Vault Doors burst into Relics |
| `spectralRespin` | held, board | Held cells glow, others drop out and in |
| `clockStart` / `clockAdvance` / `clockStrike` | hour, by, surgeSize | Clock dial and hand, strike |
| `overload` | charge, level, levelUp | Shockwave and banner on level-up |
| `ledger` | seals | Ledger panel |
| `bonusPath` | path, spins | Three-keys reveal, background change |
| `freeSpin` | index, remaining, total, label | Spin counter |
| `retrigger` | added, total, cells | Banner |
| `breachStage` | stage, name, spins | Vault door / stage banners |
| `winInfo` | wins[], spinWin, mult, totalWin | Paylines, cell pulses, count-up, big wins |
| `featureEnd` | feature, featureWin, totalWin | Feature summary, return to base background |
| `wincap` | totalWin | Max-win celebration; nothing follows except `finalWin` |
| `finalWin` | amount | Final win meter (must equal `payoutMultiplier`) |

## 10. Math model and weighting

- Books are produced by playing complete rounds with a seeded xoshiro128** RNG (`src/engine/rng.ts`), so every run is reproducible from its seed.
- **Win-cap books:** extra Cursed Fortune rounds are played until a configured number reach the cap (`--wincaps`). The natural win-cap probability is estimated as P(Cursed Fortune) x P(cap | Cursed Fortune), or the natural cap rate if that is higher.
- **Forced Vault Breach books (base):** 5 Keys occur about once in 270,000 base spins, so a 100,000-book sample usually has none, even though the rules promise the feature. 300 forced 5-Key rounds are added. Their group probability is exact: Keys are spaced so at most one shows per reel window, which makes P(5 Keys) the product of the five per-reel window probabilities (3.700e-6 for the shipped strips). The forced boards place the Keys on uniformly random rows of otherwise naturally drawn reels.
- **Lookup-table weights** (`src/math/weights.ts`): fixed-probability groups (win cap, then base Vault Breach), plus the remaining natural books split into *below cost* and *at or above cost*. Every book inside a group has the same weight, so the simulated distribution inside each group is unchanged. Fixed groups get their probabilities; the below/above split is solved exactly for the target RTP. The adjustment factor is reported in the math report.
- The RGS samples books by weight, so RTP, hit rate and volatility are **exact** for a published book set (`docs/MATH_REPORT.md`). They are not certified figures.
- Stake requirements checked: RTP within 90-98% and within 0.5% across modes (both 96.00%); 100k+ simulations per mode for publication; hit rate better than 1 in 20; max win more frequent than 1 in 10,000,000 (see report); no jackpots, gamble, early cash-out or cross-round state.
