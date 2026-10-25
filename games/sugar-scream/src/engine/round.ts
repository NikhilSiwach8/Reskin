// Plays one complete round and records it as a book of events.
import {
  BET_MODES, CAULDRON_SCATTERS, DOORS, DRAWS, FREE_SPINS, FULL_MOON_SCATTERS, KNOCKS, KNOCK_TABLE, MIN_CLUSTER,
  MULT_VALUES, PAYING, REELS, RETRIGGER_SCATTERS, RETRIGGER_SPINS, ROWS, SPELL_CELLS, SPELL_CHANCE, SPELL_SYMBOLS,
  TRICK_OR_TREAT_SCATTERS, WINCAP, clusterPay, scatterPay, type DrawTable,
} from './config.ts';
import { cellsOf } from './board.ts';
import { Rng } from './rng.ts';
import type { Board, Book, Cell, ClusterWin, FreeSpinKind, GameEvent, MultCell, SymbolId } from './types.ts';

export type ModeName = 'base' | 'ante' | 'bonus' | 'fullmoon';

/** The board plus the multiplier carried by each Jack-o'-Lantern (0 elsewhere). */
export interface Grid {
  board: Board;
  mult: number[][];
}

export interface RoundOptions {
  /** Forced first board (tests and forced searches). */
  grid?: Grid;
  /** Disable the Witch's Spell (tests). */
  noSpell?: boolean;
}

const clone = (b: Board): Board => b.map((c) => [...c]);
const cloneGrid = (g: Grid): Grid => ({ board: clone(g.board), mult: g.mult.map((c) => [...c]) });

export function multCells(g: Grid): MultCell[] {
  const out: MultCell[] = [];
  for (let reel = 0; reel < REELS; reel++) for (let row = 0; row < ROWS; row++) if (g.board[reel][row] === 'JK') out.push({ reel, row, value: g.mult[reel][row] });
  return out;
}

export { cellsOf };

function drawSymbol(rng: Rng, table: DrawTable): [SymbolId, number] {
  const s = rng.weighted(DRAWS[table]);
  return [s, s === 'JK' ? rng.weighted(MULT_VALUES) : 0];
}

export function drawGrid(rng: Rng, table: DrawTable): Grid {
  const board: Board = [];
  const mult: number[][] = [];
  for (let reel = 0; reel < REELS; reel++) {
    board.push([]);
    mult.push([]);
    for (let row = 0; row < ROWS; row++) {
      const [s, m] = drawSymbol(rng, table);
      board[reel].push(s);
      mult[reel].push(m);
    }
  }
  return { board, mult };
}

/** A base-table board with exactly `n` Skull Lollipops (bonus buys, forced searches, tests). */
export function forcedScatterGrid(rng: Rng, n: number): Grid {
  const g = drawGrid(rng, 'base');
  const all: Cell[] = [];
  for (let reel = 0; reel < REELS; reel++) {
    for (let row = 0; row < ROWS; row++) {
      all.push({ reel, row });
      while (g.board[reel][row] === 'SC') g.board[reel][row] = drawSymbol(rng, 'base')[0];
    }
  }
  for (const c of rng.sample(all, n)) g.board[c.reel][c.row] = 'SC';
  return g;
}

export function evaluate(board: Board): ClusterWin[] {
  const wins: ClusterWin[] = [];
  for (const symbol of PAYING) {
    const cells = cellsOf(board, symbol);
    const pay = clusterPay(symbol, cells.length);
    if (pay > 0) wins.push({ symbol, count: cells.length, pay });
  }
  return wins;
}

