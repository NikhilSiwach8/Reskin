import { describe, expect, it } from 'vitest';
import { BET_MODES, FREE_SPINS, LOOT_TIERS, MIN_CLUSTER, REELS, ROWS, WINCAP, clusterPay, scatterPay } from '../src/engine/config.ts';
import { applyTumble } from '../src/engine/board.ts';
import { cellsOf, drawGrid, evaluate, forcedScatterGrid, playRound, tumble, type Grid, type ModeName } from '../src/engine/round.ts';
import { Rng } from '../src/engine/rng.ts';
import type { Board, GameEvent, SymbolId } from '../src/engine/types.ts';
import { validateBook } from '../src/engine/validate.ts';

/** A board with no win and no scatters: reel r uses a fixed rotation of 6 symbols (max 5 of each). */
function quietBoard(): Board {
  const syms: SymbolId[] = ['BH', 'WP', 'SL', 'GM', 'PA', 'EY'];
  return Array.from({ length: REELS }, (_, r) => Array.from({ length: ROWS }, (_, row) => syms[(r + row) % 6]));
}
const gridOf = (board: Board): Grid => ({ board, mult: board.map((c) => c.map(() => 0)) });
const ofType = <T extends GameEvent['type']>(events: GameEvent[], type: T) => events.filter((e) => e.type === type) as Extract<GameEvent, { type: T }>[];

describe('pays', () => {
  it('pays 8-9, 10-11 and 12+ symbols anywhere', () => {
    expect(clusterPay('BH', 7)).toBe(0);
    expect(clusterPay('BH', 8)).toBe(1000);
    expect(clusterPay('BH', 11)).toBe(2500);
    expect(clusterPay('BH', 30)).toBe(5000);
    expect(clusterPay('SC', 12)).toBe(0);
    expect(scatterPay(3)).toBe(0);
    expect(scatterPay(4)).toBe(300);
    expect(scatterPay(7)).toBe(10000);
  });

  it('evaluates clusters regardless of position', () => {
    const b = quietBoard();
    expect(evaluate(b)).toEqual([]);
    const cells = [[0, 0], [1, 4], [2, 2], [3, 1], [4, 3], [5, 0], [5, 4], [0, 4]];
    for (const [reel, row] of cells) b[reel][row] = 'CC';
    const wins = evaluate(b);
    expect(wins).toHaveLength(1);
    expect(wins[0]).toMatchObject({ symbol: 'CC', count: MIN_CLUSTER, pay: clusterPay('CC', 8) });
  });
});

