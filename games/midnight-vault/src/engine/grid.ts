// Mutable grid state for one spin: symbols plus Cursed Relic block ownership.
import { REELS, ROWS } from './config.ts';
import type { Board, Cell, RelicBlock, SymbolId } from './types.ts';

export class Grid {
  symbols: Board;
  /** blockAt[reel][row] = id of the relic block owning the cell, or -1. */
  blockAt: number[][];
  blocks = new Map<number, RelicBlock>();
  private nextId = 1;

  constructor(board: Board) {
    this.symbols = board.map((col) => [...col]);
    this.blockAt = board.map((col) => col.map(() => -1));
  }

  get(c: Cell): SymbolId {
    return this.symbols[c.reel][c.row];
  }

  set(c: Cell, s: SymbolId): void {
    this.symbols[c.reel][c.row] = s;
  }

  snapshot(): Board {
    return this.symbols.map((col) => [...col]);
  }

  cells(): Cell[] {
    const out: Cell[] = [];
    for (let reel = 0; reel < REELS; reel++) for (let row = 0; row < ROWS; row++) out.push({ reel, row });
    return out;
  }

  find(pred: (s: SymbolId, c: Cell) => boolean): Cell[] {
    return this.cells().filter((c) => pred(this.get(c), c));
  }

  count(sym: SymbolId): number {
    return this.find((s) => s === sym).length;
  }

  /** Creates a block and claims its cells as Relic wilds. */
  addBlock(origin: Cell, topLeft: Cell, size: number, mult: number): RelicBlock {
    const block: RelicBlock = { id: this.nextId++, reel: topLeft.reel, row: topLeft.row, size, mult, origin };
    this.blocks.set(block.id, block);
    for (const c of squareCells(topLeft, size)) {
      this.set(c, 'RL');
      this.blockAt[c.reel][c.row] = block.id;
    }
    return block;
  }

  /** Grows an existing block to a new square and claims those cells as Relics. */
  growBlock(id: number, topLeft: Cell, size: number): void {
    const block = this.blocks.get(id);
    if (!block) throw new Error(`growBlock: unknown block ${id}`);
    block.reel = topLeft.reel;
    block.row = topLeft.row;
    block.size = size;
    for (const c of squareCells(topLeft, size)) {
      this.set(c, 'RL');
      this.blockAt[c.reel][c.row] = id;
    }
  }

  removeBlock(id: number): void {
    this.blocks.delete(id);
    for (const c of this.cells()) if (this.blockAt[c.reel][c.row] === id) this.blockAt[c.reel][c.row] = -1;
  }

  /** Replaces a whole reel (used by respins); any block cells on it are released. */
  replaceReel(reel: number, symbols: SymbolId[], keep?: (row: number) => boolean): void {
    for (let row = 0; row < ROWS; row++) {
      if (keep?.(row)) continue;
      const id = this.blockAt[reel][row];
      if (id !== -1) this.removeBlock(id);
      this.symbols[reel][row] = symbols[row];
    }
  }

  blockOf(c: Cell): RelicBlock | undefined {
    const id = this.blockAt[c.reel][c.row];
    return id === -1 ? undefined : this.blocks.get(id);
  }
}

export function squareCells(topLeft: Cell, size: number): Cell[] {
  const out: Cell[] = [];
  for (let dr = 0; dr < size; dr++) for (let dc = 0; dc < size; dc++) out.push({ reel: topLeft.reel + dc, row: topLeft.row + dr });
  return out;
}

export function inBounds(c: Cell): boolean {
  return c.reel >= 0 && c.reel < REELS && c.row >= 0 && c.row < ROWS;
}

export const cellKey = (c: Cell): string => `${c.reel},${c.row}`;
