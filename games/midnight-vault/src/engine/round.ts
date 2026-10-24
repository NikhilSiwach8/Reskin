// Round orchestration: produces one complete, self-contained book (event list + payout)
// for a bet. The client replays these events; it never decides an outcome.
import {
  BONUS_BUY_FOUR_KEYS,
  BONUS_BUY_PATHS,
  FEATURES,
  RELIC_TABLES,
  REELS,
  SURGE_MULT,
  SYMBOLS,
  SYMBOL_ORDER,
  WINCAP,
  type RelicTable,
} from './config.ts';
import { evaluateLines, totalWin } from './evaluate.ts';
import { Grid } from './grid.ts';
import { expandRelics, overloadLevel, relicSurge } from './relics.ts';
import { drawBoard, drawReel } from './reels.ts';
import { Rng } from './rng.ts';
import type { Board, BonusPath, Book, Cell, FeatureId, GameEvent, LedgerState, LineWin, SymbolId } from './types.ts';

class WincapReached extends Error {}

export class Round {
  events: GameEvent[] = [];
  total = 0;
  tags = new Set<string>();
  readonly rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  /** Records a spin's line wins. Throws WincapReached once the cap is hit. */
  pay(wins: LineWin[]): number {
    let spinWin = totalWin(wins);
    const capped = this.total + spinWin >= WINCAP;
    if (capped) spinWin = WINCAP - this.total;
    this.total += spinWin;
    if (wins.length) {
      this.emit({ type: 'winInfo', wins, spinWin, mult: Math.max(...wins.map((w) => w.mult)), totalWin: this.total });
    }
    if (capped) {
      this.tags.add('wincap');
      this.emit({ type: 'wincap', totalWin: this.total });
      throw new WincapReached();
    }
    return spinWin;
  }
}

// ---------------------------------------------------------------- helpers

function cellsOf(grid: Grid, sym: SymbolId): Cell[] {
  return grid.find((s) => s === sym);
}

function reveal(round: Round, grid: Grid, reelSet: string, phase: 'base' | 'free' | 'respin', blackout = false): void {
  round.emit({ type: 'reveal', board: grid.snapshot(), reelSet, phase, anticipation: anticipation(grid.symbols), blackout });
}

/** Reels that spin with anticipation: every reel after the one showing the 2nd Key. Presentation only. */
export function anticipation(board: Board): number[] {
  let keys = 0;
  for (let reel = 0; reel < REELS; reel++) {
    if (board[reel].includes('VK')) keys++;
    if (keys >= 2) return Array.from({ length: REELS - reel - 1 }, (_, i) => reel + 1 + i);
  }
  return [];
}

/** Expands any new relics, emits the expansion, evaluates and pays the grid. */
function resolve(round: Round, grid: Grid, table: RelicTable, overload = 0, obstacle?: (c: Cell) => boolean): number {
  const res = expandRelics(grid, round.rng, { table, overloadLevel: overload, obstacle });
  if (res.blocks.length) round.emit({ type: 'relicExpand', blocks: res.blocks, board: grid.snapshot() });
  return round.pay(evaluateLines(grid));
}

export function detectFeature(grid: Grid): FeatureId | null {
  const keys = grid.count('VK');
  const t = FEATURES.triggerCount;
  const checks: Record<FeatureId, boolean> = {
    vaultBreach: keys >= 5,
    threeKeys: keys >= 3,
    thirteenthHour: grid.count('CL') >= t.CL,
    lockdown: grid.count('VD') >= t.VD,
    spectralRespin: grid.count('EL') >= t.EL,
    phantomHeist: grid.count('PH') >= t.PH,
  };
  return FEATURES.priority.find((f) => checks[f]) ?? null;
}

function newLedger(): LedgerState {
  return {
    relic: { progress: 0, level: 0, thresholds: [...FEATURES.overload.thresholds] },
    phantom: { progress: 0, level: 0, thresholds: [...FEATURES.phantomPayday.sealThresholds] },
    clock: { progress: 0, level: 0, thresholds: [FEATURES.midnightCountdown.strikeHour - FEATURES.midnightCountdown.startHour] },
  };
}

function levelFor(progress: number, thresholds: number[]): number {
  return thresholds.filter((t) => progress >= t).length;
}

// ---------------------------------------------------------------- features

