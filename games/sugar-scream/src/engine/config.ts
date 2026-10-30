// Every rule and number of Sugar Scream lives here. The rules panel is generated from
// this file, so the published game info always matches the math.
import type { SymbolCategory, SymbolId, Weighted } from './types.ts';

export const GAME_NAME = 'Sugar Scream';
export const REELS = 6;
export const ROWS = 5;
/** Win cap in centi-bet (5,000x). */
export const WINCAP = 500_000;
/** Matching symbols needed anywhere on the board for a win. */
export const MIN_CLUSTER = 8;

export interface SymbolDef {
  name: string;
  category: SymbolCategory;
  /** Pays (centi-bet) for 8-9, 10-11 and 12+ symbols anywhere. */
  pays?: readonly [number, number, number];
}

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  BH: { name: 'Bleeding Heart', category: 'high', pays: [1000, 2500, 5000] },
  WP: { name: "Witch's Potion", category: 'high', pays: [250, 1000, 2500] },
  SL: { name: 'Slime Drop', category: 'high', pays: [200, 500, 1500] },
  GM: { name: 'Ghost Marshmallow', category: 'high', pays: [150, 200, 1200] },
  PA: { name: 'Poison Apple', category: 'low', pays: [100, 150, 1000] },
  EY: { name: 'Eyeball Gumball', category: 'low', pays: [80, 120, 800] },
  PU: { name: 'Pumpkin Bonbon', category: 'low', pays: [50, 100, 500] },
  BT: { name: 'Gummy Bat', category: 'low', pays: [40, 90, 400] },
  CC: { name: 'Candy Corn', category: 'low', pays: [25, 75, 200] },
  SC: { name: 'Skull Lollipop', category: 'scatter' },
  JK: { name: "Jack-o'-Lantern", category: 'multiplier' },
};

export const PAYING: SymbolId[] = ['BH', 'WP', 'SL', 'GM', 'PA', 'EY', 'PU', 'BT', 'CC'];

export function clusterPay(symbol: SymbolId, count: number): number {
  const pays = SYMBOLS[symbol].pays;
  if (!pays || count < MIN_CLUSTER) return 0;
  return count >= 12 ? pays[2] : count >= 10 ? pays[1] : pays[0];
}

/** Scatter pays (centi-bet) by Skull Lollipops on the final board of a base spin. */
export const SCATTER_PAYS: Record<number, number> = { 4: 300, 5: 500, 6: 10000 };
export const scatterPay = (n: number) => (n >= 6 ? SCATTER_PAYS[6] : SCATTER_PAYS[n] ?? 0);

// ------------------------------------------------------------------ symbol draws
// Every cell (on a fresh spin and on each tumble refill) is an independent weighted draw.
export type DrawTable = 'base' | 'ante' | 'free' | 'fullMoon';

const PAY_WEIGHTS: [SymbolId, number][] = [
  ['BH', 26], ['WP', 42], ['SL', 52], ['GM', 66], ['PA', 92], ['EY', 108], ['PU', 124], ['BT', 140], ['CC', 160],
];

// Free spins tumble more often: the low candies are more concentrated.
const FREE_PAY_WEIGHTS: [SymbolId, number][] = [
  ['BH', 26], ['WP', 40], ['SL', 50], ['GM', 62], ['PA', 96], ['EY', 116], ['PU', 136], ['BT', 160], ['CC', 190],
];

export const DRAWS: Record<DrawTable, Weighted<SymbolId>> = {
  base: [...PAY_WEIGHTS, ['SC', 12]],
  // Ante Bet: more Skull Lollipops (free spins about 1.7x, Trick or Treat about 1.5x as often).
  ante: [...PAY_WEIGHTS.map(([s, w]) => [s, w * 2] as [SymbolId, number]), ['SC', 28]],
  free: [...FREE_PAY_WEIGHTS, ['SC', 10], ['JK', 18]],
  fullMoon: [...FREE_PAY_WEIGHTS, ['SC', 10], ['JK', 20]],
};

