// Lookup-table weighting.
//
// Books fall into three groups:
//   below   - natural rounds paying less than the mode cost (including 0)
//   above   - natural rounds paying at least the mode cost, below the win cap
//   wincap  - rounds that hit the 5,000x cap (natural or forced)
// Every book inside a group gets the same weight, so the simulated shape of the
// win distribution inside each group is preserved exactly. The wincap group
// receives its estimated natural probability; the below/above split is then
// solved so the weighted RTP equals the target. This is the only adjustment made.
import { WINCAP } from '../engine/config.ts';

export interface WeightInput {
  payouts: ArrayLike<number>; // centi-bet
  wincap: boolean[];
  cost: number;
  targetRtp: number; // e.g. 0.96
  wincapProbability: number;
}

export interface WeightResult {
  weights: number[];
  rtp: number;
  belowProbability: number;
  aboveProbability: number;
  wincapProbability: number;
  /** Ratio between the solved and the simulated probability of the "above cost" group. */
  aboveScale: number;
}

/** Total integer weight across all books (fits safely below 2^53). */
const TOTAL = 1e15;

export function solveWeights(input: WeightInput): WeightResult {
  const { payouts, wincap, cost, targetRtp } = input;
  const threshold = cost * 100;
  let nA = 0, sA = 0, nB = 0, sB = 0, nC = 0;
  for (let i = 0; i < payouts.length; i++) {
    if (wincap[i]) nC++;
    else if (payouts[i] < threshold) { nA++; sA += payouts[i] / 100; }
    else { nB++; sB += payouts[i] / 100; }
  }
  if (!nA || !nB) throw new Error('Need books both below and above the mode cost to solve weights');
  const pC = nC ? input.wincapProbability : 0;
  const eA = sA / nA;
  const eB = sB / nB;
  const pB = (targetRtp * cost - pC * (WINCAP / 100) - (1 - pC) * eA) / (eB - eA);
  const pA = 1 - pC - pB;
  if (!(pA > 0 && pB > 0)) {
    throw new Error(`Cannot reach RTP ${targetRtp} for cost ${cost}: needs above-cost probability ${pB.toFixed(4)} (means ${eA.toFixed(3)}x / ${eB.toFixed(2)}x)`);
  }
  const wA = Math.max(1, Math.round((pA * TOTAL) / nA));
  const wB = Math.max(1, Math.round((pB * TOTAL) / nB));
  const wC = nC ? Math.max(1, Math.round((pC * TOTAL) / nC)) : 0;
  const weights = Array.from(payouts as ArrayLike<number>, (p, i) => (wincap[i] ? wC : p < threshold ? wA : wB));
  const natural = nA + nB;
  return {
    weights,
    rtp: weightedRtp(payouts, weights, cost),
    belowProbability: pA,
    aboveProbability: pB,
    wincapProbability: pC,
    aboveScale: pB / (nB / natural),
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
