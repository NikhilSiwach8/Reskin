// Asset registry: name -> { build, render size, runtime size, opaque? }.
import { EFFECT_ASSETS } from './effects.mjs';
import { SCENE_ASSETS } from './scenes.mjs';
import { SYMBOL_ASSETS } from './symbols.mjs';

const sym = (build) => ({ build, render: [1024, 1024], runtime: [320, 320] });

export const ASSETS = {
  ...Object.fromEntries(Object.entries(SYMBOL_ASSETS).map(([n, b]) => [n, sym(b)])),
  // High-resolution relic art for expanded 2x2..4x4 blocks.
  relic_block: { build: SYMBOL_ASSETS.sym_relic, render: [1024, 1024], runtime: [768, 768] },
  ...SCENE_ASSETS,
  ...EFFECT_ASSETS,
};