/** Jack-o'-Lantern multiplier values. */
export const MULT_VALUES: Weighted<number> = [
  [2, 300], [3, 220], [4, 150], [5, 110], [6, 70], [8, 50], [10, 40], [12, 22], [15, 16], [20, 12], [25, 9], [50, 6], [100, 3],
];

// ------------------------------------------------------------------ Witch's Spell (base game)
/** Chance per base-game spin that the Witch casts a spell before the first evaluation. */
export const SPELL_CHANCE = 1 / 56;
/** Symbol the spell conjures. */
export const SPELL_SYMBOLS: Weighted<SymbolId> = [
  ['BH', 3], ['WP', 6], ['SL', 8], ['GM', 10], ['PA', 14], ['EY', 15], ['PU', 16], ['BT', 16], ['CC', 16],
];
/** Cells the spell turns (always enough for a win of at least 8). */
export const SPELL_CELLS: Weighted<number> = [[5, 30], [6, 30], [7, 20], [8, 12], [10, 6], [12, 2]];

// ------------------------------------------------------------------ Trick or Treat (3 scatters)
export const TRICK_OR_TREAT_SCATTERS = 3;
export const KNOCKS = 3;
export const DOORS = 9;
export type KnockOutcome = 'trick' | 'lollipop' | number;
/** One draw per knock. A Golden Lollipop ends the knocking and awards Haunted Cauldron free spins. */
export const KNOCK_TABLE: Weighted<KnockOutcome> = [
  ['trick', 260], [100, 220], [200, 180], [300, 120], [500, 90], [1000, 50], [2500, 14], [5000, 3], ['lollipop', 21],
];

// ------------------------------------------------------------------ Loot Box
/** Chance per base / Ante spin (that triggered no other feature) of a Loot Box. */
export const LOOT_CHANCE = 1 / 1500;
/** Boxes offered; the player opens one (the prize is decided when the round starts). */
export const LOOT_BOXES = 6;
export type LootTier = 'big' | 'mega' | 'monster' | 'sugar' | 'max';
/** Prize tiers: a multiplier of the bet drawn uniformly between min and max (whole numbers). */
export const LOOT_TIERS: Record<LootTier, { name: string; min: number; max: number }> = {
  big: { name: 'Big Win', min: 15, max: 39 },
  mega: { name: 'Mega Win', min: 40, max: 99 },
  monster: { name: 'Monster Win', min: 100, max: 499 },
  sugar: { name: 'Sugar Scream', min: 500, max: 2500 },
  max: { name: 'Max Win', min: 5000, max: 5000 },
};
export const LOOT_TABLE: Weighted<LootTier> = [['big', 700], ['mega', 200], ['monster', 80], ['sugar', 19], ['max', 1]];

// ------------------------------------------------------------------ Graveyard Lock (hold and win)
// The board empties and Soul Orbs lock in place. Each respin, every empty cell may catch a new orb;
// any new orb resets the respins to 3. When the respins run out the round pays the sum of every orb,
// and filling all 30 cells pays the Grand: the 5,000x max win.
export const GRAVE_START_ORBS = 6;
export const GRAVE_RESPINS = 3;
/** Chance per empty cell per respin that a Soul Orb lands. */
export const GRAVE_LAND = 0.04;
export type OrbKind = 'soul' | 'mini' | 'major' | 'lantern';
/** Soul Orb values (centi-bet); Lantern Orbs carry one too. */
export const ORB_VALUES: Weighted<number> = [
  [100, 300], [200, 250], [300, 180], [500, 120], [800, 70], [1000, 50], [1500, 25], [2000, 15], [2500, 10], [5000, 4],
];
/** What a newly landed orb is. A Lantern Orb doubles every other orb locked in its reel. */
export const ORB_KINDS: Weighted<OrbKind> = [['soul', 940], ['mini', 30], ['major', 6], ['lantern', 24]];
/** Jackpot orbs (centi-bet). */
export const JACKPOTS: Record<'mini' | 'major', number> = { mini: 2500, major: 10000 };

