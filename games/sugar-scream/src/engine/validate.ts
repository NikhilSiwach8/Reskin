// Book validation. Used by the tests, the math pipeline and the client: the client
// refuses to play a round whose events are not internally consistent.
import { applyTumble, cellsOf } from './board.ts';
import { FREE_SPINS, GRAVE_RESPINS, JACKPOTS, LOOT_TIERS, ORB_VALUES, PAYING, REELS, ROWS, SYMBOLS, WINCAP, clusterPay } from './config.ts';
import type { Board, Cell, GameEvent, MultCell, Orb, SymbolId } from './types.ts';

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

const ORB_BASE = new Set(ORB_VALUES.map(([v]) => v));

/** A newly landed orb: a free cell, and a value its kind can carry. */
function checkOrb(o: Orb, orbs: Map<string, number>, where: string, errors: string[]): void {
  if (!inGrid(o)) return void errors.push(`${where}: orb out of range`);
  if (orbs.has(`${o.reel},${o.row}`)) errors.push(`${where}: orb on a locked cell`);
  const ok = o.kind === 'mini' || o.kind === 'major' ? o.value === JACKPOTS[o.kind] : (o.kind === 'soul' || o.kind === 'lantern') && ORB_BASE.has(o.value);
  if (!ok) errors.push(`${where}: bad ${o.kind} orb value ${o.value}`);
  orbs.set(`${o.reel},${o.row}`, o.value);
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
  // Graveyard Lock: the locked orbs (by "reel,row") and the respins left
  let orbs: Map<string, number> | null = null;
  let respins = 0;
  let holdTotal = -1;

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
        if (e.kind === 'hold' && e.amount !== holdTotal && total + e.amount !== WINCAP) errors.push(`${where}: hold win ${e.amount} != ${holdTotal}`);
        total += e.amount;
        if (e.totalWin !== total) errors.push(`${where}: totalWin ${e.totalWin} != running total ${total}`);
        break;
      case 'holdStart':
        orbs = new Map();
        if (!Array.isArray(e.orbs) || e.orbs.length === 0) errors.push(`${where}: no orbs`);
        for (const o of e.orbs ?? []) checkOrb(o, orbs, where, errors);
        if (e.respins !== GRAVE_RESPINS) errors.push(`${where}: should start with ${GRAVE_RESPINS} respins`);
        respins = e.respins;
        break;
      case 'holdRespin': {
        if (!orbs || respins <= 0) {
          errors.push(`${where}: respin outside Graveyard Lock`);
          break;
        }
        for (const o of e.landed ?? []) checkOrb(o, orbs, where, errors);
        const lanterns = (e.landed ?? []).filter((o) => o.kind === 'lantern');
        let li = 0;
        for (const l of lanterns) {
          // every other orb locked in the lantern's reel doubles (a reel holding only the lantern has no boost)
          const others = [...orbs].filter(([k]) => k.split(',')[0] === String(l.reel) && k !== `${l.reel},${l.row}`);
          if (!others.length) continue;
          const b = e.boosts?.[li++];
          if (!b || b.lantern.reel !== l.reel || b.lantern.row !== l.row || b.cells.length !== others.length) {
            errors.push(`${where}: lantern boost does not match the board`);
            continue;
          }
          for (const [k, v] of others) {
            const c = b.cells.find((x) => `${x.reel},${x.row}` === k);
            if (!c || c.value !== v * 2) errors.push(`${where}: lantern should double ${k} to ${v * 2}`);
            orbs.set(k, v * 2);
          }
        }
        if ((e.boosts?.length ?? 0) !== li) errors.push(`${where}: boosts without a lantern`);
        respins = e.landed?.length ? GRAVE_RESPINS : respins - 1;
        if (e.respins !== respins) errors.push(`${where}: respins ${e.respins} != ${respins}`);
        if (e.filled !== orbs.size) errors.push(`${where}: filled ${e.filled} != ${orbs.size}`);
        break;
      }
      case 'holdEnd': {
        if (!orbs) {
          errors.push(`${where}: Graveyard Lock never started`);
          break;
        }
        const full = orbs.size === REELS * ROWS;
        if (respins > 0 && !full) errors.push(`${where}: ended with respins left`);
        if (e.grand !== full || e.filled !== orbs.size) errors.push(`${where}: board count mismatch`);
        const sum = [...orbs.values()].reduce((a, v) => a + v, 0);
        if (e.total !== (full ? WINCAP : sum)) errors.push(`${where}: total ${e.total} should be ${full ? WINCAP : sum}`);
        holdTotal = e.total;
        break;
      }
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
  if (reveals === 0 && !events.some((e) => e.type === 'lootBox' || e.type === 'holdStart')) errors.push('book has no reveal');
  if (events[events.length - 1]?.type !== 'finalWin') errors.push('last event must be finalWin');
  if (total > WINCAP) errors.push(`total ${total} exceeds win cap`);
  return { ok: errors.length === 0, errors };
}