/** Lockdown Spin. Reels showing `lockSym` lock; the others respin; a new lock resets the respins. */
export function runLockdown(
  round: Round,
  grid: Grid,
  opts: { lockSym: SymbolId; reelSet: string; respins: number },
): void {
  const locked = new Set<number>();
  for (let reel = 0; reel < REELS; reel++) if (grid.symbols[reel].includes(opts.lockSym)) locked.add(reel);
  round.emit({ type: 'lockdownStart', lockedReels: [...locked], respins: opts.respins });
  let respins = opts.respins;
  while (respins > 0 && locked.size < REELS) {
    respins--;
    const newLocks: number[] = [];
    for (let reel = 0; reel < REELS; reel++) {
      if (locked.has(reel)) continue;
      const window = drawReel(round.rng, opts.reelSet, reel);
      grid.replaceReel(reel, window);
      if (window.includes(opts.lockSym)) newLocks.push(reel);
    }
    for (const r of newLocks) locked.add(r);
    if (newLocks.length) respins = opts.respins;
    round.emit({ type: 'lockdownRespin', board: grid.snapshot(), lockedReels: [...locked].sort(), newLocks, respinsLeft: respins });
  }
  round.emit({ type: 'lockdownEnd', lockedReels: [...locked].sort() });
}

/** Low symbol with the most copies on the grid; ties go to the higher-paying symbol. */
export function mostCommonLow(grid: Grid): SymbolId | undefined {
  let best: SymbolId | undefined;
  let bestN = 0;
  for (const sym of SYMBOL_ORDER) {
    if (!SYMBOLS[sym].transformable) continue;
    const n = grid.count(sym);
    if (n > bestN) {
      best = sym;
      bestN = n;
    }
  }
  return best;
}

/**
 * Phantom transformation. Either `marks` random low-symbol cells, or (with `steal`)
 * every copy of one low symbol, turn into `target`. Relic targets become 1x1 relic
 * blocks carrying `wildMult`. Transformed symbols never persist into later spins.
 */
function phantomTransform(
  round: Round,
  grid: Grid,
  marks: number,
  target: SymbolId,
  wildMult?: number,
  steal?: SymbolId,
): Cell[] {
  const candidates = grid.find((s) => SYMBOLS[s].transformable);
  const cells = steal ? grid.find((s) => s === steal) : round.rng.sample(candidates, marks);
  for (const c of cells) {
    if (target === 'RL') grid.addBlock(c, c, 1, wildMult ?? 1);
    else grid.set(c, target);
  }
  round.emit({ type: 'phantomHeist', cells, target, mult: target === 'RL' ? wildMult : undefined, board: grid.snapshot() });
  return cells;
}

/** The Thirteenth Hour (base game): 5 clock spins, then the Final Countdown Spin. */
function runThirteenthHour(round: Round): void {
  const cfg = FEATURES.thirteenthHour;
  const start = round.total;
  let hour = cfg.startHour;
  round.emit({ type: 'clockStart', hour, spins: cfg.spins });
  for (let i = 1; i <= cfg.spins; i++) {
    round.emit({ type: 'freeSpin', index: i, remaining: cfg.spins + 1 - i, total: cfg.spins + 1, label: 'Thirteenth Hour' });
    const grid = new Grid(drawBoard(round.rng, 'clock'));
    reveal(round, grid, 'clock', 'free');
    const clocks = cellsOf(grid, 'CL');
    const by = Math.min(clocks.length, 13 - hour);
    if (by > 0) {
      hour += by;
      round.emit({ type: 'clockAdvance', hour, by, cells: clocks });
    }
    resolve(round, grid, RELIC_TABLES.free);
  }
  round.emit({ type: 'freeSpin', index: cfg.spins + 1, remaining: 0, total: cfg.spins + 1, label: 'Final Countdown' });
  const grid = new Grid(drawBoard(round.rng, 'clock'));
  reveal(round, grid, 'clock', 'free');
  const size = cfg.surgeSizeByHour[hour];
  round.emit({ type: 'clockStrike', hour, surgeSize: size });
  const block = relicSurge(grid, round.rng, size, round.rng.weighted(SURGE_MULT[size]));
  if (block) round.emit({ type: 'relicSurge', block, board: grid.snapshot() });
  resolve(round, grid, RELIC_TABLES.free);
  round.emit({ type: 'featureEnd', feature: 'thirteenthHour', featureWin: round.total - start, totalWin: round.total });
}

