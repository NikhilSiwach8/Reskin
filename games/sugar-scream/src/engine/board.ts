// Board helpers shared by the engine, the validator and the client, so a book's compact
// tumble events rebuild exactly the same boards everywhere.
import { REELS, ROWS } from './config.ts';
import type { Board, Cell, SymbolId } from './types.ts';

export function cellsOf(board: Board, symbol: SymbolId): Cell[] {
  const out: Cell[] = [];
  for (let reel = 0; reel < REELS; reel++) for (let row = 0; row < ROWS; row++) if (board[reel][row] === symbol) out.push({ reel, row });
  return out;
}

/** Cells removed by a tumble: every cell holding one of the winning symbols. */
export function winningCells(board: Board, symbols: SymbolId[]): Cell[] {
  return symbols.flatMap((s) => cellsOf(board, s));
}

/** Rows removed per reel. */
export function removedPerReel(cells: Cell[]): number[] {
  const n = new Array<number>(REELS).fill(0);
  for (const c of cells) n[c.reel]++;
  return n;
}

/**
 * Removes every cell of `symbols`, lets the rest fall and puts `fill[reel]` on top.
 * Returns null if `fill` does not match the number of removed cells.
 */
export function applyTumble(board: Board, symbols: SymbolId[], fill: SymbolId[][]): Board | null {
  const gone = new Set(symbols);
  const out: Board = [];
  for (let reel = 0; reel < REELS; reel++) {
    const keep = board[reel].filter((s) => !gone.has(s));
    const add = fill[reel] ?? [];
    if (keep.length + add.length !== ROWS) return null;
    out.push([...add, ...keep]);
  }
  return out;
}
