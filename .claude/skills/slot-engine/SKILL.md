---
name: slot-engine
description: Build, simulate, analyze and optimize slot game math in TypeScript with the community Slot Engine libraries (@slot-engine/core, @slot-engine/optimizer, @slot-engine/panel). Produces Stake Engine / Stake RGS compatible books (books_<mode>.jsonl.zst), lookup tables and index.json. Use when the user wants a TypeScript/Node alternative to the Python Stake Math SDK, is configuring createSlotGame, symbols, game modes, reel sets (GeneratedReelSet/StaticReelSet), result sets, hooks, writing onHandleGameFlow, computing lines/cluster/manyways wins, running simulations, hitting a target RTP with the optimizer, reading stats files, or using the Slot Engine Panel GUI.
---

# Slot Engine (TypeScript slot math)

Slot Engine is a community project (not affiliated with Stake) at <https://github.com/slot-engine/slot-engine>, docs at <https://slot-engine.dev/docs>. It mirrors the concepts of Stake's Python Math SDK, but ships as npm packages instead of a repo you fork. Versions documented here: `@slot-engine/core` 0.3.2, `@slot-engine/optimizer` 0.1.0, `@slot-engine/panel` 0.2.2. For a newer installed version, check `node_modules/@slot-engine/core/CHANGELOG.md` and `references/core-other-migration-guides.md`.

## Requirements

- Node **>= 22.15.0 or >= 23.8.0** (native Zstandard compression is required).
- TypeScript strongly recommended. Run games with `tsx`.
- Run every game with the `--slot-engine-run` flag, e.g. `pnpm tsx ./index.ts --slot-engine-run`. Without it nothing executes.
- Run from the game directory, or set `rootDir: __dirname` in `createSlotGame` (this fixes "Module not found" errors).

## Mental model

1. The RGS picks a weighted, **pre-computed** outcome. Slot Engine generates every outcome up front.
2. **Game modes** (base, ante, bonus buy, super bonus) are purchasable behaviours with a `cost` and a target `rtp`.
3. **Result sets** (the Math SDK calls them "distributions") set quotas and criteria, so rare outcomes such as max win or forced free spins actually appear in the books.
4. One **`onHandleGameFlow(ctx)`** hook implements the whole game for every mode. Build it from `ctx.services.*` utilities.
5. **Simulate**, then **optimize** the lookup-table weights to the target RTP, then **analyze** the stats files.

## Minimal skeleton

```ts
import {
  createSlotGame, defineGameModes, defineSymbols, defineUserState,
  GameMode, GameSymbol, ResultSet, InferGameType, SPIN_TYPE,
} from "@slot-engine/core"

export const userState = defineUserState({})
export type UserStateType = typeof userState
export const symbols = defineSymbols({ /* id: new GameSymbol({...}) */ })
export type SymbolsType = typeof symbols
export const gameModes = defineGameModes({
  base: new GameMode({
    name: "base", cost: 1, rtp: 0.96, reelsAmount: 5,
    symbolsPerReel: [3, 3, 3, 3, 3], isBonusBuy: false,
    reelSets: [/* GeneratedReelSet | StaticReelSet */],
    resultSets: [/* ResultSet */],
  }),
})
export type GameModesType = typeof gameModes
export type GameType = InferGameType<GameModesType, SymbolsType, UserStateType>

export const game = createSlotGame<GameType>({
  id: "my-game", name: "My Game", maxWinX: 5000, padSymbols: 1,
  scatterToFreespins: { [SPIN_TYPE.BASE_GAME]: { 3: 10, 4: 12, 5: 15 } },
  gameModes, symbols, userState,
  hooks: { onHandleGameFlow },
})

game.configureSimulation({ simRunsAmount: { base: 100000 }, concurrency: 16 })
game.runTasks({ doSimulation: true })
```

`name` in each `GameMode` must match its key in `defineGameModes`. Type the context in separate files as `GameContext<GameModesType, SymbolsType, UserStateType>`.

## Rules when writing onHandleGameFlow

