import { describe, expect, it } from 'vitest';
import { FEATURES, PAYLINES, REEL_SETS, REELS, ROWS, SPACED_SYMBOLS, SYMBOLS, WINCAP } from '../src/engine/config.ts';
import { evaluateLines, lineMultiplier } from '../src/engine/evaluate.ts';
import { Grid } from '../src/engine/grid.ts';
import { buildStrips } from '../src/engine/reels.ts';
import { expandRelics, overloadLevel, relicSurge } from '../src/engine/relics.ts';
import { Rng } from '../src/engine/rng.ts';
import { detectFeature, forcedKeyBoard, mostCommonLow, playRound, Round, runLockdown } from '../src/engine/round.ts';
import type { Board, Book, GameEvent, SymbolId } from '../src/engine/types.ts';
import { validateBook } from '../src/engine/validate.ts';

/** Builds a board from 5 row strings, e.g. 'A K Q J T'. Rows top to bottom. */
function board(rows: string[]): Board {
  const cells = rows.map((r) => r.trim().split(/\s+/) as SymbolId[]);
  return Array.from({ length: REELS }, (_, reel) => cells.map((row) => row[reel]));
}

const FILLER = ['A K Q J T', 'K Q J T A', 'Q J T A K', 'J T A K Q', 'T A K Q J'];

/** Deterministic table that always returns the given value. */
const fixed = (mult: number, size: number) => ({ mult: [[mult, 1]] as [number, number][], size: [[size, 1]] as [number, number][] });

function events<T extends GameEvent['type']>(book: Book, type: T): Extract<GameEvent, { type: T }>[] {
  return book.events.filter((e) => e.type === type) as Extract<GameEvent, { type: T }>[];
}

function findBook(mode: 'base' | 'bonus', pred: (b: Book) => boolean, seed = 1, limit = 200000): Book {
  const rng = new Rng(seed);
  for (let i = 0; i < limit; i++) {
    const b = playRound(i, mode, rng);
    if (pred(b)) return b;
  }
  throw new Error('no matching book found');
}

