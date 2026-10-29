// Book validation. Used by the tests, the math pipeline and the client: the client
// refuses to play a round whose events are not internally consistent.
import { applyTumble, cellsOf } from './board.ts';
import { FREE_SPINS, LOOT_TIERS, PAYING, REELS, ROWS, SYMBOLS, WINCAP, clusterPay } from './config.ts';
import type { Board, Cell, GameEvent, MultCell, SymbolId } from './types.ts';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const inGrid = (c: Cell) => isInt(c?.reel) && isInt(c?.row) && c.reel < REELS && c.row < ROWS;

function checkBoard(board: unknown, where: string, errors: string[]): board is Board {
  if (!Array.isArray(board) || board.length !== REELS) {
    errors.push(`${where}: board must have ${REELS} reels`);
    return false;
  }
  for (const col of board) {
    if (!Array.isArray(col) || col.length !== ROWS || col.some((s) => !(s in SYMBOLS))) {
      errors.push(`${where}: invalid reel ${JSON.stringify(col)}`);
      return false;
    }
  }
  return true;
}

function checkMults(mults: MultCell[], board: Board, where: string, errors: string[]): void {
  const jk = cellsOf(board, 'JK').length;
  if (mults.length !== jk) errors.push(`${where}: ${mults.length} multipliers for ${jk} Jack-o'-Lanterns`);
  for (const m of mults) if (!inGrid(m) || board[m.reel]?.[m.row] !== 'JK' || !isInt(m.value) || m.value < 2) errors.push(`${where}: bad multiplier`);
}

function checkCells(cells: unknown, where: string, errors: string[]): void {
  if (!Array.isArray(cells) || !cells.every(inGrid)) errors.push(`${where}: cell out of range`);
}

