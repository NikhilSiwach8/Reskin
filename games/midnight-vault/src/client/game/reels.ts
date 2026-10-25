// Reel grid rendering. The grid only displays boards it is given; it never picks symbols
// for an outcome (random symbols are shown only while a reel is blurred in motion).
import { BlurFilter, Container, Graphics, Sprite, Text } from 'pixi.js';
import { REELS, ROWS, SYMBOL_ORDER, SYMBOLS } from '../../engine/config.ts';
import type { Board, Cell, SymbolId } from '../../engine/types.ts';
import { isMissing, symbolTexture } from '../assets.ts';
import { ease, type Tweener } from './tween.ts';

export const CELL = 150;
const SYMBOL_SIZE = CELL * 0.92;
const FILLER: SymbolId[] = SYMBOL_ORDER.filter((s) => s !== 'VK');
const SPECIAL_LAND: SymbolId[] = ['RL', 'VK', 'VD', 'PH', 'CL', 'EL'];

/** Idle motion style per symbol (presentation only). */
type Idle = 'pulse' | 'sway' | 'float' | 'tick' | 'bob' | 'breathe' | 'none';
const IDLE: Record<SymbolId, Idle> = {
  RL: 'pulse', VK: 'sway', PH: 'float', CL: 'tick', VD: 'pulse', EL: 'bob',
  LG: 'breathe', TC: 'breathe', GB: 'breathe', A: 'none', K: 'none', Q: 'none', J: 'none', T: 'none',
};
const GLOW_COLOR: Partial<Record<SymbolId, number>> = {
  RL: 0x7dffa8, VK: 0x7dffa8, VD: 0xd7a544, PH: 0x9d66ff, CL: 0xb48cff, EL: 0x7dffa8, LG: 0xd7a544, TC: 0xf5a13a, GB: 0xf5a13a,
};

export class SymbolView extends Container {
  sym: SymbolId = 'A';
  private sprite = new Sprite();
  private glow = new Sprite();
  private fallback?: Text;
  private phase = Math.random() * Math.PI * 2;
  private highlighted = false;

  constructor() {
    super();
    this.sprite.anchor.set(0.5);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.alpha = 0;
    this.addChild(this.glow, this.sprite);
  }

  set(sym: SymbolId): void {
    this.sym = sym;
    this.sprite.texture = symbolTexture(sym);
    this.glow.texture = this.sprite.texture;
    this.glow.tint = GLOW_COLOR[sym] ?? 0xffffff;
    this.sprite.width = this.sprite.height = SYMBOL_SIZE;
    this.glow.width = this.glow.height = SYMBOL_SIZE * 1.06;
    this.sprite.rotation = 0;
    this.sprite.y = 0;
    if (isMissing('symbols')) {
      // Missing-asset fallback: keep the game readable with a text label.
      this.fallback ??= this.addChild(new Text({ text: '', style: { fill: '#E8E1CF', fontSize: 34, fontWeight: '700', align: 'center' } }));
      this.fallback.anchor.set(0.5);
      this.fallback.text = SYMBOLS[sym].name;
    }
  }

  reset(): void {
    this.scale.set(1);
    this.alpha = 1;
    this.rotation = 0;
    this.sprite.tint = 0xffffff;
    this.sprite.rotation = 0;
    this.sprite.y = 0;
    this.sprite.width = this.sprite.height = SYMBOL_SIZE;
    this.highlighted = false;
    this.glow.alpha = 0;
    this.dimTarget = 0;
    this.applyDim(0);
  }

  /** Darkens symbols that are not part of a win (eased per frame in idle()). */
  private dimTarget = 0;
  private dimLevel = 0;
  dim(on: boolean): void {
    this.dimTarget = on ? 1 : 0;
    if (!on) this.applyDim(0);
  }

  private applyDim(level: number): void {
    this.dimLevel = level;
    const c = Math.round(255 - level * (255 - 0x55));
    this.sprite.tint = (c << 16) | (c << 8) | Math.min(255, c + Math.round(level * 24));
  }

  /** Strong pulsing glow while the symbol is part of a win. */
  highlight(on: boolean): void {
    this.highlighted = on;
    if (!on) this.glow.alpha = 0;
  }

