// Asset registry: name -> { build, render size, runtime size, opaque? }.
import { EFFECT_ASSETS } from './effects.mjs';
import { SCENE_ASSETS } from './scenes.mjs';
import { SYMBOL_ASSETS } from './symbols.mjs';

const sym = (build) => ({ build, render: [1024, 1024], runtime: [256, 256] });

export const ASSETS = {
  ...Object.fromEntries(Object.entries(SYMBOL_ASSETS).map(([n, b]) => [n, sym(b)])),
  ...SCENE_ASSETS,
  ...EFFECT_ASSETS,
};