export function validateBook(book: { payoutMultiplier: unknown; events: unknown }): ValidationResult {
  const errors: string[] = [];
  if (!isInt(book.payoutMultiplier)) errors.push('payoutMultiplier must be a non-negative integer');
  if (!Array.isArray(book.events) || book.events.length === 0) return { ok: false, errors: [...errors, 'events missing'] };
  const events = book.events as GameEvent[];
  let total = 0;
  let capped = false;
  let reveals = 0;
  let board: Board | null = null;
  let spinBase = 0; // this spin's tumble win before multipliers
  let spinMult = 1;
  let lastWin: SymbolId[] = [];
  let lootMult = 0;
  // the Jack-o'-Lanterns on the board (free spins), and the free-spin kind being played
  let mults: MultCell[] = [];
  let freeKind: keyof typeof FREE_SPINS | null = null;

  events.forEach((e, i) => {
    const where = `event ${i} (${e?.type})`;
    if (capped && e.type !== 'finalWin' && e.type !== 'freeSpinsEnd') errors.push(`${where}: event after win cap`);
    switch (e.type) {
      case 'reveal':
        reveals++;
        spinBase = 0;
        spinMult = 1;
        lastWin = [];
        if (checkBoard(e.board, where, errors)) {
          board = e.board;
          if (e.phase === 'free') checkMults(e.mults, board, where, errors);
          mults = Array.isArray(e.mults) ? [...e.mults] : [];
        }
        break;
      case 'witchSpell':
        checkCells(e.cells, where, errors);
        if (checkBoard(e.board, where, errors)) {
          if (board && e.cells.some((c) => e.board[c.reel][c.row] !== e.symbol)) errors.push(`${where}: spell cells do not hold ${e.symbol}`);
          board = e.board;
        }
        break;
      case 'tumbleWin': {
        let sum = 0;
        const b = board as Board | null;
        const paying = b ? PAYING.filter((s) => clusterPay(s, cellsOf(b, s).length) > 0) : [];
        if (b && (paying.length !== e.wins.length || e.wins.some((w) => !paying.includes(w.symbol)))) errors.push(`${where}: wins do not match the board`);
        for (const w of e.wins) {
          if (b && cellsOf(b, w.symbol).length !== w.count) errors.push(`${where}: ${w.symbol} count ${w.count} does not match the board`);
          if (w.pay !== clusterPay(w.symbol, w.count)) errors.push(`${where}: ${w.symbol} x${w.count} should pay ${clusterPay(w.symbol, w.count)}`);
          sum += w.pay;
        }
        spinBase += sum;
        lastWin = e.wins.map((w) => w.symbol);
        if (e.tumbleTotal !== spinBase) errors.push(`${where}: tumbleTotal ${e.tumbleTotal} != ${spinBase}`);
        break;
      }
      case 'tumble': {
        if (!board || !lastWin.length) {
          errors.push(`${where}: tumble without a win`);
          break;
        }
        const next = Array.isArray(e.fill) && e.fill.every((c) => Array.isArray(c) && c.every((s) => s in SYMBOLS)) ? applyTumble(board, lastWin, e.fill) : null;
        if (!next) errors.push(`${where}: fill does not match the removed cells`);
        else {
          board = next;
          if (e.mults.length || cellsOf(next, 'JK').length) checkMults(e.mults, next, where, errors);
          mults = Array.isArray(e.mults) ? [...e.mults] : [];
        }
        lastWin = [];
        break;
      }
      case 'freeSpinsStart':
        freeKind = e.kind in FREE_SPINS ? e.kind : null;
        break;
      case 'pumpkinSplit': {
        // Full Moon only, after a winning spin's tumbles: each copy keeps its source's value and
        // lands on a candy (not a Jack-o'-Lantern or a Skull Lollipop)
        if (!freeKind || FREE_SPINS[freeKind].split <= 0) errors.push(`${where}: Pumpkin Patch outside Full Moon`);
        if (spinBase <= 0) errors.push(`${where}: Pumpkin Patch without a win`);
        if (!board || !Array.isArray(e.splits) || e.splits.length === 0) {
          errors.push(`${where}: no splits`);
          break;
        }
        const used = new Set<string>();
        // work on a copy: the boards in the book are the client's playback data
        board = board.map((col) => [...col]);
        for (const sp of e.splits) {
          if (!inGrid(sp?.from) || !inGrid(sp?.to)) {
            errors.push(`${where}: split cell out of range`);
            continue;
          }
          const src = mults.find((m) => m.reel === sp.from.reel && m.row === sp.from.row);
          if (board[sp.from.reel][sp.from.row] !== 'JK' || !src || src.value !== sp.value) errors.push(`${where}: split source is not a Jack-o'-Lantern of value ${sp.value}`);
          const key = `${sp.from.reel},${sp.from.row}`;
          if (used.has(key)) errors.push(`${where}: a Jack-o'-Lantern split twice`);
          used.add(key);
          const target = board[sp.to.reel][sp.to.row];
          if (target === 'JK' || target === 'SC') errors.push(`${where}: split onto ${target}`);
          board[sp.to.reel][sp.to.row] = 'JK';
          mults.push({ reel: sp.to.reel, row: sp.to.row, value: sp.value });
        }
        break;
      }
      case 'multiplier':
        if (e.base !== spinBase) errors.push(`${where}: base ${e.base} != tumble total ${spinBase}`);
        // the multiplier counts exactly the Jack-o'-Lanterns now on the board (splits included)
        if (freeKind && (e.cells.length !== mults.length || e.cells.some((c) => !mults.some((m) => m.reel === c.reel && m.row === c.row && m.value === c.value)))) errors.push(`${where}: multiplier cells do not match the board`);
        if (e.landed !== e.cells.reduce((s, c) => s + c.value, 0)) errors.push(`${where}: landed total mismatch`);
        if (e.mult !== Math.max(1, e.landed + e.cauldronBefore)) errors.push(`${where}: multiplier mismatch`);
        spinMult = e.mult;
        break;
      case 'win':
        if (!isInt(e.amount) || e.amount === 0) errors.push(`${where}: bad amount`);
        if (e.kind === 'spin' && e.amount !== spinBase * spinMult && total + e.amount !== WINCAP) errors.push(`${where}: spin win ${e.amount} != ${spinBase} x ${spinMult}`);
        if (e.kind === 'loot' && e.amount !== lootMult * 100 && total + e.amount !== WINCAP) errors.push(`${where}: loot win ${e.amount} != ${lootMult}x`);
        total += e.amount;
        if (e.totalWin !== total) errors.push(`${where}: totalWin ${e.totalWin} != running total ${total}`);
        break;
      case 'lootBox': {
        const tier = LOOT_TIERS[e.tier];
        if (!tier || !isInt(e.multiplier) || e.multiplier < tier.min || e.multiplier > tier.max) errors.push(`${where}: bad loot prize`);
        lootMult = e.multiplier;
        break;
      }
      case 'knock':
        if (!isInt(e.index) || e.index > 8) errors.push(`${where}: bad door`);
        break;
      case 'freeSpinsEnd':
        if (e.totalWin !== total) errors.push(`${where}: totalWin ${e.totalWin} != running total ${total}`);
        break;
      case 'wincap':
        if (e.totalWin !== WINCAP || total !== WINCAP) errors.push(`${where}: win cap total mismatch`);
        capped = true;
        break;
      case 'finalWin':
        if (i !== events.length - 1) errors.push(`${where}: finalWin must be the last event`);
        if (e.amount !== total) errors.push(`${where}: finalWin ${e.amount} != running total ${total}`);
        if (e.amount !== book.payoutMultiplier) errors.push(`${where}: finalWin ${e.amount} != payoutMultiplier ${book.payoutMultiplier}`);
        break;
      default:
        break;
    }
  });
  if (reveals === 0 && !events.some((e) => e.type === 'lootBox')) errors.push('book has no reveal');
  if (events[events.length - 1]?.type !== 'finalWin') errors.push('last event must be finalWin');
  if (total > WINCAP) errors.push(`total ${total} exceeds win cap`);
  return { ok: errors.length === 0, errors };
}
