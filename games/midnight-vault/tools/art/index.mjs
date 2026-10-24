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
  // Painted sources (art/painted) define these shapes, so their sizes follow the painted aspect ratios.
  logo: { ...SCENE_ASSETS.logo, render: [1536, 1024], runtime: [1152, 768] },
  fx_phantom: { ...EFFECT_ASSETS.fx_phantom, render: [1024, 1024], runtime: [512, 512] },
  key_cursed_fortune: { ...EFFECT_ASSETS.key_cursed_fortune, render: [1024, 1024], runtime: [400, 400] },
  key_phantom_payday: { ...EFFECT_ASSETS.key_phantom_payday, render: [1024, 1024], runtime: [400, 400] },
  key_midnight_countdown: { ...EFFECT_ASSETS.key_midnight_countdown, render: [1024, 1024], runtime: [400, 400] },
};