// ------------------------------------------------------------------ free spins
/**
 * Pumpkin Patch (Full Moon only): when a free spin's tumbles end with a win, each Jack-o'-Lantern
 * on the board may split, sprouting a copy with the same value on a candy cell. Splits count in
 * that spin's multiplier and are poured into the Cauldron like any other Jack-o'-Lantern.
 */
export const PUMPKIN_SPLIT = 0.2;

export interface FreeSpinDef {
  name: string;
  spins: number;
  /** Cauldron value the feature starts with. */
  cauldron: number;
  /** Each Jack-o'-Lantern adds its value times this to the Cauldron. */
  pour: number;
  draw: DrawTable;
  /** Pumpkin Patch: chance that each Jack-o'-Lantern on a winning spin splits into two (0: never). */
  split: number;
}

export const FREE_SPINS: Record<'cauldron' | 'fullMoon', FreeSpinDef> = {
  cauldron: { name: 'Haunted Cauldron', spins: 10, cauldron: 0, pour: 1, draw: 'free', split: 0 },
  fullMoon: { name: 'Full Moon', spins: 12, cauldron: 5, pour: 2, draw: 'fullMoon', split: PUMPKIN_SPLIT },
};
/** Scatters on the final board of a base spin: 4 = Haunted Cauldron, 5+ = Full Moon. */
export const CAULDRON_SCATTERS = 4;
export const FULL_MOON_SCATTERS = 5;
/** 3+ Skull Lollipops during free spins add 5 spins. */
export const RETRIGGER_SCATTERS = 3;
export const RETRIGGER_SPINS = 5;

// ------------------------------------------------------------------ bet modes
export interface BetModeDef {
  name: string;
  cost: number;
  label: string;
  description: string;
  draw: DrawTable;
  /** Scatters forced onto the first board (bonus buys). */
  forcedScatters?: number;
  /** The buy opens a Loot Box directly. */
  lootBox?: boolean;
  /** The buy plays Graveyard Lock (hold and win). */
  holdWin?: boolean;
  buy?: boolean;
}

// Every mode is weighted to the same 96% RTP. Buy prices follow each feature's simulated value.
export const BET_MODES: BetModeDef[] = [
  { name: 'base', cost: 1, label: 'Spin', description: 'Standard spin at 1x bet.', draw: 'base' },
  {
    name: 'ante', cost: 1.25, label: 'Ante Bet', draw: 'ante',
    description: 'Costs 1.25x bet per spin. Skull Lollipops land more often: free spins trigger about 1.7 times and Trick or Treat about 1.5 times as often.',
  },
  {
    name: 'bonus', cost: 100, label: 'Haunted Cauldron', draw: 'base', forcedScatters: 4, buy: true,
    description: '10 free spins. Every Jack-o\'-Lantern on a winning spin is poured into the Cauldron, which multiplies every later win.',
  },
  {
    name: 'fullmoon', cost: 300, label: 'Full Moon', draw: 'base', forcedScatters: 5, buy: true,
    description: '12 free spins with the Cauldron starting at 5x and more Jack-o\'-Lanterns. Highest volatility.',
  },
  {
    name: 'lootbox', cost: 92, label: 'Loot Box', draw: 'base', lootBox: true, buy: true,
    description: 'Open one of 6 Loot Boxes for a Big (15x+), Mega (40x+), Monster (100x+) or Sugar Scream (500x+) win, or the 5,000x Max Win.',
  },
  {
    name: 'graveyard', cost: 77, label: 'Graveyard Lock', draw: 'base', holdWin: true, buy: true,
    description: 'Hold and win: 6 Soul Orbs lock on an empty board with 3 respins, reset by every new orb. Win the sum of all orbs, Mini (25x) and Major (100x) jackpots, Lantern Orbs that double their reel, and the 5,000x Grand for filling the board.',
  },
];

export const BUY_MODES = BET_MODES.filter((m) => m.buy);
