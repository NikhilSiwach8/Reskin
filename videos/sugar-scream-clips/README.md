# Sugar Scream clips

Short promo clips for [Sugar Scream](../../games/sugar-scream), made with [Remotion](https://www.remotion.dev) from the game's own painted art, music and sound effects. All clips are 1920x1080 at 30 fps.

| Folder | Clip | Length | What happens |
|---|---|---|---|
| Intro | `Slot-Intro` | 10 s | The witch streaks across the sky, the logo slams in, candies rain, the five bonuses are named, "Win up to 5,000x" |
| Bonus-Entry | `Entry-Haunted-Cauldron`, `Entry-Full-Moon`, `Entry-Trick-or-Treat`, `Entry-Loot-Box` | 7 s | The game's door transition: candy tunnel and BONUS! banner, the haunted hallway, a knock, the doors creak open, the camera dives through into the bonus world and its title lands |
| Wins | `Win-Big`, `Win-Mega`, `Win-Monster`, `Win-Sugar-Scream`, `Win-Max` | 4.5 to 6.3 s | The win climbs through its tiers like in the game (Big, then Mega, ...) over rays and a fountain of candy and coins, the amount counting up in step |
| Loading | `game-loading-l`, `game-loading-p` | 6 s loop | The painted loading art breathing, the brew glowing, embers rising and candies drifting down the sides; silent and seamless, behind the game's progress bar |
| Game moments | `game-spell`, `game-retrigger`, `game-lollipop`, `game-fs-total` (`-l` / `-p`) | 1.8 to 4 s | The Witch's Spell cut-in, the +5 free spins retrigger, the Golden Lollipop reveal and the free-spins total (the game overlays the amount); each ends on a white flash back to the board |
| Jumpscares | `Jumpscare-Ghost`, `Jumpscare-Witch`, `Jumpscare-Pumpkin`, `Jumpscare-Skull` | 5.8 to 6.3 s | A dark, flickering scene with a heartbeat and a rising drone, then the creature slams into the camera (inverted, shaking, strobing, RGB split, screech), then the logo |

## Commands

```bash
npm i
npm run dev          # Remotion Studio: preview and edit every clip
npm run render:all   # all clips to out/<id>.mp4 (or: node render-all.mjs Win-Max)
```

If Remotion cannot download its headless Chrome, point it at a local one: `REMOTION_BROWSER=/path/to/chrome npm run render:all`.

## Editing

Each clip is one registration in `src/Root.tsx` with its props inline, so the text, amounts, backgrounds and colours can be changed there or in Studio's props panel. Make a new win clip by duplicating a `Win-*` registration and changing `tiers`, `amount` and `multiplier`, or a new jumpscare by choosing another `background` and `monster` (any `public/art` file).

## Sources

- Art: `public/art`, copied from `games/sugar-scream/public/assets`.
- Music: `public/music`, the game's music cuts.
- Sound effects: `public/sfx`. Most are rendered from the game's synthesized effects (`games/sugar-scream/src/client/audio.ts`). The jumpscare screech, impact, heartbeat, riser and coin shower were synthesized for these clips the same way.
- Fonts: Creepster and Fredoka (SIL Open Font License), from the game's `@fontsource` packages.

The music track must be licensed for commercial use before these clips are published (see the game's README).
