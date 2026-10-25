import { describe, expect, it } from 'vitest';
import { WINCAP } from '../src/engine/config.ts';
import { solveWeights, weightedRtp } from '../src/math/weights.ts';

describe('lookup-table weights', () => {
  const payouts = [0, 0, 0, 50, 120, 300, 1500, WINCAP];
  const wincap = payouts.map((p) => p >= WINCAP);
  const fixed = (p: number) => [{ name: 'wincap', probability: p, members: wincap }];

  it('hits the target RTP exactly with integer weights', () => {
    const r = solveWeights({ payouts, cost: 1, targetRtp: 0.96, fixed: fixed(1e-6) });
    expect(r.weights.every((w) => Number.isInteger(w) && w > 0)).toBe(true);
    expect(r.rtp).toBeCloseTo(0.96, 6);
    expect(weightedRtp(payouts, r.weights, 1)).toBeCloseTo(0.96, 6);
  });

  it('gives every book inside a group the same weight', () => {
    const r = solveWeights({ payouts, cost: 1, targetRtp: 0.96, fixed: fixed(1e-6) });
    expect(new Set(r.weights.slice(0, 4)).size).toBe(1); // below 1x
    expect(new Set(r.weights.slice(4, 7)).size).toBe(1); // 1x and above
  });

  it('assigns the win-cap group its requested probability', () => {
    const r = solveWeights({ payouts, cost: 1, targetRtp: 0.96, fixed: fixed(1e-6) });
    const total = r.weights.reduce((a, b) => a + b, 0);
    expect(r.weights[7] / total).toBeCloseTo(1e-6, 9);
  });

  it('supports several fixed-probability groups with first-match precedence', () => {
    const rare = payouts.map((_, i) => i === 6 || i === 7);
    const r = solveWeights({ payouts, cost: 1, targetRtp: 0.96, fixed: [...fixed(1e-6), { name: 'rare', probability: 1e-4, members: rare }] });
    const total = r.weights.reduce((a, b) => a + b, 0);
    expect(r.weights[7] / total).toBeCloseTo(1e-6, 9); // win cap wins precedence
    expect(r.weights[6] / total).toBeCloseTo(1e-4, 7);
    expect(r.rtp).toBeCloseTo(0.96, 6);
  });

  it('refuses impossible targets instead of producing a broken table', () => {
    expect(() => solveWeights({ payouts, cost: 1, targetRtp: 50, fixed: fixed(0) })).toThrow();
  });
});
