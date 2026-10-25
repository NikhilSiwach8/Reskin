// Asset loader. Every runtime asset is an SVG under public/assets (written by tools/render-art.mjs).
// Paths are relative so the static build works from any CDN folder, as Stake Engine requires.
import { Assets, Texture } from 'pixi.js';
import type { SymbolId } from '../engine/types.ts';

const SYMBOL_IDS: SymbolId[] = ['BH', 'WP', 'SL', 'GM', 'PA', 'EY', 'PU', 'BT', 'CC', 'SC', 'JK'];
export const SCENE_TEXTURES = ['bg', 'panel', 'witch'] as const;

const textures = new Map<string, Texture>();

export async function loadAssets(onProgress: (p: number) => void): Promise<string[]> {
  const items = [
    ...SYMBOL_IDS.map((id) => ({ alias: `sym_${id}`, src: `assets/sym_${id}.svg`, data: { resolution: 2 } })),
    ...SCENE_TEXTURES.map((n) => ({ alias: n, src: `assets/${n}.svg`, data: { resolution: n === 'bg' ? 1 : 2 } })),
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
