# Context

> Useful functions and state available in the core
> Source: https://slot-engine.dev/docs/core/game-context

## Introduction

The context (or game context) provides access to the underlying state.
It also provides many utility functions that ease game implementation.
The context is typically accessed via the `ctx` parameter in [hooks](https://slot-engine.dev/docs/core/config/hooks).

```ts lineNumbers
type Context = GameContext<GameModesType, SymbolsType, UserStateType>

export function onHandleGameFlow(ctx: Context) {
  const reels = ctx.services.board.getRandomReelset()
  ctx.services.board.drawBoardWithRandomStops(reels)
  //                           type safe! ⤵
  const scatter = ctx.config.symbols.get("S")!
  const [count] = ctx.services.board.countSymbolsOnBoard(scatter)
}
```

## Properties

### config

You can access the complete game configuration through the context.
Keep in mind that you **shouldn't do any modifications to your game config** inside your game implementation.

```ts
const config = ctx.config
```

[Further reading](https://slot-engine.dev/docs/core/game-context/config)

### services

Services are cohesive function groups that encapsulate and manage specific parts of the game state.
You will use them often when implementing your game.

- [Game Service](https://slot-engine.dev/docs/core/game-context/game-service)
- [Data Service](https://slot-engine.dev/docs/core/game-context/data-service)
- [Board Service](https://slot-engine.dev/docs/core/game-context/board-service)
- [Wallet Service](https://slot-engine.dev/docs/core/game-context/wallet-service)
- [RNG Service](https://slot-engine.dev/docs/core/game-context/rng-service)

### state

The core game state exposes some underlying state and information about the current simulation.

[Further reading](https://slot-engine.dev/docs/core/game-context/state)
