// The single source of truth for Midnight Vault's rules and math parameters.
// The engine, the simulator, the tests and the in-game rules panel all read from here.
import type { SymbolCategory, SymbolId, Weighted } from './types.ts';

export const REELS = 5;
export const ROWS = 5;

/** 1x bet expressed in the engine's integer unit. */
export const BET_UNIT = 100;
/** Maximum total win of a round, in centi-bet (5,000x bet). */
export const WINCAP = 5000 * BET_UNIT;

export interface SymbolDef {
  id: SymbolId;
  name: string;
  asset: string;
  category: SymbolCategory;
  /** Line pays in centi-bet (x total bet * 100) for 3, 4 and 5 of a kind. */
  pays: { 3?: number; 4?: number; 5?: number };
  /** Can the Cursed Relic stand in for this symbol on a payline? */
  substitutable: boolean;
  /** Can a Phantom Heist transform this symbol? */
  transformable: boolean;
  /** Free-text rule shown in the paytable for special behaviour. */
  rule?: string;
}

const pays = (p3: number, p4: number, p5: number) => ({ 3: p3, 4: p4, 5: p5 });

export const SYMBOLS: Record<SymbolId, SymbolDef> = {
  RL: {
    id: 'RL', name: 'Cursed Relic', asset: 'sym_relic', category: 'wild', pays: pays(25, 75, 250),
    substitutable: false, transformable: false,
    rule: 'Wild. Substitutes for every symbol except the Vault Key. Carries a multiplier and may expand into a 2x2, 3x3 or 4x4 block.',
  },
  VK: {
    id: 'VK', name: 'Vault Key', asset: 'sym_key', category: 'scatter', pays: {},
    substitutable: false, transformable: false,
    rule: 'Scatter. 3 Keys anywhere open Three Keys to the Vault, 4 Keys add extra free spins, 5 Keys open The Vault Breach.',
  },
  GB: { id: 'GB', name: 'Gold Bag', asset: 'sym_goldbag', category: 'high', pays: pays(100, 300, 1000), substitutable: true, transformable: false },
  TC: { id: 'TC', name: 'Treasure Chest', asset: 'sym_chest', category: 'high', pays: pays(80, 250, 800), substitutable: true, transformable: false },
  LG: {
    id: 'LG', name: 'Haunted Ledger', asset: 'sym_ledger', category: 'high', pays: pays(60, 200, 600), substitutable: true, transformable: false,
    rule: 'During bonus rounds each Ledger adds 1 progress to the active Ledger seal.',
  },
  VD: {
    id: 'VD', name: 'Vault Door', asset: 'sym_vaultdoor', category: 'high', pays: pays(50, 150, 500), substitutable: true, transformable: false,
    rule: '3 or more Vault Doors anywhere trigger the Lockdown Spin.',
  },
  PH: {
    id: 'PH', name: 'Phantom', asset: 'sym_phantom', category: 'high', pays: pays(50, 150, 500), substitutable: true, transformable: false,
    rule: '3 or more Phantoms anywhere trigger the Phantom Heist.',
  },
  CL: {
    id: 'CL', name: 'Thirteenth Clock', asset: 'sym_clock', category: 'high', pays: pays(50, 150, 500), substitutable: true, transformable: false,
    rule: '3 or more Clocks anywhere trigger The Thirteenth Hour.',
  },
  EL: {
    id: 'EL', name: 'Spectral Elixir', asset: 'sym_elixir', category: 'high', pays: pays(50, 150, 500), substitutable: true, transformable: false,
    rule: '3 or more Elixirs anywhere trigger the Spectral Respin.',
  },
  A: { id: 'A', name: 'A', asset: 'sym_a', category: 'low', pays: pays(20, 50, 150), substitutable: true, transformable: true },
  K: { id: 'K', name: 'K', asset: 'sym_k', category: 'low', pays: pays(20, 50, 150), substitutable: true, transformable: true },
  Q: { id: 'Q', name: 'Q', asset: 'sym_q', category: 'low', pays: pays(10, 30, 100), substitutable: true, transformable: true },
  J: { id: 'J', name: 'J', asset: 'sym_j', category: 'low', pays: pays(10, 30, 100), substitutable: true, transformable: true },
  T: { id: 'T', name: '10', asset: 'sym_10', category: 'low', pays: pays(10, 30, 100), substitutable: true, transformable: true },
};