  /** Per-frame idle animation while the reel is at rest. */
  idle(t: number, reduced: boolean, dt = 16): void {
    if (this.dimLevel !== this.dimTarget) {
      const step = dt / 220;
      this.applyDim(this.dimTarget > this.dimLevel ? Math.min(this.dimTarget, this.dimLevel + step) : Math.max(this.dimTarget, this.dimLevel - step));
    }
    const k = t / 1000 + this.phase;
    const base = SYMBOL_SIZE;
    if (this.highlighted) {
      this.glow.alpha = 0.45 + Math.sin(k * 7) * 0.25;
      return;
    }
    if (reduced) {
      this.glow.alpha = 0;
      return;
    }
    switch (IDLE[this.sym]) {
      case 'pulse':
        this.sprite.width = this.sprite.height = base * (1 + Math.sin(k * 2.4) * 0.03);
        this.glow.alpha = 0.18 + Math.sin(k * 2.4) * 0.14;
        break;
      case 'sway':
        this.sprite.rotation = Math.sin(k * 1.8) * 0.06;
        this.glow.alpha = 0.12 + Math.sin(k * 3) * 0.08;
        break;
      case 'float':
        this.sprite.y = Math.sin(k * 1.6) * 4;
        this.glow.alpha = 0.1 + Math.sin(k * 1.6) * 0.08;
        break;
      case 'tick': {
        // a small jolt once per second, like a ticking hand
        const f = (t / 1000 + this.phase) % 1;
        this.sprite.rotation = f < 0.08 ? Math.sin((f / 0.08) * Math.PI) * 0.05 : 0;
        this.glow.alpha = 0.08 + (f < 0.1 ? 0.15 : 0);
        break;
      }
      case 'bob':
        this.sprite.y = Math.sin(k * 2) * 3;
        this.sprite.rotation = Math.sin(k * 2 + 1) * 0.03;
        this.glow.alpha = 0.12 + Math.sin(k * 2) * 0.1;
        break;
      case 'breathe':
        this.sprite.width = this.sprite.height = base * (1 + Math.sin(k * 1.4) * 0.015);
        this.glow.alpha = 0;
        break;
      default:
        this.glow.alpha = 0;
    }
  }

  /** Squash-and-stretch landing for special symbols. */
  land(tweener: Tweener): Promise<void> {
    return tweener.run(320, (p) => {
      const sq = Math.sin(p * Math.PI) * (1 - p);
      this.sprite.width = SYMBOL_SIZE * (1 + sq * 0.25);
      this.sprite.height = SYMBOL_SIZE * (1 - sq * 0.18);
      this.glow.alpha = (1 - p) * 0.6;
    }, ease.linear);
  }
}

class Reel extends Container {
  /** cells[0] is the hidden cell above the window, cells[1..5] are visible, cells[6] below. */
  cells: SymbolView[] = [];
  pos = 0;
  spinning = false;
  /** Current speed in cells per ms (presentation only). */
  vel = 0;
  /** Speed the reel is easing towards while it spins freely. */
  targetVel = 0;
  private blur = new BlurFilter({ strength: 0, quality: 2 });
  private queue: SymbolId[] = [];
  private lastBase = 0;

  constructor() {
    super();
    for (let i = 0; i < ROWS + 2; i++) {
      const v = new SymbolView();
      v.set(randomFiller());
      this.cells.push(v);
      this.addChild(v);
    }
    this.layout();
  }

  setSymbols(col: SymbolId[]): void {
    col.forEach((s, r) => this.cells[r + 1].set(s));
    this.layout();
  }

  /** Visible symbol views in row order. */
  rowViews(): SymbolView[] {
    return this.cells.slice(1, ROWS + 1);
  }

  /** Vertical motion blur proportional to speed; removed entirely at rest so symbols stay crisp. */
  setBlur(enabled: boolean): void {
    const strength = enabled ? Math.min(14, this.vel * 260) : 0;
    if (strength < 0.6) {
      if (this.filters) this.filters = null;
      return;
    }
    this.blur.strengthX = 0;
    this.blur.strengthY = strength;
    if (!this.filters) this.filters = [this.blur];
  }

  advance(delta: number): void {
    this.pos += delta;
    const base = Math.floor(this.pos);
    while (this.lastBase < base) {
      this.lastBase++;
      const bottom = this.cells.pop()!;
      bottom.reset();
      bottom.set(this.queue.length ? this.queue.shift()! : randomFiller());
      this.cells.unshift(bottom);
    }
    this.layout();
  }

  layout(): void {
    const frac = this.pos - Math.floor(this.pos);
    this.cells.forEach((c, k) => {
      c.x = CELL / 2;
      c.y = (k - 1 + frac) * CELL + CELL / 2;
    });
  }

  /** Queue the final column so that it lands exactly in rows 0..4 after 6 more steps. */
  prepareStop(col: SymbolId[]): number {
    this.queue = [col[4], col[3], col[2], col[1], col[0], randomFiller()];
    return Math.floor(this.pos) + 6;
  }

