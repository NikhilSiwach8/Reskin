import { describe, expect, it } from 'vitest';
import { WINCAP } from '../src/engine/config.ts';
import { solveWeights, weightedRtp } from '../src/math/weights.ts';

describe('lookup-table weights', () => {
  const payouts = [0, 0, 0, 50, 120, 300, 1500, WINCAP];
  const wincap = payouts.map((p) => p >= WINCAP);

  it('hits the target RTP exactly with integer weights', () => {
    const r = solveWeights({ payouts, wincap, cost: 1, targetRtp: 0.96, wincapProbability: 1e-6 });
    expect(r.weights.every((w) => Number.isInteger(w) && w > 0)).toBe(true);
    expect(r.rtp).toBeCloseTo(0.96, 6);
    expect(weightedRtp(payouts, r.weights, 1)).toBeCloseTo(0.96, 6);
  });

  it('gives every book inside a group the same weight', () => {
    const r = solveWeights({ payouts, wincap, cost: 1, targetRtp: 0.96, wincapProbability: 1e-6 });
    expect(new Set(r.weights.slice(0, 4)).size).toBe(1); // below 1x
    expect(new Set(r.weights.slice(4, 7)).size).toBe(1); // 1x and above
  });

  it('assigns the win-cap group its requested probability', () => {
    const r = solveWeights({ payouts, wincap, cost: 1, targetRtp: 0.96, wincapProbability: 1e-6 });
    const total = r.weights.reduce((a, b) => a + b, 0);
    expect(r.weights[7] / total).toBeCloseTo(1e-6, 9);
  });

  it('refuses impossible targets instead of producing a broken table', () => {
    expect(() => solveWeights({ payouts, wincap, cost: 1, targetRtp: 50, wincapProbability: 0 })).toThrow();
  });
});