export const SYMBOL_ORDER: SymbolId[] = ['RL', 'VK', 'GB', 'TC', 'LG', 'VD', 'PH', 'CL', 'EL', 'A', 'K', 'Q', 'J', 'T'];

/** 15 paylines. Each entry gives the row (0 = top) used on reels 1..5. */
export const PAYLINES: number[][] = [
  [2, 2, 2, 2, 2],
  [1, 1, 1, 1, 1],
  [3, 3, 3, 3, 3],
  [0, 0, 0, 0, 0],
  [4, 4, 4, 4, 4],
  [0, 1, 2, 3, 4],
  [4, 3, 2, 1, 0],
  [1, 2, 3, 2, 1],
  [3, 2, 1, 2, 3],
  [2, 1, 0, 1, 2],
  [2, 3, 4, 3, 2],
  [1, 2, 1, 2, 1],
  [3, 2, 3, 2, 3],
  [0, 2, 4, 2, 0],
  [4, 2, 0, 2, 4],
];

/**
 * Reel strip composition: how many of each symbol sit on one strip.
 * Every reel in a set uses the same composition, shuffled with its own seed.
 * Keys, Relics and the feature symbols are spread so at most one of each shows per reel window.
 */
export type StripSpec = Partial<Record<SymbolId, number>>;

export const REEL_SETS: Record<string, StripSpec> = {
  base: { RL: 1, VK: 2, GB: 6, TC: 7, LG: 6, VD: 2, PH: 2, CL: 3, EL: 2, A: 17, K: 17, Q: 19, J: 19, T: 19 },
  lockdown: { RL: 4, GB: 7, TC: 7, LG: 6, VD: 2, PH: 3, CL: 3, EL: 3, A: 14, K: 14, Q: 15, J: 15, T: 15 },
  spectral: { RL: 6, GB: 7, TC: 7, LG: 6, VD: 2, PH: 2, CL: 2, EL: 5, A: 13, K: 13, Q: 14, J: 14, T: 14 },
  clock: { RL: 1, GB: 6, TC: 6, LG: 4, VD: 2, PH: 2, CL: 2, EL: 2, A: 14, K: 14, Q: 15, J: 15, T: 15 },
  cursedFortune: { RL: 4, VK: 2, GB: 6, TC: 6, LG: 2, VD: 2, PH: 2, CL: 2, EL: 2, A: 14, K: 14, Q: 15, J: 15, T: 15 },
  phantomPayday: { RL: 3, VK: 2, GB: 6, TC: 6, LG: 2, VD: 2, PH: 6, CL: 2, EL: 2, A: 14, K: 14, Q: 15, J: 15, T: 15 },
  midnightCountdown: { RL: 2, VK: 2, GB: 6, TC: 6, LG: 2, VD: 2, PH: 2, CL: 3, EL: 2, A: 14, K: 14, Q: 15, J: 15, T: 15 },
  breach: { RL: 5, GB: 6, TC: 6, LG: 3, VD: 3, PH: 6, CL: 2, EL: 3, A: 13, K: 13, Q: 14, J: 14, T: 14 },
};

/** Symbols that may appear at most once per reel window (each spaced from its own copies). */
export const SPACED_SYMBOLS: SymbolId[] = ['VK', 'RL', 'VD', 'PH', 'CL', 'EL'];

export interface RelicTable {
  mult: Weighted<number>;
  size: Weighted<number>;
}

export const RELIC_TABLES: Record<string, RelicTable> = {
  base: {
    mult: [[1, 60], [2, 25], [3, 10], [5, 5]],
    size: [[1, 820], [2, 140], [3, 35], [4, 5]],
  },
  respin: {
    mult: [[1, 55], [2, 27], [3, 12], [5, 6]],
    size: [[1, 780], [2, 170], [3, 42], [4, 8]],
  },
  free: {
    mult: [[1, 50], [2, 30], [3, 15], [5, 5]],
    size: [[1, 750], [2, 200], [3, 45], [4, 5]],
  },
  cursedFortune: {
    mult: [[2, 520], [3, 270], [5, 130], [10, 50], [25, 20], [50, 7], [100, 3]],
    size: [[1, 750], [2, 210], [3, 35], [4, 5]],
  },
};