- Pass `ctx` between helper functions freely. **Never** copy or spread it (`{ ...ctx }`), because simulations then break.
- Don't mutate `ctx.config` during play.
- Record wins with `ctx.services.wallet.addSpinWin()` / `addTumbleWin()` and `confirmSpinWin()`. Emit frontend events with `ctx.services.data.addBookEvent()`. Tag outcomes with `ctx.services.data.tag()` (the optimizer can match books by tag).
- `onSimulationAccepted` may add tags but must **not** change payouts. `onGameModeComplete({ mode, paths, metadata })` runs once per mode on the main thread, and you can use it to call the optimizer manually.

## Service cheat sheet (`ctx.services.*`)

| Service | Key methods | Reference |
|---|---|---|
| `board` | `getRandomReelset`, `drawBoardWithRandomStops`, `drawBoardWithForcedStops`, `getRandomReelStops`, `countSymbolsOnBoard`, `countSymbolsOnReel`, `get/set/remove/updateSymbol`, `tumbleBoard`, `setReelLocked`, `setAnticipationForReel`, `resetBoard` | `references/core-game-context-board-service.md` |
| `game` | `getCurrentGameMode`, `getReelsetById`, `getResultSetByCriteria`, `getFreeSpinsForScatters`, `verifyScatterCount`, `awardFreespins`, `dedupeWinSymbols` | `references/core-game-context-game-service.md` |
| `wallet` | `addSpinWin`, `addTumbleWin`, `confirmSpinWin`, `getCurrentWin`, `getCurrentSpinWin`, `getCurrentTumbleWin` | `references/core-game-context-wallet-service.md` |
| `data` | `addBookEvent`, `tag`, `tagSymbolOccurrence`, `log` | `references/core-game-context-data-service.md` |
| `rng` | `weightedRandom`, `randomItem`, `shuffle`, `randomFloat` | `references/core-game-context-rng-service.md` |

Win evaluators: `LinesWinType`, `ClusterWinType`, `ManywaysWinType` (`references/core-game-implementation-win-calculation.md`).

## Reference map (read on demand)

| Topic | File |
|---|---|
| Quick start, install, FAQ | `references/core-overview.md` |
| Terminology (RGS, game mode, result set, RTP) | `references/core-core-concepts.md` |
| vs. Stake Math SDK | `references/core-slot-engine-vs-stake-math-sdk.md` |
| `createSlotGame` options | `references/core-config-overview.md` |
| Symbols, pays, wild/scatter properties, multipliers | `references/core-config-symbols.md` |
| Game modes | `references/core-config-game-modes.md` |
| Reel sets (generated, CSV, JSON, stacking, quotas) | `references/core-config-reel-sets.md` |
| Result sets (criteria, quota, forceMaxWin, forceFreespins, evaluate, reelWeights) | `references/core-config-result-sets.md` |
| User state | `references/core-config-custom-state.md` |
| Hooks | `references/core-config-hooks.md` |
| Implementation guide, dos and don'ts | `references/core-game-implementation-overview.md` |
| Context object, config, state | `references/core-game-context-overview.md`, `-config.md`, `-state.md` |
| Simulation config and output files | `references/core-game-tasks-simulation.md` |
| Optimization (`@slot-engine/optimizer`) | `references/core-game-tasks-optimization.md` |
| Analysis and stats files | `references/core-game-tasks-analysis.md` |
| Migration between versions | `references/core-other-migration-guides.md` |
| Panel GUI (`@slot-engine/panel`) | `references/panel-*.md` |
| LGS (local gaming server, WIP) | `references/lgs-overview.md` |

## Worked examples

Complete upstream games, pinned to core 0.3.2:

- `examples/lines_example/`: 5x3 paylines game with free spins, super free spins, upgrade and max-win evaluations. Start with `index.ts`, then `src/onHandleGameFlow.ts`.
- `examples/cluster_example/`: cluster-pays tumble game using static CSV reels (`static-reels/*.csv`).

When building a new game, copy the closest example's structure rather than inventing one.

## Output for Stake Engine

A simulation writes `books_<mode>.jsonl.zst`, `lookUpTable_<mode>_0.csv` and `index.json` into the build directory. These are the math files you upload to Stake Engine. For Stake's math approval rules (RTP range, mode RTP spread, max-win hit rate), see the `stake-math-sdk` skill's `references/approval-math.md`. For playing the books in a frontend, see `stake-web-sdk` and `stake-engine-ts-client`.
