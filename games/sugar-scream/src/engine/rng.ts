// Seeded xoshiro128** generator. Used only to generate books offline (and in tests),
// so every simulation run is reproducible from its seed. In production the Stake RGS
// picks a book with its own certified RNG; the client never generates outcomes.
import type { Weighted } from './types.ts';

export class Rng {
  private s = new Uint32Array(4);

  constructor(seed: number) {
    // splitmix32 to expand the seed into the 128-bit state
    let x = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      this.s[i] = (z ^ (z >>> 16)) >>> 0;
    }
    if (!this.s.some((v) => v !== 0)) this.s[0] = 1;
  }

  nextU32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /** Uniform integer in [0, n) without modulo bias. */
  int(n: number): number {
    if (n <= 0 || !Number.isInteger(n)) throw new Error(`Rng.int: invalid bound ${n}`);
    const limit = Math.floor(0x100000000 / n) * n;
    let v: number;
    do v = this.nextU32();
    while (v >= limit);
    return v % n;
  }

  /** Uniform float in [0, 1). */
  float(): number {
    return this.nextU32() / 0x100000000;
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  weighted<T>(table: Weighted<T>): T {
    let total = 0;
    for (const [, w] of table) total += w;
    let r = this.int(total);
    for (const [v, w] of table) {
      if (r < w) return v;
      r -= w;
    }
    throw new Error('Rng.weighted: empty table');
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Pick k distinct items. */
  sample<T>(arr: readonly T[], k: number): T[] {
    return this.shuffle([...arr]).slice(0, Math.min(k, arr.length));
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}
