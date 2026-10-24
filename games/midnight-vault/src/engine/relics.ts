// Cursed Relic expansion, Relic Surge and Relic Overload.
//
// Expansion rules (authoritative; the client only replays the resulting blocks):
// 1. Every newly landed Relic draws a multiplier and an expansion size from the
//    active relic table. Relic Overload can raise the minimum size and scale the
//    multiplier.
// 2. Every new Relic first becomes a 1x1 block.
// 3. Relics are processed in reading order (reel 1 top to bottom, then reel 2 ...).
//    A Relic of size n grows right and down from where it landed. If the square
//    would leave the grid it is shifted left/up, so the landing cell stays inside.
// 4. A square is blocked if it contains a Vault Key, a cell owned by another block
//    that is already larger than 1x1 or pre-existing, or a caller-defined obstacle
//    (for example a locked reel). Blocked squares are retried one size smaller.
// 5. A square may cover other new 1x1 Relics: they are absorbed, their multiplier is
//    added to the growing block, and they do not expand on their own.
import { REELS, ROWS, FEATURES, type RelicTable } from './config.ts';
import { Grid, squareCells } from './grid.ts';
import type { Rng } from './rng.ts';
import type { Cell, RelicBlock } from './types.ts';

export interface ExpandOptions {
  table: RelicTable;
  /** Relic Overload level (0 = inactive). */
  overloadLevel?: number;
  obstacle?: (c: Cell) => boolean;
  /** Restrict which relic cells count as newly landed (default: every unblocked Relic). */
  only?: (c: Cell) => boolean;
}

export interface ExpandResult {
  blocks: (RelicBlock & { absorbed: Cell[] })[];
  landed: number;
}

export function expandRelics(grid: Grid, rng: Rng, opts: ExpandOptions): ExpandResult {
  const level = opts.overloadLevel ?? 0;
  const minSize = FEATURES.overload.minSize[level];
  const factor = FEATURES.overload.multFactor[level];
  const bonus = FEATURES.overload.multBonus[level];
  const preExisting = new Set(grid.blocks.keys());

  const fresh = grid
    .find((s, c) => s === 'RL' && grid.blockAt[c.reel][c.row] === -1 && (opts.only?.(c) ?? true))
    .map((c) => {
      const mult = (rng.weighted(opts.table.mult) + bonus) * factor;
      const size = Math.max(minSize, rng.weighted(opts.table.size));
      return { block: grid.addBlock(c, c, 1, mult), want: size };
    });

  const absorbedBy = new Map<number, Cell[]>();
  const absorbed = new Set<number>();
  for (const { block, want } of fresh) {
    if (absorbed.has(block.id)) continue;
    absorbedBy.set(block.id, []);
    for (let n = Math.min(want, REELS, ROWS); n >= 2; n--) {
      const topLeft = { reel: Math.min(block.origin.reel, REELS - n), row: Math.min(block.origin.row, ROWS - n) };
      const square = squareCells(topLeft, n);
      const swallowed: number[] = [];
      const ok = square.every((c) => {
        if (grid.get(c) === 'VK') return false;
        if (opts.obstacle?.(c)) return false;
        const id = grid.blockAt[c.reel][c.row];
        if (id === -1 || id === block.id) return true;
        const other = grid.blocks.get(id)!;
        if (preExisting.has(id) || other.size > 1 || absorbed.has(id)) return false;
        swallowed.push(id);
        return true;
      });
      if (!ok) continue;
      for (const id of new Set(swallowed)) {
        const other = grid.blocks.get(id)!;
        block.mult += other.mult;
        absorbed.add(id);
        absorbedBy.get(block.id)!.push(other.origin);
        grid.removeBlock(id);
      }
      grid.growBlock(block.id, topLeft, n);
      break;
    }
  }

  const blocks = fresh
    .filter(({ block }) => !absorbed.has(block.id))
    .map(({ block }) => ({ ...grid.blocks.get(block.id)!, absorbed: absorbedBy.get(block.id) ?? [] }));
  return { blocks, landed: fresh.length };
}

/**
 * Relic Surge: places a guaranteed relic block of `size` at a random valid square.
 * Valid squares avoid Vault Keys, existing blocks and obstacles. Returns undefined
 * only if no square of that size (or smaller) fits.
 */
export function relicSurge(
  grid: Grid,
  rng: Rng,
  size: number,
  mult: number,
  obstacle?: (c: Cell) => boolean,
): RelicBlock | undefined {
  for (let n = size; n >= 1; n--) {
    const options: Cell[] = [];
    for (let reel = 0; reel <= REELS - n; reel++) {
      for (let row = 0; row <= ROWS - n; row++) {
        const sq = squareCells({ reel, row }, n);
        if (sq.every((c) => grid.get(c) !== 'VK' && grid.blockAt[c.reel][c.row] === -1 && !obstacle?.(c))) options.push({ reel, row });
      }
    }
    if (options.length) {
      const tl = options[rng.int(options.length)];
      return grid.addBlock({ ...tl }, tl, n, mult);
    }
  }
  return undefined;
}

/** Relic Overload level for a charge value. */
export function overloadLevel(charge: number): number {
  return FEATURES.overload.thresholds.filter((t) => charge >= t).length;
}
