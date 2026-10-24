// Small promise-based tween engine driven by the Pixi ticker.
// Animations are purely presentational: the outcome is already fixed by the book.
// `speed` scales every duration (turbo) and `finishAll()` completes everything at once (slam stop).
import type { Ticker } from 'pixi.js';

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t * t * t,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  outElastic: (t: number) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

interface Active {
  elapsed: number;
  duration: number;
  update: (t: number) => void;
  resolve: () => void;
}

export class Tweener {
  speed = 1;
  reducedMotion = false;
  private active = new Set<Active>();

  constructor(ticker: Ticker) {
    ticker.add((t) => this.step(t.deltaMS));
  }

  private step(dt: number): void {
    for (const a of [...this.active]) {
      a.elapsed += dt * this.speed;
      const t = Math.min(1, a.elapsed / a.duration);
      a.update(t);
      if (t >= 1) {
        this.active.delete(a);
        a.resolve();
      }
    }
  }

  /** Runs `update(p)` with p going 0..1 over `ms`. */
  run(ms: number, update: (p: number) => void, easing: Ease = ease.outCubic): Promise<void> {
    if (ms <= 0) {
      update(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.active.add({ elapsed: 0, duration: ms, update: (t) => update(easing(t)), resolve });
    });
  }

  /** Tweens numeric properties of an object. */
  to<T extends object>(target: T, props: Partial<Record<keyof T, number>>, ms: number, easing: Ease = ease.outCubic): Promise<void> {
    const from: Record<string, number> = {};
    const rec = target as Record<string, number>;
    for (const k of Object.keys(props)) from[k] = rec[k];
    return this.run(ms, (p) => {
      for (const [k, v] of Object.entries(props) as [string, number][]) rec[k] = from[k] + (v - from[k]) * p;
    }, easing);
  }

  wait(ms: number): Promise<void> {
    return this.run(ms, () => {}, ease.linear);
  }

  /** Completes every running tween immediately (slam stop / skip). */
  finishAll(): void {
    for (const a of [...this.active]) {
      a.update(1);
      this.active.delete(a);
      a.resolve();
    }
  }

  get busy(): boolean {
    return this.active.size > 0;
  }
}
