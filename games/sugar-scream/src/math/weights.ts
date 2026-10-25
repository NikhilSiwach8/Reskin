// Lookup-table weighting.
//
// Books fall into groups:
//   fixed groups - books whose total probability is known or estimated independently
//                  (the win cap)
//   below        - remaining natural rounds paying less than the mode cost (including 0)
//   above        - remaining natural rounds paying at least the mode cost
// Every book inside a group gets the same weight, so the simulated shape of the
// distribution inside each group is preserved exactly. Each fixed group receives its
// probability; the below/above split is then solved so the weighted RTP equals the
// target. This is the only adjustment made.

export interface FixedGroup {
  name: string;
  /** Total probability of the group (all members share it equally). */
  probability: number;
  members: boolean[];
}

export interface WeightInput {
  payouts: ArrayLike<number>; // centi-bet
  cost: number;
  targetRtp: number; // e.g. 0.96
  /** Earlier groups take precedence when a book matches several. */
  fixed: FixedGroup[];
}

export interface WeightResult {
  weights: number[];
  rtp: number;
  belowProbability: number;
  aboveProbability: number;
  fixed: { name: string; probability: number; books: number }[];
  /** Ratio between the solved and the simulated probability of the "above cost" group. */
  aboveScale: number;
}

/** Total integer weight across all books (fits safely below 2^53). */
const TOTAL = 1e15;

export function solveWeights(input: WeightInput): WeightResult {
  const { payouts, cost, targetRtp } = input;
  const n = payouts.length;
  const threshold = cost * 100;
  const group = new Array<number>(n).fill(-1); // index into fixed, or -1
  for (let i = 0; i < n; i++) group[i] = input.fixed.findIndex((g) => g.members[i]);

  const fixedStats = input.fixed.map((g, gi) => {
    let count = 0, sum = 0;
    for (let i = 0; i < n; i++) if (group[i] === gi) { count++; sum += payouts[i] / 100; }
    return { name: g.name, probability: count ? g.probability : 0, books: count, mean: count ? sum / count : 0 };
  });
  let nA = 0, sA = 0, nB = 0, sB = 0;
  for (let i = 0; i < n; i++) {
    if (group[i] !== -1) continue;
    if (payouts[i] < threshold) { nA++; sA += payouts[i] / 100; }
    else { nB++; sB += payouts[i] / 100; }
  }
  if (!nA || !nB) throw new Error('Need books both below and above the mode cost to solve weights');
  const pFixed = fixedStats.reduce((s, g) => s + g.probability, 0);
  const rtpFixed = fixedStats.reduce((s, g) => s + g.probability * g.mean, 0);
  const eA = sA / nA;
  const eB = sB / nB;
  const pB = (targetRtp * cost - rtpFixed - (1 - pFixed) * eA) / (eB - eA);
  const pA = 1 - pFixed - pB;
  if (!(pA > 0 && pB > 0)) {
    throw new Error(`Cannot reach RTP ${targetRtp} for cost ${cost}: needs above-cost probability ${pB.toFixed(4)} (means ${eA.toFixed(3)}x / ${eB.toFixed(2)}x)`);
  }
  const wA = Math.max(1, Math.round((pA * TOTAL) / nA));
  const wB = Math.max(1, Math.round((pB * TOTAL) / nB));
  const wFixed = fixedStats.map((g) => (g.books ? Math.max(1, Math.round((g.probability * TOTAL) / g.books)) : 0));
  const weights = Array.from({ length: n }, (_, i) => (group[i] !== -1 ? wFixed[group[i]] : payouts[i] < threshold ? wA : wB));
  return {
    weights,
    rtp: weightedRtp(payouts, weights, cost),
    belowProbability: pA,
    aboveProbability: pB,
    fixed: fixedStats.map(({ name, probability, books }) => ({ name, probability, books })),
    aboveScale: pB / (nB / (nA + nB)),
  };
}

/** Exact RTP of a weighted book set. */
export function weightedRtp(payouts: ArrayLike<number>, weights: ArrayLike<number>, cost: number): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < payouts.length; i++) {
    num += weights[i] * (payouts[i] / 100);
    den += weights[i];
  }
  return num / den / cost;
}
