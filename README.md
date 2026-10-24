# Reskin: Stake Engine skills for Claude Code

This repository bundles Claude Code skills for building slot and casino games on [Stake Engine](https://engine.stake.com/). The skills live in `.claude/skills/`, so Claude Code loads them automatically when you open this repo. To use them everywhere, copy any skill folder into `~/.claude/skills/`.

## Sources

| Skill(s) | Source | Commit | License |
|---|---|---|---|
| `stake-math-sdk`, `stake-web-sdk` | [ReSkin-Games/stake-engine-skills](https://github.com/ReSkin-Games/stake-engine-skills) | `b49e401` | MIT (copy in each skill folder) |
| 34 skills: `stake-game-developer`, `stake-platform-architect`, `game-math-director`, `senior-game-math-engineer`, `rtp-optimizer`, `book-generator`, `pixi-svelte-integrator`, … | [egorfedorov/Slot-Casino-Game-Developer-Skills-for-Stake-Engine](https://github.com/egorfedorov/Slot-Casino-Game-Developer-Skills-for-Stake-Engine) | `caf5de3` | No license file upstream |
| `stake-engine-ts-client` | Written for this repo from the source of [engineio/ts-client](https://github.com/engineio/ts-client) (npm `stake-engine` 0.1.32) | `df9e126` | Upstream package is ISC |
| `slot-engine` | Written for this repo. `references/` is converted from the docs of [slot-engine/slot-engine](https://github.com/slot-engine/slot-engine) and `examples/` is copied from its example games | `17ca128` | No license file upstream |

All skills except the two marked "written for this repo" are copied unchanged. To refresh one, re-clone its source and copy the skill folder over the existing one.

## Picking a skill

- **Math in Python (official SDK):** `stake-math-sdk`
- **Math in TypeScript:** `slot-engine`
- **Frontend (official Svelte/Pixi SDK):** `stake-web-sdk`
- **Frontend talking to the RGS from any framework:** `stake-engine-ts-client`
- **End-to-end workflow, compliance and approval gates:** `stake-game-developer`, `stake-platform-architect`
- **RTP, balancing and books:** `rtp-optimizer`, `auto-balancer`, `book-generator`, `game-math-director`, `senior-game-math-engineer`
- **UI, UX, animation and audio:** `slot-ui-studio`, `ui-slot-ux-designer`, `event-animation-designer`, `css-motion-designer`, `pixi-svelte-integrator`, `slot-vfx-artist`, `slot-audio-engineer`, `turbo-spin-designer`, `autoplay-system-designer`
- **Engine and performance:** `cpp-engine-core`, `cpp-performance-engineer`, `low-latency-systems`, `parallel-computing`, `wasm-integration`, `rng-crypto-specialist`
