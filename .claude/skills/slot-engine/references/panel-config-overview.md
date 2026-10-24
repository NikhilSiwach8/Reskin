# Overview

> Learn the key components to setting up Panel.
> Source: https://slot-engine.dev/docs/panel/config

## Setting up Panel

Create a Panel by calling `createPanel()` and passing a configuration object.

```ts lineNumbers title="index.ts"
import { createPanel } from "@slot-engine/panel"
import { game as MyGame } from "../../path-to/my-game"

const panel = createPanel({
  games: [MyGame],
})

panel.start()
```

## createPanel() Options

| Property | Type         | Description                | Required |
| -------- | ------------ | -------------------------- | -------- |
| `games`  | `SlotGame[]` | A list of connected games. | yes      |
