// Shared types for the Midnight Vault outcome engine and the book event contract.
// All money-like values are integer "centi-bet" units: 100 = 1x the base bet.

export type SymbolId =
  | 'RL' // Cursed Relic (wild)
  | 'VK' // Vault Key (scatter)
  | 'VD' // Vault Door
  | 'PH' // Phantom
  | 'CL' // Thirteenth Clock
  | 'EL' // Spectral Elixir
  | 'LG' // Haunted Ledger
  | 'TC' // Treasure Chest
  | 'GB' // Gold Bag
  | 'A'
  | 'K'
  | 'Q'
  | 'J'
  | 'T'; // "10"

export type SymbolCategory = 'wild' | 'scatter' | 'high' | 'low';

/** A cell address. `reel` is the column (0-4, left to right), `row` is 0-4 top to bottom. */
export interface Cell {
  reel: number;
  row: number;
}

/** board[reel][row] */
export type Board = SymbolId[][];

export type Weighted<T> = ReadonlyArray<readonly [T, number]>;

export interface RelicBlock {
  id: number;
  /** Top-left cell of the square block. */
  reel: number;
  row: number;
  size: number;
  /** Additive multiplier carried by this block. */
  mult: number;
  /** Where the relic originally landed. */
  origin: Cell;
}

export type FeatureId =
  | 'lockdown'
  | 'phantomHeist'
  | 'spectralRespin'
  | 'thirteenthHour'
  | 'threeKeys'
  | 'vaultBreach';

export type BonusPath = 'cursedFortune' | 'phantomPayday' | 'midnightCountdown' | 'vaultBreach';

export type SealId = 'relic' | 'phantom' | 'clock';

export interface SealState {
  progress: number;
  level: number;
  /** Progress values at which the seal gains a level. */
  thresholds: number[];
}

export type LedgerState = Record<SealId, SealState>;

export interface LineWin {
  line: number; // 1-based payline number
  symbol: SymbolId;
  count: number;
  cells: Cell[];
  basePay: number; // centi-bet, before multiplier
  mult: number;
  win: number; // centi-bet
}

export type GameEvent =
  | {
      type: 'reveal';
      board: Board;
      reelSet: string;
      phase: 'base' | 'free' | 'respin';
      anticipation: number[];
      blackout: boolean;
    }
  | { type: 'relicExpand'; blocks: (RelicBlock & { absorbed: Cell[]; surge?: boolean })[]; board: Board }
  | { type: 'relicSurge'; block: RelicBlock; board: Board }
  | { type: 'featureTrigger'; feature: FeatureId; cells: Cell[] }
  | { type: 'phantomHeist'; cells: Cell[]; target: SymbolId; mult?: number; board: Board }
  | { type: 'lockdownStart'; lockedReels: number[]; respins: number }
  | { type: 'lockdownRespin'; board: Board; lockedReels: number[]; newLocks: number[]; respinsLeft: number }
  | { type: 'lockdownEnd'; lockedReels: number[] }
  | { type: 'doorsOpen'; cells: Cell[]; board: Board }
  | { type: 'spectralRespin'; held: Cell[]; board: Board }
  | { type: 'clockStart'; hour: number; spins: number }
  | { type: 'clockAdvance'; hour: number; by: number; cells: Cell[] }
  | { type: 'clockStrike'; hour: number; surgeSize: number }
  | { type: 'overload'; charge: number; level: number; levelUp: boolean }
  | { type: 'ledger'; seals: LedgerState }
  | { type: 'bonusPath'; path: BonusPath; spins: number }
  | { type: 'freeSpin'; index: number; remaining: number; total: number; label?: string }
  | { type: 'retrigger'; added: number; total: number; cells: Cell[] }
  | { type: 'breachStage'; stage: 1 | 2 | 3 | 4; name: string; spins: number }
  | { type: 'winInfo'; wins: LineWin[]; spinWin: number; mult: number; totalWin: number }
  | { type: 'featureEnd'; feature: FeatureId | BonusPath; featureWin: number; totalWin: number }
  | { type: 'wincap'; totalWin: number }
  | { type: 'finalWin'; amount: number };

export interface Book {
  id: number;
  payoutMultiplier: number; // centi-bet, equals finalWin.amount
  events: GameEvent[];
  criteria: string;
  /** Feature tags used for statistics (not needed by the RGS). */
  tags: string[];
}