describe('tumble', () => {
  it('drops symbols down and refills from the top', () => {
    const g = gridOf(quietBoard());
    const before = [...g.board[2]];
    const out = tumble(g, [{ reel: 2, row: 3 }, { reel: 2, row: 1 }], new Rng(1), 'base');
    expect(out.board[2].slice(2)).toEqual([before[0], before[2], before[4]]);
    expect(out.board[0]).toEqual(g.board[0]);
  });

  it('applyTumble rebuilds the engine board from the compact fill', () => {
    const rng = new Rng(17);
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const book = playRound(i, 'bonus', rng);
      let board: Board | null = null;
      let last: SymbolId[] = [];
      for (const e of book.events) {
        if (e.type === 'reveal' || e.type === 'witchSpell') board = e.board;
        if (e.type === 'tumbleWin') last = e.wins.map((w) => w.symbol);
        if (e.type === 'tumble') {
          board = applyTumble(board!, last, e.fill);
          expect(board).not.toBeNull();
          for (const m of e.mults) expect(board![m.reel][m.row]).toBe('JK');
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('keeps Jack-o\'-Lantern values attached while they fall', () => {
    const g = gridOf(quietBoard());
    g.board[1][0] = 'JK';
    g.mult[1][0] = 25;
    const out = tumble(g, [{ reel: 1, row: 4 }], new Rng(1), 'base');
    expect(out.board[1][1]).toBe('JK');
    expect(out.mult[1][1]).toBe(25);
  });
});

describe('features', () => {
  it("Witch's Spell always produces a win", () => {
    const rng = new Rng(11);
    let seen = 0;
    for (let i = 0; i < 4000 && seen < 30; i++) {
      const b = playRound(i, 'base', rng);
      const spell = ofType(b.events, 'witchSpell')[0];
      if (!spell) continue;
      seen++;
      expect(cellsOf(spell.board, spell.symbol).length).toBeGreaterThanOrEqual(MIN_CLUSTER);
      expect(b.events[b.events.indexOf(spell) + 1].type).toBe('tumbleWin');
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('3 Skull Lollipops start Trick or Treat with up to 3 knocks on distinct doors', () => {
    const rng = new Rng(3);
    const book = playRound(1, 'base', rng, { grid: (() => { const g = gridOf(quietBoard()); g.board[0][0] = g.board[3][2] = g.board[5][4] = 'SC'; return g; })(), noSpell: true });
    const knocks = ofType(book.events, 'knock');
    expect(ofType(book.events, 'trickOrTreat')).toHaveLength(1);
    expect(knocks.length).toBeGreaterThanOrEqual(1);
    expect(knocks.length).toBeLessThanOrEqual(3);
    expect(new Set(knocks.map((k) => k.index)).size).toBe(knocks.length);
    const end = ofType(book.events, 'trickOrTreatEnd')[0];
    expect(end.total).toBe(knocks.reduce((s, k) => s + (k.prize === 'treat' ? k.amount : 0), 0));
    expect(validateBook(book).ok).toBe(true);
  });

  it('a Golden Lollipop ends the knocking and awards Haunted Cauldron free spins', () => {
    const rng = new Rng(5);
    let found = false;
    for (let i = 0; i < 3000 && !found; i++) {
      const g = gridOf(quietBoard());
      g.board[1][1] = g.board[2][3] = g.board[4][0] = 'SC';
      const book = playRound(i, 'base', rng, { grid: g, noSpell: true });
      const knocks = ofType(book.events, 'knock');
      if (knocks.at(-1)?.prize !== 'lollipop') continue;
      found = true;
      expect(knocks.filter((k) => k.prize === 'lollipop')).toHaveLength(1);
      expect(ofType(book.events, 'freeSpinsStart')[0]).toMatchObject({ kind: 'cauldron', spins: FREE_SPINS.cauldron.spins });
    }
    expect(found).toBe(true);
  });

  it('4 Lollipops start Haunted Cauldron and 5 start Full Moon with its 5x Cauldron', () => {
    const rng = new Rng(8);
    for (const [n, kind] of [[4, 'cauldron'], [5, 'fullMoon']] as const) {
      const g = forcedScatterGrid(rng, n);
      const book = playRound(1, 'base', rng, { grid: g, noSpell: true });
      const start = ofType(book.events, 'freeSpinsStart')[0];
      // a tumble can add a Lollipop, upgrading Haunted Cauldron to Full Moon
      if (kind === 'fullMoon' || start.kind === 'cauldron') expect(start.kind).toBe(kind);
      expect(start.cauldron).toBe(FREE_SPINS[start.kind].cauldron);
    }
  });

  it('Cauldron collects Jack-o\'-Lanterns from winning spins and multiplies later wins', () => {
    const rng = new Rng(21);
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      const book = playRound(i, 'bonus', rng);
      let cauldron = 0;
      let lastLanded = 0;
      let pour = 1;
      for (const e of book.events) {
        if (e.type === 'freeSpinsStart') pour = FREE_SPINS[e.kind].pour;
        if (e.type === 'freeSpinsStart') cauldron = e.cauldron;
        if (e.type === 'multiplier') lastLanded = e.landed;
        if (e.type === 'multiplier') {
          expect(e.cauldronBefore).toBe(cauldron);
          expect(e.mult).toBe(Math.max(1, e.landed + cauldron));
          checked++;
        }
        if (e.type === 'cauldron') {
          expect(e.value).toBe(cauldron + lastLanded * pour);
          cauldron = e.value;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('free spins total counts retriggers', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 300; i++) {
      const book = playRound(i, 'bonus', rng);
      const start = ofType(book.events, 'freeSpinsStart')[0];
      const added = ofType(book.events, 'retrigger').reduce((s, r) => s + r.added, 0);
      if (book.criteria === 'wincap') continue;
      expect(ofType(book.events, 'freeSpin')).toHaveLength(start.spins + added);
    }
  });
});

describe('Pumpkin Patch', () => {
  /** Full Moon buys until one has a Pumpkin Patch split. */
  const splitBook = (seed: number) => {
    const rng = new Rng(seed);
    for (let i = 0; i < 400; i++) {
      const book = playRound(i, 'fullmoon', rng);
      if (book.tags.includes('pumpkinPatch')) return book;
    }
    throw new Error('no Pumpkin Patch in 400 Full Moon buys');
  };

  it('splits only in Full Moon, after a win, copying the value onto a candy, and the multiplier counts the copies', () => {
    const book = splitBook(11);
    expect(validateBook(book).ok).toBe(true);
    const i = book.events.findIndex((e) => e.type === 'pumpkinSplit');
    const split = book.events[i] as Extract<GameEvent, { type: 'pumpkinSplit' }>;
    // the next multiplier lists every split copy with its source's value
    const mult = book.events.slice(i).find((e) => e.type === 'multiplier') as Extract<GameEvent, { type: 'multiplier' }>;
    for (const sp of split.splits) expect(mult.cells).toContainEqual({ ...sp.to, value: sp.value });
    expect(mult.landed).toBe(mult.cells.reduce((sum, c) => sum + c.value, 0));
  });

  it('never splits in Haunted Cauldron free spins', () => {
    // a Haunted Cauldron buy can still become Full Moon if tumbles bring a 5th Lollipop
    const rng = new Rng(12);
    let cauldronRounds = 0;
    for (let i = 0; i < 300; i++) {
      const book = playRound(i, 'bonus', rng);
      if (ofType(book.events, 'freeSpinsStart')[0]?.kind !== 'cauldron') continue;
      cauldronRounds++;
      expect(ofType(book.events, 'pumpkinSplit')).toHaveLength(0);
    }
    expect(cauldronRounds).toBeGreaterThan(200);
  });

  it('the validator rejects a forged split', () => {
    const book = splitBook(13);
    const forged = structuredClone(book);
    const sp = forged.events.find((e) => e.type === 'pumpkinSplit') as Extract<GameEvent, { type: 'pumpkinSplit' }>;
    sp.splits[0].value += 1; // a copy worth more than its source
    expect(validateBook(forged).ok).toBe(false);
    const onScatter = structuredClone(book);
    const sp2 = onScatter.events.find((e) => e.type === 'pumpkinSplit') as Extract<GameEvent, { type: 'pumpkinSplit' }>;
    sp2.splits[0].to = sp2.splits[0].from; // onto a Jack-o'-Lantern
    expect(validateBook(onScatter).ok).toBe(false);
  });

  it('validating a book does not change its boards (the client plays them afterwards)', () => {
    const book = splitBook(14);
    const before = JSON.stringify(book.events);
    validateBook(book);
    expect(JSON.stringify(book.events)).toBe(before);
  });
});

describe('Loot Box', () => {
  it('a bought Loot Box pays its tier multiplier (capped at the max win)', () => {
    const rng = new Rng(31);
    const seen = new Set<string>();
    for (let i = 0; i < 4000; i++) {
      const book = playRound(i, 'lootbox', rng);
      const loot = ofType(book.events, 'lootBox')[0];
      const t = LOOT_TIERS[loot.tier];
      expect(loot.multiplier).toBeGreaterThanOrEqual(t.min);
      expect(loot.multiplier).toBeLessThanOrEqual(t.max);
      expect(book.payoutMultiplier).toBe(Math.min(WINCAP, loot.multiplier * 100));
      expect(validateBook(book).ok).toBe(true);
      seen.add(loot.tier);
    }
    expect([...seen].sort()).toEqual(['big', 'mega', 'monster', 'sugar', 'max'].filter((x) => seen.has(x)).sort());
    expect(seen.has('big') && seen.has('mega') && seen.has('monster') && seen.has('sugar')).toBe(true);
  });

  it('the max-win box reaches the 5,000x cap exactly', () => {
    const rng = new Rng(5);
    let found = false;
    for (let i = 0; i < 20000 && !found; i++) {
      const book = playRound(i, 'lootbox', rng);
      if (ofType(book.events, 'lootBox')[0].tier !== 'max') continue;
      found = true;
      expect(book.criteria).toBe('wincap');
      expect(book.payoutMultiplier).toBe(WINCAP);
      expect(book.events.at(-2)?.type).toBe('wincap');
    }
    expect(found).toBe(true);
  });

  it('in the base game a Loot Box only follows a round with no other feature', () => {
    const rng = new Rng(13);
    for (let i = 0; i < 200; i++) {
      const book = playRound(i, 'base', rng, { grid: forcedScatterGrid(rng, 0), noSpell: true, forceLoot: true });
      expect(ofType(book.events, 'lootBox')).toHaveLength(1);
      expect(ofType(book.events, 'freeSpinsStart')).toHaveLength(0);
      expect(validateBook(book).ok).toBe(true);
    }
    const book = playRound(1, 'base', rng, { grid: forcedScatterGrid(rng, 4), noSpell: true, forceLoot: true });
    expect(ofType(book.events, 'lootBox')).toHaveLength(0);
  });
});

describe('books', () => {
  it('every mode produces valid books', () => {
    for (const def of BET_MODES) {
      const rng = new Rng(99);
      const n = def.buy ? 300 : 3000;
      for (let i = 0; i < n; i++) {
        const book = playRound(i, def.name as ModeName, rng);
        const res = validateBook(book);
        if (!res.ok) throw new Error(`${def.name} book ${i}: ${res.errors.join('; ')}`);
        expect(book.payoutMultiplier).toBeLessThanOrEqual(WINCAP);
      }
    }
  });

  it('bonus buys always start free spins', () => {
    const rng = new Rng(2);
    for (let i = 0; i < 100; i++) {
      expect(playRound(i, 'bonus', rng).tags.some((t) => t === 'cauldron' || t === 'fullMoon')).toBe(true);
      expect(playRound(i, 'fullmoon', rng).tags).toContain('fullMoon');
    }
  });

  it('the validator rejects a forged tumble', () => {
    const rng = new Rng(9);
    let book;
    do book = playRound(1, 'base', rng);
    while (!book.events.some((e) => e.type === 'tumble'));
    const forged = structuredClone(book);
    const t = forged.events.find((e) => e.type === 'tumble')!;
    if (t.type === 'tumble') t.fill = t.fill.map((c) => [...c, 'BH']);
    expect(validateBook(forged).ok).toBe(false);
  });

  it('the validator rejects tampered books', () => {
    const rng = new Rng(7);
    let book;
    do book = playRound(1, 'base', rng);
    while (book.payoutMultiplier === 0);
    const tampered = structuredClone(book);
    const win = tampered.events.find((e) => e.type === 'win')!;
    if (win.type === 'win') win.amount += 100;
    expect(validateBook(tampered).ok).toBe(false);
    expect(validateBook({ ...book, payoutMultiplier: book.payoutMultiplier + 1 }).ok).toBe(false);
  });

  it('is deterministic for a seed', () => {
    const a = playRound(1, 'bonus', new Rng(42));
    const b = playRound(1, 'bonus', new Rng(42));
    expect(a).toEqual(b);
    expect(drawGrid(new Rng(1), 'base')).toEqual(drawGrid(new Rng(1), 'base'));
  });
});