/** Three Keys to the Vault: free spins on one of three paths. */
function runFreeSpins(round: Round, path: Exclude<BonusPath, 'vaultBreach'>, spins: number): void {
  const cfg = FEATURES.threeKeys;
  const start = round.total;
  const ledger = newLedger();
  let total = spins;
  let charge = 0;
  let hour = FEATURES.midnightCountdown.startHour;
  let pendingStrike = false;
  round.emit({ type: 'bonusPath', path, spins });
  round.emit({ type: 'ledger', seals: structuredClone(ledger) });

  for (let index = 1; index <= total; index++) {
    const strikeSpin = pendingStrike;
    pendingStrike = false;
    round.emit({ type: 'freeSpin', index, remaining: total - index, total, label: strikeSpin ? 'Final Countdown' : undefined });
    const grid = new Grid(drawBoard(round.rng, path));
    reveal(round, grid, path, 'free');
    const keyCells = cellsOf(grid, 'VK');
    const ledgers = grid.count('LG');

    if (path === 'cursedFortune') {
      const add = grid.count('RL') + ledgers;
      if (add > 0) {
        const before = overloadLevel(charge);
        charge += add;
        const level = overloadLevel(charge);
        ledger.relic = { ...ledger.relic, progress: charge, level };
        round.emit({ type: 'overload', charge, level, levelUp: level > before });
        round.emit({ type: 'ledger', seals: structuredClone(ledger) });
      }
      resolve(round, grid, RELIC_TABLES.cursedFortune, overloadLevel(charge));
    } else if (path === 'phantomPayday') {
      const pp = FEATURES.phantomPayday;
      const phantoms = grid.count('PH');
      if (phantoms + ledgers > 0) {
        const progress = ledger.phantom.progress + phantoms + ledgers;
        ledger.phantom = { ...ledger.phantom, progress, level: levelFor(progress, pp.sealThresholds) };
        round.emit({ type: 'ledger', seals: structuredClone(ledger) });
      }
      if (phantoms > 0) {
        const level = ledger.phantom.level;
        const marks = Math.min(pp.maxMarks, pp.baseMarks + pp.marksPerPhantom * phantoms + pp.marksPerLevel * level);
        const target = round.rng.weighted(pp.targets[level]);
        round.emit({ type: 'featureTrigger', feature: 'phantomHeist', cells: cellsOf(grid, 'PH') });
        phantomTransform(round, grid, marks, target, target === 'RL' ? round.rng.weighted(pp.wildMult) : undefined);
      }
      resolve(round, grid, RELIC_TABLES.free);
    } else {
      const mc = FEATURES.midnightCountdown;
      if (strikeSpin) {
        const size = mc.strikeSurgeSize;
        const block = relicSurge(grid, round.rng, size, round.rng.weighted(SURGE_MULT[size]));
        if (block) round.emit({ type: 'relicSurge', block, board: grid.snapshot() });
      }
      const clocks = [...cellsOf(grid, 'CL'), ...cellsOf(grid, 'LG')];
      if (clocks.length) {
        const by = Math.min(clocks.length, mc.strikeHour - hour);
        hour += by;
        round.emit({ type: 'clockAdvance', hour, by, cells: clocks });
        if (hour >= mc.strikeHour && total < cfg.maxSpins) {
          round.emit({ type: 'clockStrike', hour, surgeSize: mc.strikeSurgeSize });
          pendingStrike = true;
          total += 1;
          ledger.clock.level += 1;
          hour = mc.startHour;
        } else if (hour >= mc.strikeHour) {
          hour = mc.strikeHour; // spin cap reached: the clock stays at XIII
        }
        ledger.clock.progress = hour - mc.startHour;
        round.emit({ type: 'ledger', seals: structuredClone(ledger) });
      }
      resolve(round, grid, RELIC_TABLES.free);
    }

    if (keyCells.length >= cfg.retriggerKeys && total < cfg.maxSpins) {
      const added = Math.min(cfg.retriggerSpins, cfg.maxSpins - total);
      total += added;
      round.tags.add('retrigger');
      round.emit({ type: 'retrigger', added, total, cells: keyCells });
    }
  }
  round.emit({ type: 'featureEnd', feature: path, featureWin: round.total - start, totalWin: round.total });
}

