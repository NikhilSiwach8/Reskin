// Raw (unweighted) statistics for tuning: node --experimental-strip-types src/math/tune.ts base 200000
import { BET_MODES } from '../engine/config.ts';
import { playRound, type ModeName } from '../engine/round.ts';
import { Rng } from '../engine/rng.ts';

const mode = (process.argv[2] ?? 'base') as ModeName;
const n = Number(process.argv[3] ?? 100000);
const cost = BET_MODES.find((m) => m.name === mode)!.cost;
const rng = new Rng(Number(process.argv[4] ?? 7));
let sum = 0, hits = 0, max = 0, sq = 0;
const tags = new Map<string, { n: number; win: number }>();
for (let i = 0; i < n; i++) {
  const b = playRound(i, mode, rng);
  const x = b.payoutMultiplier / 100;
  sum += x; sq += x * x; if (x > 0) hits++; max = Math.max(max, x);
  for (const t of b.tags) { const a = tags.get(t) ?? { n: 0, win: 0 }; a.n++; a.win += x; tags.set(t, a); }
}
const mean = sum / n;
console.log(`${mode}: RTP ${(mean / cost * 100).toFixed(2)}%  hit 1 in ${(n / hits).toFixed(2)}  sd ${Math.sqrt(sq / n - mean * mean).toFixed(2)}x  max ${max}x`);
for (const [t, a] of [...tags].sort((p, q) => q[1].n - p[1].n)) console.log(`  ${t.padEnd(16)} 1 in ${(n / a.n).toFixed(1).padStart(9)}  avg ${(a.win / a.n).toFixed(2).padStart(8)}x  rtp ${(a.win / n / cost * 100).toFixed(2)}%`);
