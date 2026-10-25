// Asset loader. Runtime assets live under public/assets: vector SVGs written by tools/render-art.mjs,
// and painted symbol WebPs imported by tools/import-painted.py, which take precedence.
// Paths are relative so the static build works from any CDN folder, as Stake Engine requires.
import { Assets, Texture } from 'pixi.js';
import type { SymbolId } from '../engine/types.ts';
import painted from './painted.json';

const SYMBOL_IDS: SymbolId[] = ['BH', 'WP', 'SL', 'GM', 'PA', 'EY', 'PU', 'BT', 'CC', 'SC', 'JK'];
export const SCENE_TEXTURES = ['panel', 'witch'] as const;

const textures = new Map<string, Texture>();
const PAINTED = new Set<string>(painted.symbols);
const BUTTONS = new Set<string>(painted.buttons);
const BACKGROUNDS = new Set<string>(painted.backgrounds);
const PANELS = new Set<string>(painted.panels);

export const isPainted = (id: SymbolId) => PAINTED.has(id);

/** URL of a painted UI panel (panel_free, panel_meter), or null. */
export function panelSrc(name: string): string | null {
  return PANELS.has(name) ? `assets/panel_${name}.webp` : null;
}

/** True when a texture was loaded (painted feature backgrounds are optional). */
export const hasTexture = (name: string) => textures.has(name);

/** URL of a painted button image, or null when the button keeps its CSS look. */
export function buttonSrc(name: string): string | null {
  return BUTTONS.has(name) ? `assets/btn_${name}.webp` : null;
}

/** URL of a symbol's art: the painted WebP when one was imported, else the vector SVG. */
export function symbolSrc(id: SymbolId): string {
  return PAINTED.has(id) ? `assets/sym_${id}.webp` : `assets/sym_${id}.svg`;
}

export async function loadAssets(onProgress: (p: number) => void): Promise<string[]> {
  const items = [
    ...SYMBOL_IDS.map((id) => ({ alias: `sym_${id}`, src: symbolSrc(id), data: { resolution: 2 } })),
    ...SCENE_TEXTURES.map((n) => ({ alias: n, src: `assets/${n}.svg`, data: { resolution: 2 } })),
    // Backgrounds: painted ones where imported, else the vector base scene.
    BACKGROUNDS.has('base') ? { alias: 'bg', src: 'assets/bg_base.webp', data: {} } : { alias: 'bg', src: 'assets/bg.svg', data: { resolution: 1 } },
    ...['cauldron', 'fullmoon'].filter((n) => BACKGROUNDS.has(n)).map((n) => ({ alias: `bg_${n}`, src: `assets/bg_${n}.webp`, data: {} })),
  ];
  let done = 0;
  const failures: string[] = [];
  await Promise.all(
    items.map(async (item) => {
      try {
        textures.set(item.alias, (await Assets.load(item)) as Texture);
      } catch {
        failures.push(item.alias);
      }
      onProgress(++done / items.length);
    }),
  );
  return failures;
}

/** Returns the texture, or an empty texture if it failed to load (the game keeps running). */
export function tex(name: string): Texture {
  return textures.get(name) ?? Texture.EMPTY;
}

export const symbolTexture = (id: SymbolId) => tex(`sym_${id}`);
