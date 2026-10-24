// Payline evaluation.
//
// Rules:
// - 15 fixed paylines, evaluated left to right starting on reel 1.
// - 3, 4 or 5 matching symbols pay per the paytable (in centi-bet).
// - The Cursed Relic substitutes for every symbol except the Vault Key.
// - A line made only of Relics pays from the Relic paytable. When a line starts
//   with Relics, the engine compares the Relic-only run with the substituted
//   symbol run and pays the higher one, never both.
// - Line multiplier = sum of the multipliers of the DISTINCT relic blocks whose
//   cells are part of the winning combination (1 when no relic is involved).
//   A block crossing the line on several cells counts once, so no win is
//   multiplied twice by the same relic.
import { PAYLINES, SYMBOLS } from './config.ts';
import type { Grid } from './grid.ts';
import type { Cell, LineWin, SymbolId } from './types.ts';

export function evaluateLines(grid: Grid): LineWin[] {
  const wins: LineWin[] = [];
  PAYLINES.forEach((rows, i) => {
    const cells: Cell[] = rows.map((row, reel) => ({ reel, row }));
    const syms = cells.map((c) => grid.get(c));
    const win = evaluateLine(grid, cells, syms, i + 1);
    if (win) wins.push(win);
  });
  return wins;
}

function evaluateLine(grid: Grid, cells: Cell[], syms: SymbolId[], line: number): LineWin | null {
  let wildRun = 0;
  while (wildRun < syms.length && syms[wildRun] === 'RL') wildRun++;

  const candidates: LineWin[] = [];
  if (wildRun >= 3) candidates.push(makeWin(grid, line, 'RL', wildRun, cells));

  if (wildRun < syms.length) {
    const target = syms[wildRun];
    if (SYMBOLS[target].substitutable) {
      let count = wildRun;
      while (count < syms.length && (syms[count] === target || syms[count] === 'RL')) count++;
      if (count >= 3 && SYMBOLS[target].pays[count as 3 | 4 | 5]) candidates.push(makeWin(grid, line, target, count, cells));
    }
  }
  if (candidates.length === 0) return null;
  // Higher total wins; on a tie prefer the regular symbol (the later candidate).
  return candidates.reduce((best, c) => (c.win >= best.win ? c : best));
}

function makeWin(grid: Grid, line: number, symbol: SymbolId, count: number, lineCells: Cell[]): LineWin {
  const cells = lineCells.slice(0, count);
  const basePay = SYMBOLS[symbol].pays[count as 3 | 4 | 5] ?? 0;
  const mult = lineMultiplier(grid, cells);
  return { line, symbol, count, cells, basePay, mult, win: basePay * mult };
}

export function lineMultiplier(grid: Grid, cells: Cell[]): number {
  const seen = new Set<number>();
  let sum = 0;
  for (const c of cells) {
    const block = grid.blockOf(c);
    if (block && !seen.has(block.id)) {
      seen.add(block.id);
      sum += block.mult;
    }
  }
  return seen.size === 0 ? 1 : Math.max(1, sum);
}

export function totalWin(wins: LineWin[]): number {
  return wins.reduce((s, w) => s + w.win, 0);
}
