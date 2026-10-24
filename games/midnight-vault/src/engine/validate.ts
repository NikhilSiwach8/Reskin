// Book validation. Used by the tests, the math pipeline and the client: the client
// refuses to play a round whose events are not internally consistent.
import { REELS, ROWS, SYMBOLS, WINCAP } from './config.ts';
import type { Board, GameEvent, RelicBlock } from './types.ts';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

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

function checkBlock(b: RelicBlock, board: Board | undefined, where: string, errors: string[]): void {
  if (!isInt(b.size) || b.size < 1 || b.size > 4) errors.push(`${where}: bad block size ${b.size}`);
  if (b.reel < 0 || b.row < 0 || b.reel + b.size > REELS || b.row + b.size > ROWS) errors.push(`${where}: block out of bounds`);
  if (!isInt(b.mult) || b.mult < 1) errors.push(`${where}: bad block multiplier ${b.mult}`);
  if (board) {
    for (let dc = 0; dc < b.size; dc++) {
      for (let dr = 0; dr < b.size; dr++) {
        if (board[b.reel + dc]?.[b.row + dr] !== 'RL') errors.push(`${where}: block cell ${b.reel + dc},${b.row + dr} is not a Relic`);
      }
    }
  }
}

export function validateBook(book: { payoutMultiplier: unknown; events: unknown }): ValidationResult {
  const errors: string[] = [];
  if (!isInt(book.payoutMultiplier)) errors.push('payoutMultiplier must be a non-negative integer');
  if (!Array.isArray(book.events) || book.events.length === 0) return { ok: false, errors: [...errors, 'events missing'] };
  const events = book.events as GameEvent[];
  let total = 0;
  let capped = false;
  let reveals = 0;

  events.forEach((e, i) => {
    const where = `event ${i} (${e?.type})`;
    if (capped && e.type !== 'finalWin') errors.push(`${where}: event after win cap`);
    switch (e.type) {
      case 'reveal':
        reveals++;
        checkBoard(e.board, where, errors);
        break;
      case 'relicExpand':
        if (checkBoard(e.board, where, errors)) e.blocks.forEach((b) => checkBlock(b, e.board, where, errors));
        break;
      case 'relicSurge':
        if (checkBoard(e.board, where, errors)) checkBlock(e.block, e.board, where, errors);
        break;
      case 'phantomHeist':
      case 'spectralRespin':
      case 'doorsOpen':
      case 'lockdownRespin':
        checkBoard(e.board, where, errors);
        break;
      case 'winInfo': {
        let sum = 0;
        for (const w of e.wins) {
          if (!isInt(w.win) || w.win !== w.basePay * w.mult) errors.push(`${where}: line ${w.line} win ${w.win} != ${w.basePay} x ${w.mult}`);
          sum += w.win;
        }
        if (!isInt(e.spinWin) || e.spinWin > sum) errors.push(`${where}: spinWin ${e.spinWin} exceeds line total ${sum}`);
        total += e.spinWin;
        if (e.totalWin !== total) errors.push(`${where}: totalWin ${e.totalWin} != running total ${total}`);
        break;
      }
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
  if (reveals === 0) errors.push('book has no reveal');
  if (events[events.length - 1]?.type !== 'finalWin') errors.push('last event must be finalWin');
  if (total > WINCAP) errors.push(`total ${total} exceeds win cap`);
  return { ok: errors.length === 0, errors };
}