  snapTo(target: number): void {
    this.advance(target - this.pos);
    this.pos = Math.round(this.pos);
    this.lastBase = this.pos;
    this.queue = [];
    this.layout();
  }
}

/**
 * Deceleration curve from 0 to 1 that leaves with slope `v0` (so the reel keeps its current
 * speed at the start of the stop, without a jolt) and arrives with slope 0. Monotonic for v0 <= 3.
 */
function stopCurve(v0: number): (t: number) => number {
  const a = v0 - 3; // 1 - (1-t)^3 has slope 3 at t=0; the extra term corrects it to v0
  return (t) => 1 - (1 - t) ** 3 + a * t * (1 - t) ** 2;
}

function randomFiller(): SymbolId {
  // Presentation-only blur symbols while a reel is moving.
  return FILLER[Math.floor(Math.random() * FILLER.length)];
}

export interface SpinOptions {
  reels?: number[];
  anticipation?: number[];
  turbo?: boolean;
}

export class ReelGrid extends Container {
  readonly reels: Reel[] = [];
  private tweener: Tweener;
  private speed = 0;
  private turbo = false;
  private glow = new Graphics();
  private glowTime = 0;
  private anticipating = new Set<number>();
  private time = 0;
  reducedMotion = false;
  board: Board;

  constructor(tweener: Tweener, initial: Board) {
    super();
    this.tweener = tweener;
    const mask = new Graphics().rect(0, 0, CELL * REELS, CELL * ROWS).fill(0xffffff);
    const holder = new Container();
    holder.mask = mask;
    this.addChild(holder, mask, this.glow);
    for (let i = 0; i < REELS; i++) {
      const r = new Reel();
      r.x = i * CELL;
      holder.addChild(r);
      this.reels.push(r);
    }
    this.board = initial;
    this.showBoard(initial);
  }

  showBoard(board: Board): void {
    this.board = board.map((c) => [...c]);
    board.forEach((col, i) => this.reels[i].setSymbols(col));
  }

  view(c: Cell): SymbolView {
    return this.reels[c.reel].rowViews()[c.row];
  }

  allViews(): SymbolView[] {
    return this.reels.flatMap((r) => r.rowViews());
  }

  /** Starts spinning (all reels or a subset): staggered, with a short wind-up and acceleration. */
  start(opts: SpinOptions = {}): void {
    const which = opts.reels ?? [0, 1, 2, 3, 4];
    for (const v of this.allViews()) v.reset();
    this.turbo = !!opts.turbo;
    this.speed = opts.turbo ? 0.06 : 0.036;
    which.forEach((i, k) => {
      const reel = this.reels[i];
      reel.spinning = true;
      reel.vel = 0;
      reel.targetVel = 0;
      const delay = this.tweener.reducedMotion ? 0 : k * (opts.turbo ? 25 : 55);
      void (async () => {
        await this.tweener.wait(delay);
        if (!reel.spinning) return;
        // wind-up: the reel lifts a little before it starts to fall
        if (!this.tweener.reducedMotion) await this.tweener.run(opts.turbo ? 60 : 110, (p) => (reel.y = -Math.sin(p * Math.PI * 0.5) * 16), ease.outQuad);
        if (!reel.spinning) return;
        reel.targetVel = this.speed;
        await this.tweener.run(opts.turbo ? 60 : 110, (p) => (reel.y = -16 * (1 - p)), ease.inQuad);
        reel.y = 0;
      })();
    });
  }

  /** Called every frame by the stage. */
  update(dt: number): void {
    this.time += dt;
    this.glowTime += dt;
    for (const r of this.reels) {
      if (r.spinning) {
        // ease the speed towards its target (acceleration, or the anticipation slow-down)
        r.vel += (r.targetVel - r.vel) * Math.min(1, dt / (r.targetVel > r.vel ? 140 : 260));
        r.advance(r.vel * dt);
      } else for (const v of r.rowViews()) v.idle(this.time, this.reducedMotion, dt);
      r.setBlur(!this.reducedMotion);
    }
    if (this.anticipating.size) this.drawAnticipation();
  }

  /** Stops spinning reels on the given board with a staggered, decelerating landing. */
  async stop(board: Board, opts: SpinOptions & { onReelStop?: (reel: number) => void } = {}): Promise<void> {
    const which = (opts.reels ?? [0, 1, 2, 3, 4]).filter((i) => this.reels[i].spinning);
    const stagger = opts.turbo ? 60 : 160;
    const anticip = new Set(opts.anticipation ?? []);
    let extra = 0;
    const tasks = which.map((i, k) => {
      if (anticip.has(i)) extra += opts.turbo ? 350 : 1100;
      const delay = k * stagger + extra;
      return this.stopReel(i, board[i], delay, anticip.has(i), opts.onReelStop);
    });
    await Promise.all(tasks);
    this.board = board.map((c) => [...c]);
  }

