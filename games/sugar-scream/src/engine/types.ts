// Shared types for the Sugar Scream outcome engine and the book event contract.
// All money-like values are integer "centi-bet" units: 100 = 1x the base bet.

export type SymbolId =
  | 'BH' // Bleeding Heart gummy
  | 'WP' // Witch's Potion drop
  | 'SL' // Slime Drop
  | 'GM' // Ghost Marshmallow
  | 'PA' // Poison Apple
  | 'EY' // Eyeball Gumball
  | 'PU' // Pumpkin Bonbon
  | 'BT' // Gummy Bat
  | 'CC' // Candy Corn
  | 'SC' // Skull Lollipop (scatter)
  | 'JK'; // Jack-o'-Lantern multiplier (free spins only)

export type SymbolCategory = 'high' | 'low' | 'scatter' | 'multiplier';

/** A cell address. `reel` is the column (0-5, left to right), `row` is 0-4 top to bottom. */
export interface Cell {
  reel: number;
  row: number;
}

/** board[reel][row] */
export type Board = SymbolId[][];

export type Weighted<T> = ReadonlyArray<readonly [T, number]>;

/** A Jack-o'-Lantern on the board and the multiplier it carries. */
export interface MultCell extends Cell {
  value: number;
}

/** A paying symbol: every cell holding `symbol` on the current board is part of the win. */
export interface ClusterWin {
  symbol: SymbolId;
  count: number;
  pay: number; // centi-bet
}

/** A Soul Orb locked on the Graveyard Lock board; `value` is centi-bet. */
export interface Orb extends Cell {
  kind: 'soul' | 'mini' | 'major' | 'lantern';
  value: number;
}

export type FreeSpinKind = 'cauldron' | 'fullMoon';

export type KnockPrize =
  | { prize: 'treat'; amount: number }
  | { prize: 'trick' }
  | { prize: 'lollipop' };

export type GameEvent =
  /** A fresh spin: the whole board lands. */
  | { type: 'reveal'; board: Board; mults: MultCell[]; phase: 'base' | 'free' }
  /** Witch's Spell: before the first evaluation, `cells` turn into `symbol`. */
  | { type: 'witchSpell'; symbol: SymbolId; cells: Cell[]; board: Board }
  /** Paying clusters on the current board. `tumbleTotal` is this spin's running tumble win before multipliers. */
  | { type: 'tumbleWin'; wins: ClusterWin[]; tumbleTotal: number }
  /**
   * Every cell of the last tumbleWin's symbols explodes, the rest falls down and `fill[reel]`
   * drops in from the top of each reel (top to bottom). `mults` lists every Jack-o'-Lantern
   * on the resulting board. The new board is rebuilt with `applyTumble` (engine/board.ts).
   */
  | { type: 'tumble'; fill: SymbolId[][]; mults: MultCell[] }
  /** End of a winning free spin: Jack-o'-Lanterns are added to the Cauldron and multiply the spin. */
  | { type: 'multiplier'; cells: MultCell[]; landed: number; cauldronBefore: number; mult: number; base: number }
  /** The only event that adds money. `totalWin` is the running round total. */
  | { type: 'win'; kind: 'spin' | 'scatter' | 'treat' | 'loot' | 'hold'; amount: number; totalWin: number }
  /** Graveyard Lock begins: the board empties and `orbs` lock in place with `respins` respins. */
  | { type: 'holdStart'; respins: number; orbs: Orb[] }
  /**
   * One respin: `landed` orbs lock (empty cells only). Then each Lantern Orb among them doubles
   * every other orb locked in its reel (`boosts`, in order, with the new values; left out when none). `respins` is
   * what is left afterwards (back to 3 if anything landed) and `filled` the orbs on the board.
   */
  | { type: 'holdRespin'; index: number; landed: Orb[]; boosts?: { lantern: Cell; cells: MultCell[] }[]; respins: number; filled: number }
  /** Graveyard Lock ends: the orbs are counted up (`total`), or the full board pays the Grand. */
  | { type: 'holdEnd'; filled: number; total: number; grand: boolean }
  /** Loot Box: the player opens one of `boxes`; it holds `tier` at `multiplier` x the bet. */
  | { type: 'lootBox'; boxes: number; tier: 'big' | 'mega' | 'monster' | 'sugar' | 'max'; multiplier: number }
  | { type: 'trickOrTreat'; cells: Cell[]; knocks: number }
  | ({ type: 'knock'; index: number } & KnockPrize)
  | { type: 'trickOrTreatEnd'; total: number; lollipop: boolean }
  | { type: 'freeSpinsStart'; kind: FreeSpinKind; spins: number; cauldron: number; cells: Cell[] }
  | { type: 'freeSpin'; index: number; total: number }
  | { type: 'retrigger'; added: number; total: number; cells: Cell[] }
  | { type: 'cauldron'; value: number }
  /** Pumpkin Patch: Jack-o'-Lanterns split; each copy (same value) lands on a candy cell. Before the spin's multiplier. */
  | { type: 'pumpkinSplit'; splits: { from: Cell; to: Cell; value: number }[] }
  | { type: 'freeSpinsEnd'; kind: FreeSpinKind; featureWin: number; totalWin: number }
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