describe('configuration', () => {
  it('defines 15 distinct paylines inside the 5x5 grid', () => {
    expect(PAYLINES).toHaveLength(15);
    expect(new Set(PAYLINES.map((l) => l.join())).size).toBe(15);
    for (const l of PAYLINES) {
      expect(l).toHaveLength(REELS);
      for (const r of l) expect(r >= 0 && r < ROWS).toBe(true);
    }
  });

  it('gives every paying symbol 3/4/5 pays and marks specials explicitly', () => {
    for (const s of Object.values(SYMBOLS)) {
      if (s.category === 'scatter') {
        expect(s.pays).toEqual({});
        expect(s.substitutable).toBe(false);
      } else {
        expect(s.pays[3]! < s.pays[4]! && s.pays[4]! < s.pays[5]!).toBe(true);
      }
    }
    expect(SYMBOLS.RL.category).toBe('wild');
    expect(Object.values(SYMBOLS).filter((s) => s.transformable).every((s) => s.category === 'low')).toBe(true);
  });

  it('builds reel strips that show each spaced symbol at most once per window', () => {
    for (const name of Object.keys(REEL_SETS)) {
      for (const strip of buildStrips(name)) {
        for (let stop = 0; stop < strip.length; stop++) {
          const window = Array.from({ length: ROWS }, (_, r) => strip[(stop + r) % strip.length]);
          for (const sym of SPACED_SYMBOLS) expect(window.filter((s) => s === sym).length).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('payline evaluation', () => {
  it('pays left-to-right runs of 3, 4 and 5', () => {
    const g = new Grid(board(['A K Q J T', 'K Q J T A', 'GB GB GB GB Q', 'J T A K Q', 'T A K Q J']));
    const wins = evaluateLines(g);
    const line1 = wins.find((w) => w.line === 1)!;
    expect(line1).toMatchObject({ symbol: 'GB', count: 4, basePay: SYMBOLS.GB.pays[4], mult: 1 });
  });

  it('does not pay runs that do not start on reel 1', () => {
    const g = new Grid(board(['A K Q J T', 'K Q J T A', 'Q GB GB GB GB', 'J T A K Q', 'T A K Q J']));
    expect(evaluateLines(g).find((w) => w.line === 1)).toBeUndefined();
  });

  it('substitutes the Relic for regular symbols but never for the Vault Key', () => {
    const g = new Grid(board(['A K Q J T', 'K Q J T A', 'TC RL TC Q Q', 'J T A K Q', 'T A K Q J']));
    g.addBlock({ reel: 1, row: 2 }, { reel: 1, row: 2 }, 1, 1);
    expect(evaluateLines(g).find((w) => w.line === 1)).toMatchObject({ symbol: 'TC', count: 3 });

    const k = new Grid(board(['A K Q J T', 'K Q J T A', 'VK RL VK Q Q', 'J T A K Q', 'T A K Q J']));
    k.addBlock({ reel: 1, row: 2 }, { reel: 1, row: 2 }, 1, 1);
    expect(evaluateLines(k).find((w) => w.line === 1)).toBeUndefined();
  });

  it('pays a Relic-only line from the Relic paytable, or the substituted symbol if higher, never both', () => {
    const g = new Grid(board(['A K Q J T', 'K Q J T A', 'RL RL RL Q K', 'J T A K Q', 'T A K Q J']));
    for (let r = 0; r < 3; r++) g.addBlock({ reel: r, row: 2 }, { reel: r, row: 2 }, 1, 1);
    // RL x3 = 25 * mult 3 = 75; Q x4 = 30 * 3 = 90 -> Q wins
    const w = evaluateLines(g).filter((x) => x.line === 1);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ symbol: 'Q', count: 4, mult: 3, win: 90 });

    const g2 = new Grid(board(['A K Q J T', 'K Q J T A', 'RL RL RL RL RL', 'J T A K Q', 'T A K Q J']));
    g2.addBlock({ reel: 0, row: 2 }, { reel: 0, row: 2 }, 1, 2);
    for (let r = 1; r < 5; r++) g2.addBlock({ reel: r, row: 2 }, { reel: r, row: 2 }, 1, 1);
    expect(evaluateLines(g2).find((x) => x.line === 1)).toMatchObject({ symbol: 'RL', count: 5, mult: 6, win: SYMBOLS.RL.pays[5]! * 6 });
  });
});

describe('Cursed Relic multipliers', () => {
  it('is 1 when no relic takes part', () => {
    const g = new Grid(board(FILLER));
    expect(lineMultiplier(g, [{ reel: 0, row: 0 }, { reel: 1, row: 0 }])).toBe(1);
  });

  it('counts a block once even when the line crosses several of its cells', () => {
    const g = new Grid(board(FILLER));
    g.addBlock({ reel: 0, row: 0 }, { reel: 0, row: 0 }, 2, 5);
    expect(lineMultiplier(g, [{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 0 }])).toBe(5);
  });

  it('adds the multipliers of distinct blocks', () => {
    const g = new Grid(board(FILLER));
    g.addBlock({ reel: 0, row: 0 }, { reel: 0, row: 0 }, 1, 2);
    g.addBlock({ reel: 2, row: 0 }, { reel: 2, row: 0 }, 1, 10);
    expect(lineMultiplier(g, [0, 1, 2, 3].map((reel) => ({ reel, row: 0 })))).toBe(12);
  });

  it('applies the multiplier to each winning line exactly once', () => {
    const g = new Grid(board(['A K Q J T', 'K Q J T A', 'GB GB Q J T', 'J T A K Q', 'T A K Q J']));
    g.set({ reel: 2, row: 2 }, 'RL');
    g.addBlock({ reel: 2, row: 2 }, { reel: 2, row: 2 }, 1, 5);
    const w = evaluateLines(g).find((x) => x.line === 1)!;
    expect(w.win).toBe(SYMBOLS.GB.pays[3]! * 5);
  });
});

describe('relic expansion', () => {
  it('clamps expansions at the grid boundary so the landing cell stays inside', () => {
    const b = board(FILLER);
    b[4][4] = 'RL';
    const g = new Grid(b);
    const res = expandRelics(g, new Rng(1), { table: fixed(2, 3) });
    expect(res.blocks[0]).toMatchObject({ reel: 2, row: 2, size: 3, mult: 2, origin: { reel: 4, row: 4 } });
    expect(g.find((s) => s === 'RL')).toHaveLength(9);
  });

  it('shrinks an expansion that would cover a Vault Key', () => {
    const b = board(FILLER);
    b[0][0] = 'RL';
    b[2][2] = 'VK';
    const g = new Grid(b);
    const res = expandRelics(g, new Rng(1), { table: fixed(1, 4) });
    expect(res.blocks[0].size).toBe(2);
    expect(g.get({ reel: 2, row: 2 })).toBe('VK');
  });

  it('absorbs overlapping new relics and adds their multipliers', () => {
    const b = board(FILLER);
    b[0][0] = 'RL';
    b[1][1] = 'RL';
    const g = new Grid(b);
    const res = expandRelics(g, new Rng(1), { table: fixed(3, 2) });
    expect(res.blocks).toHaveLength(1);
    expect(res.blocks[0]).toMatchObject({ size: 2, mult: 6 });
    expect(res.blocks[0].absorbed).toEqual([{ reel: 1, row: 1 }]);
  });

  it('never grows into an already expanded block', () => {
    const b = board(FILLER);
    b[0][0] = 'RL';
    b[2][1] = 'RL';
    const g = new Grid(b);
    const res = expandRelics(g, new Rng(1), { table: fixed(1, 3) });
    // first relic takes reels 0-2 rows 0-2 and absorbs the second
    expect(res.blocks).toHaveLength(1);
    expect(res.blocks[0].size).toBe(3);
  });

  it('respects caller obstacles (locked reels)', () => {
    const b = board(FILLER);
    b[1][1] = 'RL';
    const g = new Grid(b);
    const res = expandRelics(g, new Rng(1), { table: fixed(1, 2), obstacle: (c) => c.reel === 2 });
    expect(res.blocks[0].size).toBe(1);
  });

  it('applies Relic Overload minimum sizes and multiplier factors', () => {
    expect(overloadLevel(0)).toBe(0);
    for (const [i, t] of FEATURES.overload.thresholds.entries()) {
      expect(overloadLevel(t - 1)).toBe(i);
      expect(overloadLevel(t)).toBe(i + 1);
    }
    const b = board(FILLER);
    b[1][1] = 'RL';
    const g = new Grid(b);
    const res = expandRelics(g, new Rng(1), { table: fixed(5, 1), overloadLevel: 3 });
    expect(res.blocks[0]).toMatchObject({ size: FEATURES.overload.minSize[3], mult: (5 + FEATURES.overload.multBonus[3]) * FEATURES.overload.multFactor[3] });
  });

  it('places a Relic Surge block on free cells only', () => {
    const b = board(FILLER);
    b[0][0] = 'VK';
    const g = new Grid(b);
    const block = relicSurge(g, new Rng(3), 4, 10)!;
    expect(block.size).toBe(4);
    expect(block.reel === 0 && block.row === 0).toBe(false);
    expect(g.get({ reel: 0, row: 0 })).toBe('VK');
  });
});

describe('feature triggers', () => {
  it('resolves simultaneous triggers by priority (Keys before Clock before Doors)', () => {
    const g = new Grid(board(['VK VD CL A K', 'Q VK VD CL J', 'CL Q VK VD T', 'A K Q J T', 'K Q J T A']));
    expect(detectFeature(g)).toBe('threeKeys');
    const h = new Grid(board(['A VD CL A K', 'Q K VD CL J', 'CL Q K VD T', 'A K Q J T', 'K Q J T A']));
    expect(detectFeature(h)).toBe('thirteenthHour');
    const d = new Grid(board(['A VD PH A K', 'Q K VD PH J', 'PH Q K VD T', 'A K Q J T', 'K Q J T A']));
    expect(detectFeature(d)).toBe('lockdown');
    const v = new Grid(board(['VK VK VK VK VK', 'A K Q J T', 'K Q J T A', 'Q J T A K', 'J T A K Q']));
    expect(detectFeature(v)).toBe('vaultBreach');
  });

  it('picks the most common low symbol for the Phantom, ties to the higher payer', () => {
    const g = new Grid(board(['A A Q Q GB', 'GB GB GB GB GB', 'GB GB GB GB GB', 'GB GB GB GB GB', 'GB GB GB GB GB']));
    expect(mostCommonLow(g)).toBe('A');
  });
});

describe('Lockdown Spin', () => {
  it('keeps locked reels untouched, resets respins on a new lock, and ends correctly', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const b = board(['VD A K Q J', 'K VD J T A', 'Q J T A K', 'J T A K Q', 'T A K Q J']);
      b[2][2] = 'VD';
      const g = new Grid(b);
      const round = new Round(new Rng(seed));
      runLockdown(round, g, { lockSym: 'VD', reelSet: 'lockdown', respins: 3 });
      const start = round.events[0] as Extract<GameEvent, { type: 'lockdownStart' }>;
      expect(start.lockedReels).toEqual([0, 1, 2]);
      const respins = round.events.filter((e) => e.type === 'lockdownRespin') as Extract<GameEvent, { type: 'lockdownRespin' }>[];
      let left = 3;
      // contents of every locked reel at the moment it locked
      const frozen = new Map(start.lockedReels.map((reel) => [reel, b[reel]]));
      for (const r of respins) {
        left = r.newLocks.length ? 3 : left - 1;
        expect(r.respinsLeft).toBe(left);
        for (const [reel, contents] of frozen) expect(r.board[reel]).toEqual(contents);
        for (const reel of r.newLocks) {
          expect(r.board[reel]).toContain('VD');
          frozen.set(reel, r.board[reel]);
        }
      }
      const last = respins[respins.length - 1];
      expect(last.respinsLeft === 0 || last.lockedReels.length === REELS).toBe(true);
    }
  });

  it('opens every Vault Door into a Relic at the end of a base-game Lockdown', () => {
    const book = findBook('base', (b) => b.tags.includes('lockdown'));
    const open = events(book, 'doorsOpen')[0];
    expect(open.cells.length).toBeGreaterThanOrEqual(3);
    for (const c of open.cells) expect(open.board[c.reel][c.row]).toBe('RL');
  });
});

describe('Phantom Heist', () => {
  it('only transforms low symbols, and the event board matches the transformation', () => {
    const book = findBook('base', (b) => b.tags.includes('phantomHeist'));
    const reveal = events(book, 'reveal')[0];
    const heist = events(book, 'phantomHeist')[0];
    for (const c of heist.cells) {
      expect(SYMBOLS[reveal.board[c.reel][c.row]].transformable).toBe(true);
      expect(heist.board[c.reel][c.row]).toBe(heist.target);
    }
  });
});

describe('The Thirteenth Hour', () => {
  it('runs the configured spins plus a Final Countdown spin with the surge size for the hour reached', () => {
    const book = findBook('base', (b) => b.tags.includes('thirteenthHour'));
    const start = events(book, 'clockStart')[0];
    expect(start).toMatchObject({ hour: FEATURES.thirteenthHour.startHour, spins: FEATURES.thirteenthHour.spins });
    expect(events(book, 'freeSpin')).toHaveLength(FEATURES.thirteenthHour.spins + 1);
    let hour = start.hour;
    for (const a of events(book, 'clockAdvance')) {
      expect(a.hour).toBe(hour + a.by);
      hour = a.hour;
      expect(hour).toBeLessThanOrEqual(13);
    }
    const strike = events(book, 'clockStrike')[0];
    expect(strike.surgeSize).toBe(FEATURES.thirteenthHour.surgeSizeByHour[hour]);
  });
});

describe('Three Keys to the Vault', () => {
  it('awards 8 spins for 3 Keys and 10 for 4 Keys', () => {
    for (const keys of [3, 4]) {
      const rng = new Rng(keys);
      const book = playRound(1, 'base', rng, { board: forcedKeyBoard(rng, keys), forcedPath: 'phantomPayday' });
      expect(events(book, 'bonusPath')[0]).toMatchObject({ path: 'phantomPayday', spins: FEATURES.threeKeys.spinsByKeys[keys] });
    }
  });

  it('opens The Vault Breach with 5 Keys and runs all four stages', () => {
    const rng = new Rng(9);
    const book = playRound(1, 'base', rng, { board: forcedKeyBoard(rng, 5) });
    expect(events(book, 'featureTrigger').some((e) => e.feature === 'vaultBreach')).toBe(true);
    if (!book.tags.includes('wincap')) expect(events(book, 'breachStage').map((s) => s.stage)).toEqual([1, 2, 3, 4]);
  });

  it('counts free spins correctly, including retriggers, within the spin cap', () => {
    const rng = new Rng(4);
    let checked = 0;
    for (let i = 0; i < 3000 && checked < 40; i++) {
      const book = playRound(i, 'bonus', rng);
      const path = events(book, 'bonusPath')[0];
      if (!path || path.path === 'vaultBreach' || book.tags.includes('wincap')) continue;
      const spins = events(book, 'freeSpin');
      const final = spins[spins.length - 1];
      expect(spins.map((s) => s.index)).toEqual(spins.map((_, k) => k + 1));
      expect(final.remaining).toBe(0);
      expect(final.total).toBe(spins.length);
      expect(final.total).toBeLessThanOrEqual(FEATURES.threeKeys.maxSpins);
      const added = events(book, 'retrigger').reduce((s, r) => s + r.added, 0);
      const strikes = path.path === 'midnightCountdown' ? events(book, 'clockStrike').length : 0;
      expect(final.total).toBe(path.spins + added + strikes);
      if (added) checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('keeps Relic Overload charge monotonic and flags level-ups correctly', () => {
    const rng = new Rng(12);
    const book = playRound(1, 'bonus', rng, { forcedPath: 'cursedFortune' });
    let charge = 0;
    let level = 0;
    for (const o of events(book, 'overload')) {
      expect(o.charge).toBeGreaterThan(charge);
      expect(o.level).toBe(overloadLevel(o.charge));
      expect(o.levelUp).toBe(o.level > level);
      charge = o.charge;
      level = o.level;
    }
  });

  it('returns to the base game: no spins after the feature ends', () => {
    const book = findBook('base', (b) => b.tags.includes('threeKeys') && !b.tags.includes('wincap'));
    const endIdx = book.events.findIndex((e) => e.type === 'featureEnd');
    expect(endIdx).toBeGreaterThan(0);
    expect(book.events.slice(endIdx + 1).every((e) => e.type === 'finalWin')).toBe(true);
  });
});

describe('books', () => {
  it('are deterministic for a seed', () => {
    const a = playRound(1, 'bonus', new Rng(42));
    const b = playRound(1, 'bonus', new Rng(42));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('are valid, integer-precise and never exceed the win cap', () => {
    for (const mode of ['base', 'bonus'] as const) {
      const rng = new Rng(mode === 'base' ? 100 : 200);
      for (let i = 0; i < (mode === 'base' ? 4000 : 400); i++) {
        const book = playRound(i, mode, rng);
        const v = validateBook(book);
        if (!v.ok) throw new Error(`${mode} book ${i}: ${v.errors.slice(0, 3).join('; ')}`);
        expect(Number.isInteger(book.payoutMultiplier)).toBe(true);
        expect(book.payoutMultiplier).toBeLessThanOrEqual(WINCAP);
      }
    }
  });

  it('stop at the win cap and pay exactly the cap', () => {
    const rng = new Rng(77);
    let book: Book | undefined;
    for (let i = 0; i < 100000 && !book; i++) {
      const b = playRound(i, 'bonus', rng, { forcedPath: 'cursedFortune' });
      if (b.criteria === 'wincap') book = b;
    }
    expect(book).toBeDefined();
    expect(book!.payoutMultiplier).toBe(WINCAP);
    const capIdx = book!.events.findIndex((e) => e.type === 'wincap');
    expect(book!.events.slice(capIdx + 1).map((e) => e.type)).toEqual(['finalWin']);
    expect(validateBook(book!).ok).toBe(true);
  });

  it('rejects tampered books', () => {
    const book = playRound(1, 'base', new Rng(5), { board: board(['GB GB GB A K', 'K Q J T A', 'Q J T A K', 'J T A K Q', 'T A K Q J']) });
    expect(validateBook(book).ok).toBe(true);
    expect(validateBook({ ...book, payoutMultiplier: book.payoutMultiplier + 1 }).ok).toBe(false);
    const broken = structuredClone(book);
    (broken.events[0] as Extract<GameEvent, { type: 'reveal' }>).board[0][0] = 'XX' as SymbolId;
    expect(validateBook(broken).ok).toBe(false);
  });
});