/** The Vault Breach: four stages ending in The Final Heist. */
function runVaultBreach(round: Round): void {
  const cfg = FEATURES.vaultBreach;
  const start = round.total;
  const ledger = newLedger();
  ledger.clock.thresholds = [4];
  const totalSpins = cfg.hauntingSpins + cfg.overloadSpins + 1;
  let index = 0;
  const setStage = (stage: 1 | 2 | 3 | 4) => {
    ledger.clock.progress = stage;
    ledger.clock.level = stage >= 4 ? 1 : 0;
    round.emit({ type: 'ledger', seals: structuredClone(ledger) });
  };

  round.emit({ type: 'bonusPath', path: 'vaultBreach', spins: totalSpins });
  round.emit({ type: 'breachStage', stage: 1, name: 'The Seal Breaks', spins: 0 });
  setStage(1);

  // Stage 2: The Haunting - a Phantom Heist on every spin.
  round.emit({ type: 'breachStage', stage: 2, name: 'The Haunting', spins: cfg.hauntingSpins });
  setStage(2);
  for (let i = 0; i < cfg.hauntingSpins; i++) {
    index++;
    round.emit({ type: 'freeSpin', index, remaining: totalSpins - index, total: totalSpins, label: 'The Haunting' });
    const grid = new Grid(drawBoard(round.rng, 'breach'));
    reveal(round, grid, 'breach', 'free');
    const marks = round.rng.weighted(cfg.hauntingMarks);
    const target = round.rng.weighted(cfg.hauntingTargets);
    const cells = phantomTransform(round, grid, marks, target, target === 'RL' ? round.rng.weighted(FEATURES.phantomPayday.wildMult) : undefined);
    const progress = ledger.phantom.progress + cells.length;
    ledger.phantom = { ...ledger.phantom, progress, level: levelFor(progress, ledger.phantom.thresholds) };
    round.emit({ type: 'ledger', seals: structuredClone(ledger) });
    resolve(round, grid, RELIC_TABLES.free);
  }

  // Stage 3: Relic Overload - at least one relic per spin, charge persists.
  round.emit({ type: 'breachStage', stage: 3, name: 'Relic Overload', spins: cfg.overloadSpins });
  setStage(3);
  let charge = cfg.overloadStartCharge;
  ledger.relic = { ...ledger.relic, progress: charge, level: overloadLevel(charge) };
  round.emit({ type: 'overload', charge, level: overloadLevel(charge), levelUp: true });
  round.emit({ type: 'ledger', seals: structuredClone(ledger) });
  for (let i = 0; i < cfg.overloadSpins; i++) {
    index++;
    round.emit({ type: 'freeSpin', index, remaining: totalSpins - index, total: totalSpins, label: 'Relic Overload' });
    const grid = new Grid(drawBoard(round.rng, 'breach'));
    if (grid.count('RL') === 0) {
      const lows = grid.find((s) => SYMBOLS[s].transformable);
      if (lows.length) grid.set(lows[round.rng.int(lows.length)], 'RL');
    }
    reveal(round, grid, 'breach', 'free');
    const before = overloadLevel(charge);
    charge += grid.count('RL') + grid.count('LG');
    const level = overloadLevel(charge);
    ledger.relic = { ...ledger.relic, progress: charge, level };
    round.emit({ type: 'overload', charge, level, levelUp: level > before });
    round.emit({ type: 'ledger', seals: structuredClone(ledger) });
    resolve(round, grid, RELIC_TABLES.cursedFortune, level);
  }

  // Stage 4: The Final Heist - a Relic Surge, then a Lockdown where relics lock reels.
  round.emit({ type: 'breachStage', stage: 4, name: 'The Final Heist', spins: 1 });
  setStage(4);
  index++;
  round.emit({ type: 'freeSpin', index, remaining: 0, total: totalSpins, label: 'The Final Heist' });
  const grid = new Grid(drawBoard(round.rng, 'breach'));
  reveal(round, grid, 'breach', 'free');
  const size = cfg.finalSurgeSize;
  const block = relicSurge(grid, round.rng, size, round.rng.weighted(SURGE_MULT[size]));
  if (block) round.emit({ type: 'relicSurge', block, board: grid.snapshot() });
  runLockdown(round, grid, { lockSym: 'RL', reelSet: 'breach', respins: cfg.finalHeistRespins });
  resolve(round, grid, RELIC_TABLES.cursedFortune, overloadLevel(charge));
  round.emit({ type: 'featureEnd', feature: 'vaultBreach', featureWin: round.total - start, totalWin: round.total });
}

// ---------------------------------------------------------------- base spin