/** Relic Surge tables keyed by the guaranteed block size. */
export const SURGE_MULT: Record<number, Weighted<number>> = {
  2: [[1, 50], [2, 35], [3, 15]],
  3: [[1, 40], [2, 35], [3, 20], [5, 5]],
  4: [[1, 50], [2, 35], [3, 15]],
};

export const FEATURES = {
  /** Base-game feature trigger counts (anywhere on the landed grid). */
  triggerCount: { VD: 3, PH: 3, CL: 3, EL: 3 },
  /** Base game resolves at most one feature per spin, in this priority order. */
  priority: ['vaultBreach', 'threeKeys', 'thirteenthHour', 'lockdown', 'spectralRespin', 'phantomHeist'] as const,

  lockdown: { respins: 3 },

  phantomHeist: {
    targets: [['RL', 20], ['GB', 30], ['TC', 30], ['LG', 20]] as Weighted<SymbolId>,
  },

  thirteenthHour: {
    spins: 4,
    startHour: 9,
    /** Final Countdown Spin surge size by the hour reached. */
    surgeSizeByHour: { 9: 2, 10: 2, 11: 2, 12: 3, 13: 4 } as Record<number, number>,
  },

  threeKeys: {
    spinsByKeys: { 3: 8, 4: 10 } as Record<number, number>,
    retriggerKeys: 3,
    retriggerSpins: 4,
    maxSpins: 30,
    /** Path chosen by the vault when 3 or 4 Keys land in the base game. */
    pathWeights: [['cursedFortune', 40], ['phantomPayday', 35], ['midnightCountdown', 25]] as Weighted<string>,
  },

  /** Relic Overload (Cursed Fortune and Vault Breach stage 3). */
  overload: {
    thresholds: [5, 10, 14],
    /** Minimum expansion size at each level (index = level). */
    minSize: [1, 2, 2, 3],
    /** Relic multiplier factor at each level. Level 3 doubles each relic's own multiplier. */
    multFactor: [1, 1, 1, 2],
  },

  phantomPayday: {
    sealThresholds: [3, 6, 10],
    baseMarks: 2,
    marksPerPhantom: 3,
    marksPerLevel: 1,
    maxMarks: 10,
    targets: [
      [['GB', 15], ['TC', 25], ['LG', 25], ['EL', 35]],
      [['GB', 20], ['TC', 30], ['LG', 25], ['EL', 25]],
      [['GB', 35], ['TC', 35], ['LG', 20], ['EL', 10]],
      [['RL', 30], ['GB', 35], ['TC', 35]],
    ] as Weighted<SymbolId>[],
    wildMult: [[1, 40], [2, 35], [3, 15], [5, 10]] as Weighted<number>,
  },

  midnightCountdown: {
    startHour: 9,
    strikeHour: 13,
    strikeSurgeSize: 4,
  },

  vaultBreach: {
    hauntingSpins: 4,
    overloadSpins: 4,
    overloadStartCharge: 3,
    finalHeistRespins: 3,
    finalSurgeSize: 4,
    hauntingMarks: [[4, 30], [5, 30], [6, 25], [8, 15]] as Weighted<number>,
    hauntingTargets: [['RL', 15], ['GB', 30], ['TC', 30], ['LG', 25]] as Weighted<SymbolId>,
  },

  /** Share of feature-triggering base reveals that use the Blackout presentation (cosmetic only). */
  blackoutChance: 0.35,
};

export interface BetModeDef {
  name: string;
  cost: number;
  label: string;
  description: string;
}

export const BET_MODES: BetModeDef[] = [
  { name: 'base', cost: 1, label: 'Spin', description: 'Standard spin at 1x bet.' },
  {
    name: 'bonus', cost: 100, label: 'Buy Bonus',
    description: 'Costs 100x bet. Starts the round with 3 or 4 Vault Keys, opening Three Keys to the Vault (small chance of The Vault Breach).',
  },
];

/** Path weights for the bonus buy, which can also open The Vault Breach. */
export const BONUS_BUY_PATHS: Weighted<string> = [
  ['cursedFortune', 37], ['phantomPayday', 35], ['midnightCountdown', 26], ['vaultBreach', 2],
];
/** Probability that a bonus buy starts with 4 keys instead of 3. */
export const BONUS_BUY_FOUR_KEYS = 0.1;
