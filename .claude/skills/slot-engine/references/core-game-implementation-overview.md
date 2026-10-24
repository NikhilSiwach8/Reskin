# Implementing your Game

> Keep full control over your game flow.
> Source: https://slot-engine.dev/docs/core/game-implementation

## Quick Start

The entire game flow will live inside a single hook that is passed to the game configuration.

```ts lineNumbers
export const game = createSlotGame({
  /* the rest of your configuration */
  hooks: {
    onHandleGameFlow(ctx) {
      // implement your game here
    },
  },
})
```

As a game implementation might be a couple hundred lines long, you could **write your implementation in a different file**.

```ts lineNumbers
import { GameContext } from "@slot-engine/core"
import { GameModesType, SymbolsType, UserStateType } from "./your-main-file"

type Context = GameContext<GameModesType, SymbolsType, UserStateType>

export function onHandleGameFlow(ctx: Context) {
  // ...
}
```

> **Example Implementation:** Check out a complete game flow example [on our
  GitHub](https://github.com/slot-engine/slot-engine/blob/main/examples/cluster_example/src/onHandleGameFlow.ts).

## Dos and Don'ts

### ✅ Do

#### Pass game context around

If you want to separate your game implementation into multiple functions to avoid code duplication,
you can safely pass the context between functions.

```ts lineNumbers
export function onHandleGameFlow(ctx: Context) {
  drawBoard(ctx)
}

function drawBoard(ctx: Context) {
  const reels = ctx.services.board.getRandomReelset()
  // ...
}
```

### ❌ Don't

#### Destroy reference to the context object

Your simulations will not work as intended if you do this.

```ts lineNumbers
export function onHandleGameFlow(ctx: Context) {
  const nope = { ...ctx }
  const yesButWhy = ctx
}
```

## Game Flow Visualization

To help you understand slot game flows, here is a graphic showing a general game flow.

![Game Flow Graphic](/game-flow.png)

## Next Steps

Learn about the [context object](https://slot-engine.dev/docs/core/game-context) and what role it plays when implementing your game.
