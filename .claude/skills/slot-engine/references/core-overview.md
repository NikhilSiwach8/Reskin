# Quick Start

> Getting started with Slot Engine
> Source: https://slot-engine.dev/docs/core

## Introduction

Slot Engine is a family of TypeScript libraries for building, simulating and testing slot games.

  **Slot Engine Core**

  Library for configuring and simulating slot games. Produces output compatible with Stake Engine / Stake RGS.
  
  **Slot Engine Panel**

  Web GUI for interacting with Slot Engine. Run simulations, view statistics, explore game files.
  
  **Slot Engine LGS (WIP)**

  Local gaming server. Test your game locally without the need to upload to Stake Engine and save time during development.
  

### Further Reading

For a more in-depth introduction to Slot Engine and its features,
check out ["What is Slot Engine?"](https://slot-engine.dev/docs/core/what-is-slot-engine).

Unsure which is right for you? ["Slot Engine vs Stake Math SDK"](https://slot-engine.dev/docs/core/slot-engine-vs-stake-math-sdk)
provides an in-depth comparison to help you decide.

## Installation & Setup

Get started creating your first game using the `@slot-engine/core` library.

  ### Install package from npm

Set up your Node.js project and install `@slot-engine/core`. **Using TypeScript instead of JavaScript is highly recommended.**

**Slot Engine requires Node >= 23.8.0 or >= 22.15.0** to make use of native Zstandard compression features.

```bash tab="npm"
npm i @slot-engine/core
```

```bash tab="pnpm"
pnpm i @slot-engine/core
```

```bash tab="yarn"
yarn add @slot-engine/core
```

```bash tab="bun"
bun install @slot-engine/core
```

  ### Configure your game

This example provides a quick overview to get you started.
For detailed configuration options, see the [configuration guide](https://slot-engine.dev/docs/core/config).

```ts lineNumbers title="index.ts"
import {
  defineUserState,
  defineSymbols,
  defineGameModes,
  InferGameType,
  createSlotGame,
} from "@slot-engine/core"

export const userState = defineUserState({ /* ... */ })
export type UserStateType = typeof userState

export const symbols = defineSymbols({ /* ... */ })
export type SymbolsType = typeof symbols

export const gameModes = defineGameModes({ /* ... */ })
export type GameModesType = typeof gameModes

export type GameType = InferGameType<GameModesType, SymbolsType, UserStateType>

export const game = createSlotGame<GameType>({
  id: "my-game",
  name: "My Game",
  maxWinX: 5000,
  scatterToFreespins: {},
  gameModes,
  symbols,
  userState,
  hooks: {},
})
```

  ### Configure simulation

```ts lineNumbers=30 title="index.ts"
game.configureSimulation({
  simRunsAmount: {
    base: 100000,
    bonus: 100000,
  },
  concurrency: 16,
})

game.runTasks({
  doSimulation: true,
})
```

  ### Run simulations

Running simulations will generate JSONL and CSV files containing the results of your simulated spins.
The easiest way to do this is by using the [`tsx` library](https://tsx.hirok.io/).

```sh
cd ./path-to/your-game
pnpm tsx ./index.ts --slot-engine-run
```

> **Important:** For technical reasons, the flag `--slot-engine-run` is required when running your game

**Currently, the output format is designed for compatibility with Stake Engine.**
Future versions may support additional platforms as they emerge.
Output customization is not available at this time.

[Learn more](https://slot-engine.dev/docs/core/game-tasks/simulation) about game simulations.

> **Important:** Before configuring your game, familiarize yourself with the [concepts and ideas](https://slot-engine.dev/docs/core/core-concepts) of the Core library
  to understand important terminology and background information. If you've used the Stake Math SDK before, many concepts will be familiar.

## FAQ / Common Issues

  **I**

    Ensure you `cd`'ed into the game directory where your game file is.

    If you're running the game from a different directory, add `rootDir: __dirname` to your game configuration.
