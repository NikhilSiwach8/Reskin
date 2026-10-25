// Reel grid rendering. The grid only displays boards it is given; it never picks symbols
// for an outcome (random symbols are shown only while a reel is blurred in motion).
import { Container, Graphics, Sprite, Text } from 'pixi.js';
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
  }

  dim(on: boolean): void {
    this.sprite.tint = on ? 0x5a5070 : 0xffffff;
  }

  /** Strong pulsing glow while the symbol is part of a win. */
  highlight(on: boolean): void {
    this.highlighted = on;
    if (!on) this.glow.alpha = 0;
  }

  /** Per-frame idle animation while the reel is at rest. */
  idle(t: number, reduced: boolean): void {
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
  private glow = new Graphics();
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

  /** Starts spinning (all reels or a subset). Returns immediately. */
  start(opts: SpinOptions = {}): void {
    const which = opts.reels ?? [0, 1, 2, 3, 4];
    for (const v of this.allViews()) v.reset();
    for (const i of which) this.reels[i].spinning = true;
    this.speed = opts.turbo ? 0.06 : 0.034;
  }

  /** Called every frame by the stage. */
  update(dt: number): void {
    this.time += dt;
    for (const r of this.reels) {
      if (r.spinning) r.advance(this.speed * dt);
      else for (const v of r.rowViews()) v.idle(this.time, this.reducedMotion);
    }
  }

  /** Stops spinning reels on the given board with a staggered, decelerating landing. */
  async stop(board: Board, opts: SpinOptions & { onReelStop?: (reel: number) => void } = {}): Promise<void> {
    const which = (opts.reels ?? [0, 1, 2, 3, 4]).filter((i) => this.reels[i].spinning);
    const stagger = opts.turbo ? 50 : 140;
    const anticip = new Set(opts.anticipation ?? []);
    let extra = 0;
    const tasks = which.map((i, k) => {
      if (anticip.has(i)) extra += opts.turbo ? 300 : 900;
      const delay = k * stagger + extra;
      return this.stopReel(i, board[i], delay, anticip.has(i), opts.onReelStop);
    });
    await Promise.all(tasks);
    this.board = board.map((c) => [...c]);
  }

  private async stopReel(i: number, col: SymbolId[], delay: number, anticipation: boolean, onStop?: (reel: number) => void): Promise<void> {
    const reel = this.reels[i];
    if (anticipation) this.showAnticipation(i, true);
    await this.tweener.wait(delay);
    reel.spinning = false;
    const target = reel.prepareStop(col);
    const start = reel.pos;
    await this.tweener.run(anticipation ? 700 : 340, (p) => reel.advance(start + (target - start) * p - reel.pos), ease.outCubic);
    reel.snapTo(target);
    if (anticipation) this.showAnticipation(i, false);
    onStop?.(i);
    if (!this.tweener.reducedMotion) {
      for (const v of reel.rowViews()) if (SPECIAL_LAND.includes(v.sym)) void v.land(this.tweener);
      await this.tweener.run(150, (p) => (reel.y = Math.sin(p * Math.PI) * 14), ease.linear);
      reel.y = 0;
    }
  }

  private showAnticipation(reel: number, on: boolean): void {
    this.glow.clear();
    if (on) this.glow.roundRect(reel * CELL + 4, 4, CELL - 8, CELL * ROWS - 8, 18).stroke({ color: 0x7dffa8, width: 8, alpha: 0.85 });
  }

  /** Spectral Respin: every non-held cell drops out and a new symbol drops in, reel by reel. */
  async respinCells(board: Board, held: Cell[], turbo: boolean): Promise<void> {
    const heldSet = new Set(held.map((c) => `${c.reel},${c.row}`));
    for (let reel = 0; reel < REELS; reel++) {
      const views = this.reels[reel].rowViews();
      const moving = views.map((v, row) => ({ v, row })).filter(({ row }) => !heldSet.has(`${reel},${row}`));
      await this.tweener.run(turbo ? 80 : 160, (p) => moving.forEach(({ v }) => { v.alpha = 1 - p; v.scale.set(1 - p * 0.4); }));
      moving.forEach(({ v, row }) => v.set(board[reel][row]));
      await this.tweener.run(turbo ? 120 : 220, (p) => moving.forEach(({ v }) => { v.alpha = p; v.scale.set(0.6 + p * 0.4); }), ease.outBack);
    }
    this.board = board.map((c) => [...c]);
  }

  /** Instantly swaps the symbols of some cells (used by transformations). */
  setCells(cells: Cell[], board: Board): void {
    for (const c of cells) this.view(c).set(board[c.reel][c.row]);
    this.board = board.map((col) => [...col]);
  }
}