  private async stopReel(i: number, col: SymbolId[], delay: number, anticipation: boolean, onStop?: (reel: number) => void): Promise<void> {
    const reel = this.reels[i];
    if (anticipation) {
      // suspense: the reel glows and slows to a crawl before it lands
      this.anticipating.add(i);
      void this.tweener.wait(Math.max(0, delay - 700)).then(() => { if (reel.spinning) reel.targetVel = this.speed * 0.4; });
    }
    await this.tweener.wait(delay);
    // make sure the reel is at speed (a very quick stop can arrive during the wind-up)
    if (reel.vel < this.speed * 0.3) reel.vel = this.speed * (anticipation ? 0.4 : 1);
    reel.spinning = false;
    // land 6 cells on (more for anticipation, so the deceleration is long and readable)
    const target = reel.prepareStop(col);
    const start = reel.pos;
    // overshoot past the final row a little, then settle back (never moves back past the target)
    const over = this.tweener.reducedMotion ? 0 : 0.14;
    const dist = target + over - start;
    // duration chosen so the curve leaves at the reel's current speed: v0 * dist / ms = vel
    const v0 = 2.6;
    const ms = Math.max(this.turbo ? 160 : 260, Math.min(this.turbo ? 420 : 900, (v0 * dist) / Math.max(0.005, reel.vel)));
    const curve = stopCurve(v0);
    const startVel = reel.vel;
    await this.tweener.run(ms, (p) => {
      reel.advance(start + dist * curve(p) - reel.pos);
      reel.vel = startVel * (1 - p) ** 2;
    }, ease.linear);
    if (over) {
      const top = reel.pos;
      await this.tweener.run(this.turbo ? 90 : 170, (p) => reel.advance(Math.max(target, top - (top - target) * p) - reel.pos), ease.inOutQuad);
    }
    reel.vel = 0;
    reel.y = 0;
    reel.snapTo(target);
    reel.setBlur(false);
    if (anticipation) {
      this.anticipating.delete(i);
      this.glow.clear();
    }
    onStop?.(i);
    if (!this.tweener.reducedMotion) for (const v of reel.rowViews()) if (SPECIAL_LAND.includes(v.sym)) void v.land(this.tweener);
  }

  /** Pulsing green frame around reels that may complete a feature. */
  private drawAnticipation(): void {
    this.glow.clear();
    const pulse = 0.55 + Math.sin(this.glowTime / 110) * 0.3;
    for (const reel of this.anticipating) {
      this.glow.roundRect(reel * CELL + 4, 4, CELL - 8, CELL * ROWS - 8, 18).stroke({ color: 0x7dffa8, width: 14, alpha: pulse * 0.35 });
      this.glow.roundRect(reel * CELL + 4, 4, CELL - 8, CELL * ROWS - 8, 18).stroke({ color: 0xc8ffd9, width: 5, alpha: pulse });
    }
  }

  /** Spectral Respin: every non-held cell drops out and a new symbol drops in, reel by reel. */
  async respinCells(board: Board, held: Cell[], turbo: boolean): Promise<void> {
    const heldSet = new Set(held.map((c) => `${c.reel},${c.row}`));
    for (let reel = 0; reel < REELS; reel++) {
      const views = this.reels[reel].rowViews();
      const moving = views.map((v, row) => ({ v, row })).filter(({ row }) => !heldSet.has(`${reel},${row}`));
      const homes = moving.map(({ v }) => v.y);
      // old symbols fall away, new ones drop in from above and land with a soft bounce
      await this.tweener.run(turbo ? 90 : 170, (p) => moving.forEach(({ v }, k) => { v.alpha = 1 - p; v.y = homes[k] + p * CELL * 0.5; }), ease.inQuad);
      moving.forEach(({ v, row }) => v.set(board[reel][row]));
      await this.tweener.run(turbo ? 140 : 260, (p) => moving.forEach(({ v }, k) => { v.alpha = Math.min(1, p * 2); v.y = homes[k] - (1 - p) * CELL * 0.6; }), ease.outBack);
      moving.forEach(({ v }, k) => { v.y = homes[k]; v.alpha = 1; });
    }
    this.board = board.map((c) => [...c]);
  }

  /** Instantly swaps the symbols of some cells (used by transformations). */
  setCells(cells: Cell[], board: Board): void {
    for (const c of cells) this.view(c).set(board[c.reel][c.row]);
    this.board = board.map((col) => [...col]);
  }
}
