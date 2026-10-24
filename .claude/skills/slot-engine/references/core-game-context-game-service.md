# Game Service

> Service providing common utility functions.
> Source: https://slot-engine.dev/docs/core/game-context/game-service

## Methods

### getReelsetById()

| Method                               | Type                      |
| ------------------------------------ | ------------------------- |
| `ctx.services.game.getReelsetById()` | `(gameMode, id) => Reels` |

#### Parameters

| Parameter  | Type     |
| ---------- | -------- |
| `gameMode` | `string` |
| `id`       | `string` |

Retrieves a reel set by its ID within a specific game mode.

### getFreeSpinsForScatters()

| Method                                        | Type                                 |
| --------------------------------------------- | ------------------------------------ |
| `ctx.services.game.getFreeSpinsForScatters()` | `(spinType, scatterCount) => number` |

#### Parameters

| Parameter      | Type       |
| -------------- | ---------- |
| `spinType`     | `SpinType` |
| `scatterCount` | `number`   |

Retrieves the number of free spins awarded for a given spin type and scatter count
based on the `scatterToFreespins` configuration.

### getResultSetByCriteria()

| Method                                       | Type                            |
| -------------------------------------------- | ------------------------------- |
| `ctx.services.game.getResultSetByCriteria()` | `(mode, criteria) => ResultSet` |

#### Parameters

| Parameter  | Type     |
| ---------- | -------- |
| `mode`     | `string` |
| `criteria` | `string` |

Retrieves a result set by its criteria within a specific game mode.

### getSymbolArray()

| Method                               | Type                 |
| ------------------------------------ | -------------------- |
| `ctx.services.game.getSymbolArray()` | `() => GameSymbol[]` |

Returns all symbols as an array.

### getCurrentGameMode()

| Method                                   | Type             |
| ---------------------------------------- | ---------------- |
| `ctx.services.game.getCurrentGameMode()` | `() => GameMode` |

Gets the configuration for the current [game mode](https://slot-engine.dev/docs/core/config/game-modes).

### verifyScatterCount()

| Method                                   | Type                      |
| ---------------------------------------- | ------------------------- |
| `ctx.services.game.verifyScatterCount()` | `(numScatters) => number` |

#### Parameters

| Parameter     | Type     |
| ------------- | -------- |
| `numScatters` | `number` |

Ensures the requested number of scatters is valid based on the game configuration.
Returns a valid number of scatters.

### awardFreespins()

| Method                               | Type               |
| ------------------------------------ | ------------------ |
| `ctx.services.game.awardFreespins()` | `(amount) => void` |

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `amount`  | `number` |

Adds the given number of free spins to the state.

### dedupeWinSymbols()

| Method                                 | Type                                       |
| -------------------------------------- | ------------------------------------------ |
| `ctx.services.game.dedupeWinSymbols()` | `(winCombinations) => { reelIdx, rowIdx }` |

#### Parameters

| Parameter         | Type               |
| ----------------- | ------------------ |
| `winCombinations` | `WinCombination[]` |

#### Return Object

| Parameter | Type     |
| --------- | -------- |
| `reelIdx` | `number` |
| `rowIdx`  | `number` |

When working with `winCombinations` returned from any win type, make sure you dedupe winning symbols.
It may be possible for the same symbol (e.g. Wild) to be included in multiple win combinations.
If you then wanted to tumble the board based on the winning symbols, that Wild symbol would be tumbled multiple times,
which might lead to errors.

Another example is games like "Sugar Rush", where winning combinations increase a multiplier on the board.
You wouldn't want the same symbol to trigger a multiplier increase multiple times.
