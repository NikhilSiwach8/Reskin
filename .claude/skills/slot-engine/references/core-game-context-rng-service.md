# RNG Service

> Service for seeded random number generation.
> Source: https://slot-engine.dev/docs/core/game-context/rng-service

## Introduction

The RNG service is connected to the underlying program. If you ever need a random outcome
in your game implementation, use this seeded RNG service for reproducible results.

## Methods

### weightedRandom()

| Method                              | Type                  |
| ----------------------------------- | --------------------- |
| `ctx.services.rng.weightedRandom()` | `(weights) => string` |

#### Parameters

| Parameter | Type                     |
| --------- | ------------------------ |
| `weights` | `Record<string, number>` |

Weighted draw of key from a mapping of keys to weights.

### randomItem()

| Method                          | Type           |
| ------------------------------- | -------------- |
| `ctx.services.rng.randomItem()` | `(array) => T` |

#### Parameters

| Parameter | Type       |
| --------- | ---------- |
| `array`   | `Array<T>` |

Gets a random item from an array.

### shuffle()

| Method                       | Type               |
| ---------------------------- | ------------------ |
| `ctx.services.rng.shuffle()` | `(array) => Array` |

#### Parameters

| Parameter | Type    |
| --------- | ------- |
| `array`   | `Array` |

Shuffles an array.

### randomFloat()

| Method                           | Type                    |
| -------------------------------- | ----------------------- |
| `ctx.services.rng.randomFloat()` | `(low, high) => number` |

#### Parameters

| Parameter | Type     |
| --------- | -------- |
| `low`     | `number` |
| `high`    | `number` |

Gets a random float between two numbers.
