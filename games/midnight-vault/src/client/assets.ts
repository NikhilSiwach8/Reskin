// Asset manifest and loader. Every runtime asset is a separate file under public/assets
// (symbols are packed into one atlas). Paths are relative so the static build works from
// any CDN folder, as Stake Engine requires.
import { Assets, Texture } from 'pixi.js';
import type { SymbolId } from '../engine/types.ts';
import { SYMBOLS } from '../engine/config.ts';

export const TEXTURES = [
  'bg_bank',
  'bg_cursed_fortune',
  'bg_phantom_payday',
  'bg_midnight_countdown',
  'bg_final_heist',
  'frame',
  'reel_panel',
  'relic_block',
  'logo',
  'fx_chain',
  'fx_lock',
  'fx_portal',
  'fx_clock_face',
  'fx_clock_hand',
  'fx_vault_door',
  'key_cursed_fortune',
  'key_phantom_payday',
  'key_midnight_countdown',
  'seal_relic',
  'seal_phantom',
  'seal_clock',
  'fx_phantom',
  'fx_spark',
  'fx_wisp',
  'fx_coin',
] as const;

export type TextureName = (typeof TEXTURES)[number];

const textures = new Map<string, Texture>();
const missing = new Set<string>();

export async function loadAssets(onProgress: (p: number) => void): Promise<string[]> {
  const base = 'assets/';
  const items = [
    { alias: 'symbols', src: `${base}symbols.json` },
    ...TEXTURES.map((n) => ({ alias: n, src: `${base}${n}.webp` })),
  ];
  let done = 0;
  const failures: string[] = [];
  await Promise.all(
    items.map(async (item) => {
      try {
        const res = await Assets.load(item);
        if (item.alias === 'symbols') {
          for (const [name, tex] of Object.entries((res as { textures: Record<string, Texture> }).textures)) textures.set(name, tex);
        } else {
          textures.set(item.alias, res as Texture);
        }
      } catch {
        failures.push(item.alias);
        missing.add(item.alias);
      }
      onProgress(++done / items.length);
    }),
  );
  return failures;
}

/** Returns the texture, or an empty texture if it failed to load (the game keeps running). */
export function tex(name: TextureName | string): Texture {
  return textures.get(name) ?? Texture.EMPTY;
}

export function symbolTexture(id: SymbolId): Texture {
  return tex(SYMBOLS[id].asset);
}

export function isMissing(name: string): boolean {
  return missing.has(name) || (name === 'symbols' && missing.has('symbols'));
}