function playSpin(round: Round, board: Board, forcedPath?: BonusPath): void {
  const grid = new Grid(board);
  const feature = detectFeature(grid);
  const blackout = feature !== null && round.rng.chance(FEATURES.blackoutChance);
  reveal(round, grid, 'base', 'base', blackout);
  if (feature) round.tags.add(feature);

  switch (feature) {
    case 'lockdown': {
      round.emit({ type: 'featureTrigger', feature, cells: cellsOf(grid, 'VD') });
      // Relics on the trigger grid do not expand yet: the final grid is expanded and paid once.
      runLockdown(round, grid, { lockSym: 'VD', reelSet: 'lockdown', respins: FEATURES.lockdown.respins });
      // The chains break: every Vault Door on the final grid opens into a Cursed Relic.
      const doors = cellsOf(grid, 'VD');
      for (const c of doors) grid.set(c, 'RL');
      round.emit({ type: 'doorsOpen', cells: doors, board: grid.snapshot() });
      const start = round.total;
      resolve(round, grid, RELIC_TABLES.respin);
      round.emit({ type: 'featureEnd', feature, featureWin: round.total - start, totalWin: round.total });
      return;
    }
    case 'spectralRespin': {
      round.emit({ type: 'featureTrigger', feature, cells: cellsOf(grid, 'EL') });
      const held = grid.find((s) => s === 'EL' || s === 'RL');
      const heldKeys = new Set(held.map((c) => `${c.reel},${c.row}`));
      for (let reel = 0; reel < REELS; reel++) {
        grid.replaceReel(reel, drawReel(round.rng, 'spectral', reel), (row) => heldKeys.has(`${reel},${row}`));
      }
      round.emit({ type: 'spectralRespin', held, board: grid.snapshot() });
      const start = round.total;
      resolve(round, grid, RELIC_TABLES.respin);
      round.emit({ type: 'featureEnd', feature, featureWin: round.total - start, totalWin: round.total });
      return;
    }
    case 'phantomHeist': {
      round.emit({ type: 'featureTrigger', feature, cells: cellsOf(grid, 'PH') });
      // The Phantom steals the most common low symbol and turns every copy into the target.
      const target = round.rng.weighted(FEATURES.phantomHeist.targets);
      const stolen = mostCommonLow(grid);
      phantomTransform(round, grid, 0, target, target === 'RL' ? round.rng.weighted(FEATURES.phantomPayday.wildMult) : undefined, stolen);
      const start = round.total;
      resolve(round, grid, RELIC_TABLES.base);
      round.emit({ type: 'featureEnd', feature, featureWin: round.total - start, totalWin: round.total });
      return;
    }
    default:
      break;
  }

  // Normal spin (also the trigger spin of the sequence features, which is paid first).
  resolve(round, grid, RELIC_TABLES.base);

  if (feature === 'thirteenthHour') {
    round.emit({ type: 'featureTrigger', feature, cells: cellsOf(grid, 'CL') });
    runThirteenthHour(round);
  } else if (feature === 'threeKeys' || feature === 'vaultBreach') {
    const keys = cellsOf(grid, 'VK');
    round.emit({ type: 'featureTrigger', feature, cells: keys });
    const path: BonusPath = forcedPath ?? (feature === 'vaultBreach' ? 'vaultBreach' : (round.rng.weighted(FEATURES.threeKeys.pathWeights) as BonusPath));
    round.tags.add(path);
    if (path === 'vaultBreach') runVaultBreach(round);
    else runFreeSpins(round, path, FEATURES.threeKeys.spinsByKeys[Math.min(keys.length, 4)]);
  }
}

/** Base board with exactly `keys` Vault Keys on distinct reels (bonus buy). */
export function forcedKeyBoard(rng: Rng, keys: number): Board {
  const board = drawBoard(rng, 'base');
  for (let reel = 0; reel < REELS; reel++) {
    while (board[reel].includes('VK')) board[reel] = drawReel(rng, 'base', reel);
  }
  for (const reel of rng.sample([0, 1, 2, 3, 4], keys)) board[reel][rng.int(5)] = 'VK';
  return board;
}

export type ModeName = 'base' | 'bonus';

export interface PlayOptions {
  /** Force a starting board (test harness / forced outcomes). */
  board?: Board;
  forcedPath?: BonusPath;
}

/** Plays one complete round and returns its book. */
export function playRound(id: number, mode: ModeName, rng: Rng, opts: PlayOptions = {}): Book {
  const round = new Round(rng);
  try {
    if (mode === 'base') {
      playSpin(round, opts.board ?? drawBoard(rng, 'base'), opts.forcedPath);
    } else {
      const keys = rng.chance(BONUS_BUY_FOUR_KEYS) ? 4 : 3;
      const path = opts.forcedPath ?? (rng.weighted(BONUS_BUY_PATHS) as BonusPath);
      playSpin(round, opts.board ?? forcedKeyBoard(rng, keys), path);
    }
  } catch (e) {
    if (!(e instanceof WincapReached)) throw e;
  }
  round.emit({ type: 'finalWin', amount: round.total });
  const tags = [...round.tags];
  const criteria = round.tags.has('wincap') ? 'wincap' : round.total === 0 ? 'zero' : tags.length ? tags[0] : 'basegame';
  return { id, payoutMultiplier: round.total, events: round.events, criteria, tags };
}
