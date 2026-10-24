// Quick raw (unweighted) statistics for tuning: node --experimental-strip-types src/math/tune.ts base 20000
import { playRound, type ModeName } from '../engine/round.ts';
import { Rng } from '../engine/rng.ts';
import type { BonusPath } from '../engine/types.ts';
import { BET_MODES, WINCAP } from '../engine/config.ts';

const arg = process.argv[2] ?? 'base';
const forced = ['cursedFortune', 'phantomPayday', 'midnightCountdown', 'vaultBreach'].includes(arg) ? (arg as BonusPath) : undefined;
const mode = (forced ? 'bonus' : arg) as ModeName;
const n = Number(process.argv[3] ?? 20000);
const seed = Number(process.argv[4] ?? 7);
const cost = BET_MODES.find((m) => m.name === mode)!.cost;
const rng = new Rng(seed);
let sum = 0, hits = 0, caps = 0, sq = 0;
const tags = new Map<string, { n: number; win: number; max: number }>();
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const b = playRound(i, mode, rng, { forcedPath: forced });
  const x = b.payoutMultiplier / 100;
  sum += x; sq += x * x; if (x > 0) hits++; if (b.payoutMultiplier >= WINCAP) caps++;
  for (const t of b.tags.length ? b.tags : ['none']) {
    const a = tags.get(t) ?? { n: 0, win: 0, max: 0 };
    a.n++; a.win += x; a.max = Math.max(a.max, x); tags.set(t, a);
  }
}
const mean = sum / n;
console.log(`${mode} n=${n} RTP=${(mean / cost * 100).toFixed(2)}% hit=1/${(n / hits).toFixed(2)} sd=${Math.sqrt(sq / n - mean * mean).toFixed(2)}x caps=${caps} ${(Date.now() - t0) / 1000}s`);
for (const [t, a] of [...tags].sort((x, y) => y[1].n - x[1].n))
  console.log(`  ${t.padEnd(18)} 1/${(n / a.n).toFixed(1).padStart(8)}  rtp ${(a.win / n / cost * 100).toFixed(2).padStart(7)}%  avg ${(a.win / a.n).toFixed(2).padStart(8)}x  max ${a.max.toFixed(0)}x`);