/** Removes `cells`, lets everything above fall down and refills each reel from the top. */
export function tumble(g: Grid, cells: Cell[], rng: Rng, table: DrawTable): Grid {
  const out: Grid = { board: [], mult: [] };
  for (let reel = 0; reel < REELS; reel++) {
    const gone = new Set(cells.filter((c) => c.reel === reel).map((c) => c.row));
    const keepS: SymbolId[] = [];
    const keepM: number[] = [];
    for (let row = 0; row < ROWS; row++) {
      if (gone.has(row)) continue;
      keepS.push(g.board[reel][row]);
      keepM.push(g.mult[reel][row]);
    }
    const newS: SymbolId[] = [];
    const newM: number[] = [];
    for (let i = 0; i < gone.size; i++) {
      const [s, m] = drawSymbol(rng, table);
      newS.push(s);
      newM.push(m);
    }
    out.board.push([...newS, ...keepS]);
    out.mult.push([...newM, ...keepM]);
  }
  return out;
}

class RoundBuilder {
  events: GameEvent[] = [];
  total = 0;
  capped = false;
  tags = new Set<string>();

  /** Adds money, clamping to the win cap. */
  pay(kind: 'spin' | 'scatter' | 'treat', amount: number): void {
    if (this.capped || amount <= 0) return;
    const add = Math.min(amount, WINCAP - this.total);
    this.total += add;
    this.events.push({ type: 'win', kind, amount: add, totalWin: this.total });
    if (this.total >= WINCAP) {
      this.capped = true;
      this.events.push({ type: 'wincap', totalWin: this.total });
    }
  }
}

interface SpinResult {
  grid: Grid;
  tumbleTotal: number;
}

/** Evaluates and tumbles until the board has no win. Records events; pays nothing. */
function tumbleSequence(rb: RoundBuilder, start: Grid, rng: Rng, table: DrawTable): SpinResult {
  let g = start;
  let tumbleTotal = 0;
  for (;;) {
    const wins = evaluate(g.board);
    if (!wins.length) return { grid: g, tumbleTotal };
    tumbleTotal += wins.reduce((s, w) => s + w.pay, 0);
    rb.events.push({ type: 'tumbleWin', wins, tumbleTotal });
    const removed = wins.flatMap((w) => cellsOf(g.board, w.symbol));
    const next = tumble(g, removed, rng, table);
    const fill = next.board.map((col, reel) => col.slice(0, removed.filter((c) => c.reel === reel).length));
    g = next;
    rb.events.push({ type: 'tumble', fill, mults: multCells(g) });
  }
}

/** Witch's Spell: turns enough cells into one symbol for a win of at least MIN_CLUSTER. */
function castSpell(rb: RoundBuilder, g: Grid, rng: Rng): Grid {
  const symbol = rng.weighted(SPELL_SYMBOLS);
  const have = cellsOf(g.board, symbol).length;
  const candidates: Cell[] = [];
  for (let reel = 0; reel < REELS; reel++) {
    for (let row = 0; row < ROWS; row++) {
      const s = g.board[reel][row];
      if (s !== symbol && s !== 'SC' && s !== 'JK') candidates.push({ reel, row });
    }
  }
  const k = Math.max(rng.weighted(SPELL_CELLS), MIN_CLUSTER - have);
  const cells = rng.sample(candidates, k);
  const out = cloneGrid(g);
  for (const c of cells) out.board[c.reel][c.row] = symbol;
  rb.events.push({ type: 'witchSpell', symbol, cells, board: clone(out.board) });
  rb.tags.add('witchSpell');
  return out;
}

function trickOrTreat(rb: RoundBuilder, cells: Cell[], rng: Rng): boolean {
  rb.tags.add('trickOrTreat');
  rb.events.push({ type: 'trickOrTreat', cells, knocks: KNOCKS });
  const doors = rng.shuffle(Array.from({ length: DOORS }, (_, i) => i));
  let total = 0;
  let lollipop = false;
  for (let i = 0; i < KNOCKS && !lollipop; i++) {
    const o = rng.weighted(KNOCK_TABLE);
    const index = doors[i];
    if (o === 'trick') rb.events.push({ type: 'knock', index, prize: 'trick' });
    else if (o === 'lollipop') {
      rb.events.push({ type: 'knock', index, prize: 'lollipop' });
      lollipop = true;
    } else {
      rb.events.push({ type: 'knock', index, prize: 'treat', amount: o });
      total += o;
    }
  }
  rb.events.push({ type: 'trickOrTreatEnd', total, lollipop });
  rb.pay('treat', total);
  if (lollipop) rb.tags.add('goldenLollipop');
  return lollipop;
}

