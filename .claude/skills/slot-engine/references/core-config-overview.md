# Overview

> Learn the key components to defining your game.
> Source: https://slot-engine.dev/docs/core/config

## Setting up your game

Create a game by calling `createSlotGame()` and passing a configuration object.
Begin by defining basic game details, then explore the comprehensive [configuration options](#options) detailed below.

```ts lineNumbers
import { createSlotGame, SPIN_TYPE } from "@slot-engine/core"

export const game = createSlotGame({
  id: "my-game",
  name: "My Game",
  maxWinX: 5000,
  padSymbols: 1,
  scatterToFreespins: {
    [SPIN_TYPE.BASE_GAME]: {
      3: 10,
      4: 12,
      5: 15,
    },
    [SPIN_TYPE.FREE_SPINS]: {
      3: 6,
      4: 8,
      5: 10,
    },
  },
  symbols: {},
  gameModes: {},
  userState: {},
  hooks: {
    onHandleGameFlow(ctx) {},
  },
})
```

When using TypeScript, you will encounter a type error.
This is expected because `createSlotGame` requires a type argument. Let's create a type for your game.

```ts lineNumbers
import { createSlotGame, SPIN_TYPE, InferGameType } from "@slot-engine/core"

export type GameType = InferGameType<any, any, any>

export const game = createSlotGame<GameType>({})
```

The utility type `InferGameType` requires three type arguments: game modes, symbols, and state.
Since we haven't configured these yet, you can use `any` for now.

You can now prepare the rest of the configuration.

```ts lineNumbers
import {
  createSlotGame,
  SPIN_TYPE,
  InferGameType,
  defineGameModes,
  defineSymbols,
  defineUserState,
} from "@slot-engine/core"

export const gameModes = defineGameModes({})
export type GameModesType = typeof gameModes

export const symbols = defineSymbols({})
export type SymbolsType = typeof symbols

export const userState = defineUserState({})
export type UserStateType = typeof userState

export type GameType = InferGameType<GameModesType, SymbolsType, UserStateType>

export const game = createSlotGame<GameType>({
  /* the rest of your configuration */
  symbols,
  gameModes,
  userState,
})
```

You have now completed the basic game setup.
Continue by configuring [symbols](https://slot-engine.dev/docs/core/config/symbols),
[game modes](https://slot-engine.dev/docs/core/config/game-modes),and [state](https://slot-engine.dev/docs/core/config/custom-state).

At the heart of your game lies the actual [implementation](https://slot-engine.dev/docs/core/game-implementation).

Finally, [simulate](https://slot-engine.dev/docs/core/game-tasks/simulation) your game, tweak settings to improve the feel of it,
and [optimize](https://slot-engine.dev/docs/core/game-tasks/optimization) results to achieve your desired RTP.

## createSlotGame() Options

| Property             | Type                                     | Description                                                                                                                                                                                                                             | Required |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `id`                 | `string`                                 | A unique identifier for your game.                                                                                                                                                                                                      | yes      |
| `name`               | `string`                                 | The name of your game.                                                                                                                                                                                                                  | yes      |
| `maxWinX`            | `number`                                 | The maximum bet multiplier payout. Wins exceeding this number will be capped.                                                                                                                                                           | yes      |
| `gameModes`          | `Record<string, GameMode>`               | See: [Game Configuration: Game Modes](https://slot-engine.dev/docs/core/config/game-modes)                                                                                                                                                                     | yes      |
| `symbols`            | `Record<string, GameSymbol>`             | See: [Game Configuration: Symbols](https://slot-engine.dev/docs/core/config/symbols)                                                                                                                                                                           | yes      |
| `padSymbols`         | `number`                                 | Amount of padding symbol rows above and below the active board.<br/>Used to display partially visible symbols in the frontend at the top and bottom of the board.<br/><br/>Defaults to 1                                                | yes      |
| `scatterToFreespins` | `Record<string, Record<number, number>>` | A mapping from spin type to scatter counts to the number of free spins awarded.                                                                                                                                                         | yes      |
| `userState`          | `Record<string, any>`                    | See: [Game Configuration: User State](https://slot-engine.dev/docs/core/config/custom-state)                                                                                                                                                                   | yes      |
| `hooks`              | `Record<string, (ctx) => unknown>`       | See: [Game Configuration: Hooks](https://slot-engine.dev/docs/core/config/hooks)                                                                                                                                                                               | yes      |
| `rootDir`            | `string`                                 | Normally you would `cd` into the game directory and run it from there. If you run your game from a different file or `process.cwd()` is not where your game lies, specify this option and provide a path. `__dirname` should work fine. |