function freeSpins(rb: RoundBuilder, kind: FreeSpinKind, cells: Cell[], rng: Rng): void {
  const def = FREE_SPINS[kind];
  rb.tags.add(kind);
  let total = def.spins;
  let cauldron = def.cauldron;
  const startWin = rb.total;
  rb.events.push({ type: 'freeSpinsStart', kind, spins: total, cauldron, cells });
  for (let i = 1; i <= total && !rb.capped; i++) {
    rb.events.push({ type: 'freeSpin', index: i, total });
    const g = drawGrid(rng, def.draw);
    rb.events.push({ type: 'reveal', board: clone(g.board), mults: multCells(g), phase: 'free' });
    const res = tumbleSequence(rb, g, rng, def.draw);
    if (res.tumbleTotal > 0) {
      const cellsM = multCells(res.grid);
      const landed = cellsM.reduce((s, c) => s + c.value, 0);
      const mult = Math.max(1, landed + cauldron);
      if (landed > 0 || cauldron > 0) rb.events.push({ type: 'multiplier', cells: cellsM, landed, cauldronBefore: cauldron, mult, base: res.tumbleTotal });
      rb.pay('spin', res.tumbleTotal * mult);
      if (landed > 0 && !rb.capped) {
        cauldron += landed * def.pour;
        rb.events.push({ type: 'cauldron', value: cauldron });
      }
    }
    const sc = cellsOf(res.grid.board, 'SC');
    if (sc.length >= RETRIGGER_SCATTERS && !rb.capped) {
      total += RETRIGGER_SPINS;
      rb.tags.add('retrigger');
      rb.events.push({ type: 'retrigger', added: RETRIGGER_SPINS, total, cells: sc });
    }
  }
  rb.events.push({ type: 'freeSpinsEnd', kind, featureWin: rb.total - startWin, totalWin: rb.total });
}

export function playRound(id: number, mode: ModeName, rng: Rng, opts: RoundOptions = {}): Book {
  const def = BET_MODES.find((m) => m.name === mode);
  if (!def) throw new Error(`unknown mode ${mode}`);
  const rb = new RoundBuilder();
  let g = opts.grid ? cloneGrid(opts.grid) : def.forcedScatters ? forcedScatterGrid(rng, def.forcedScatters) : drawGrid(rng, def.draw);
  rb.events.push({ type: 'reveal', board: clone(g.board), mults: [], phase: 'base' });
  if (!def.buy && !opts.noSpell && rng.chance(SPELL_CHANCE)) g = castSpell(rb, g, rng);
  const res = tumbleSequence(rb, g, rng, def.draw);
  rb.pay('spin', res.tumbleTotal);
  const sc = cellsOf(res.grid.board, 'SC');
  rb.pay('scatter', scatterPay(sc.length));
  if (!rb.capped) {
    if (sc.length >= FULL_MOON_SCATTERS) freeSpins(rb, 'fullMoon', sc, rng);
    else if (sc.length >= CAULDRON_SCATTERS) freeSpins(rb, 'cauldron', sc, rng);
    else if (sc.length === TRICK_OR_TREAT_SCATTERS && trickOrTreat(rb, sc, rng) && !rb.capped) freeSpins(rb, 'cauldron', sc, rng);
  }
  rb.events.push({ type: 'finalWin', amount: rb.total });
  if (rb.capped) rb.tags.add('wincap');
  const criteria = rb.capped ? 'wincap' : rb.total === 0 ? '0' : rb.tags.has('cauldron') || rb.tags.has('fullMoon') ? 'freegame' : 'basegame';
  return { id, payoutMultiplier: rb.total, events: rb.events, criteria, tags: [...rb.tags] };
}
