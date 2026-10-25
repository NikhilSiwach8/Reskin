// Visual layers on top of the reels: relic blocks, paylines, particles and feature props.
import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { REELS, ROWS } from '../../engine/config.ts';
import type { Cell, LineWin, RelicBlock } from '../../engine/types.ts';
import { symbolTexture, tex } from '../assets.ts';
import { CELL, type ReelGrid } from './reels.ts';
import { ease, type Tweener } from './tween.ts';
import { glowTexture } from './ambience.ts';

const LINE_COLORS = [0x7dffa8, 0xf5a13a, 0x9d66ff, 0xd8423a, 0xe8e1cf, 0x3ac2ff, 0xffd36a, 0xff6ad5, 0x5ce84a, 0xffa07a, 0xb48cff, 0x40e0d0, 0xffc93a, 0xff4a3a, 0x8cffb5];

const center = (c: Cell) => ({ x: c.reel * CELL + CELL / 2, y: c.row * CELL + CELL / 2 });

const textStyle = (size: number, fill = '#FFF1B0') => ({
  fontFamily: 'Cinzel Decorative, Cinzel, serif',
  fontWeight: '900' as const,
  fontSize: size,
  fill,
  stroke: { color: '#150A20', width: Math.max(4, size / 6) },
  dropShadow: { color: '#000000', blur: 6, distance: 3, alpha: 0.6 },
});

// ---------------------------------------------------------------- relic blocks

interface BlockView {
  root: Container;
  aura: Sprite;
  frame: Graphics;
  art: Sprite;
  label: Text;
  block: RelicBlock;
}

export class RelicLayer extends Container {
  private views = new Map<number, BlockView>();
  private nextLocal = 1;
  private tweener: Tweener;
  private grid: ReelGrid;

  constructor(tweener: Tweener, grid: ReelGrid) {
    super();
    this.tweener = tweener;
    this.grid = grid;
  }

  clear(): void {
    for (const v of this.views.values()) v.root.destroy({ children: true });
    this.views.clear();
    for (const s of this.grid.allViews()) s.visible = true;
  }

  /** Removes block overlays that sit on the given reels (respun reels). */
  clearReels(reels: number[]): void {
    for (const [id, v] of this.views) {
      const b = v.block;
      const covered = Array.from({ length: b.size }, (_, i) => b.reel + i);
      if (covered.some((r) => reels.includes(r))) {
        v.root.destroy({ children: true });
        this.views.delete(id);
      }
    }
    for (const r of reels) for (const s of this.grid.reels[r].rowViews()) s.visible = true;
  }

  private time = 0;

  /** Living aura and multiplier badge pulse on every relic block. */
  update(dt: number): void {
    this.time += dt;
    const t = this.time / 1000;
    for (const v of this.views.values()) {
      v.aura.alpha = 0.35 + Math.sin(t * 3 + v.block.reel) * 0.2;
      v.aura.rotation = t * 0.4;
      const k = 1 + Math.sin(t * 4) * 0.06;
      v.label.scale.set(k);
    }
  }

  private draw(v: BlockView, x: number, y: number, size: number): void {
    const w = size;
    v.aura.position.set(x + w / 2, y + w / 2);
    v.aura.width = v.aura.height = w * 1.5;
    v.frame.clear();
    v.frame.roundRect(x + 4, y + 4, w - 8, w - 8, 18).fill({ color: 0x0b2a1c, alpha: 0.85 });
    v.frame.roundRect(x + 4, y + 4, w - 8, w - 8, 18).stroke({ color: 0x7dffa8, width: 14, alpha: 0.35 });
    v.frame.roundRect(x + 4, y + 4, w - 8, w - 8, 18).stroke({ color: 0xd7a544, width: 6 });
    v.art.x = x + w / 2;
    v.art.y = y + w / 2;
    v.art.width = v.art.height = w * 0.92;
    v.label.x = x + w - 12;
    v.label.y = y + w - 8;
  }

  /** Adds or grows a relic block; animates from its origin cell to the final square. */
  async show(block: RelicBlock, opts: { surge?: boolean; reduced?: boolean; turbo?: boolean } = {}): Promise<void> {
    const key = block.id > 0 ? block.id : -this.nextLocal++;
    const root = new Container();
    const aura = new Sprite(glowTexture());
    aura.anchor.set(0.5);
    aura.tint = 0x7dffa8;
    aura.blendMode = 'add';
    const frame = new Graphics();
    const art = new Sprite(block.size > 1 && tex('relic_block') !== Texture.EMPTY ? tex('relic_block') : symbolTexture('RL'));
    art.anchor.set(0.5);
    const label = new Text({ text: block.mult > 1 ? `x${block.mult}` : '', style: textStyle(block.size > 1 ? 44 : 34) });
    label.anchor.set(1, 1);
    root.addChild(aura, frame, art, label);
    this.addChild(root);
    const v: BlockView = { root, aura, frame, art, label, block };
    // a new block replaces any older overlay it overlaps (absorbed relics)
    for (const [id, other] of this.views) {
      if (overlaps(other.block, block)) {
        other.root.destroy({ children: true });
        this.views.delete(id);
      }
    }
    this.views.set(key, v);
    for (const c of cellsOf(block)) this.grid.view(c).visible = false;

    const from = { x: block.origin.reel * CELL, y: block.origin.row * CELL, s: CELL };
    const to = { x: block.reel * CELL, y: block.row * CELL, s: block.size * CELL };
    if (opts.reduced || block.size === 1) {
      this.draw(v, to.x, to.y, to.s);
      root.alpha = 0;
      await this.tweener.run(opts.turbo ? 80 : 200, (p) => (root.alpha = p));
      return;
    }
    this.draw(v, from.x, from.y, from.s);
    await this.tweener.run(opts.turbo ? 180 : opts.surge ? 650 : 480, (p) => {
      this.draw(v, from.x + (to.x - from.x) * p, from.y + (to.y - from.y) * p, from.s + (to.s - from.s) * p);
    }, ease.outBack);
    this.draw(v, to.x, to.y, to.s);
  }

  /** Pulses the blocks taking part in a win. */
  pulse(cells: Cell[]): void {
    for (const v of this.views.values()) {
      if (cells.some((c) => inside(v.block, c))) {
        const base = v.art.width;
        void this.tweener.run(420, (p) => (v.art.width = v.art.height = base * (1 + Math.sin(p * Math.PI) * 0.08)), ease.linear);
      }
    }
  }
}

function cellsOf(b: RelicBlock): Cell[] {
  const out: Cell[] = [];
  for (let dc = 0; dc < b.size; dc++) for (let dr = 0; dr < b.size; dr++) out.push({ reel: b.reel + dc, row: b.row + dr });
  return out;
}

const inside = (b: RelicBlock, c: Cell) => c.reel >= b.reel && c.reel < b.reel + b.size && c.row >= b.row && c.row < b.row + b.size;
const overlaps = (a: RelicBlock, b: RelicBlock) => cellsOf(a).some((c) => inside(b, c));

// ---------------------------------------------------------------- paylines & wins

type Pt = { x: number; y: number };

/**
 * Path of a line win through exactly the winning symbols, following the payline: the centres of
 * the winning cells, extended a little before the first and after the last symbol.
 */
const winPath = (win: LineWin): Pt[] => {
  const cells = [...win.cells].sort((a, b) => a.reel - b.reel);
  const pts = cells.map(center);
  const ext = CELL * 0.4;
  return [{ x: pts[0].x - ext, y: pts[0].y }, ...pts, { x: pts[pts.length - 1].x + ext, y: pts[pts.length - 1].y }];
};

const pathLength = (pts: Pt[]) => pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

/** Point at fraction t along a polyline, plus the polyline up to that point. */
function along(pts: Pt[], t: number): { head: Pt; path: Pt[] } {
  let left = pathLength(pts) * Math.max(0, Math.min(1, t));
  const path = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (left >= seg) {
      left -= seg;
      path.push(pts[i + 1]);
      continue;
    }
    const k = seg ? left / seg : 0;
    const head = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    path.push(head);
    return { head, path };
  }
  return { head: pts[pts.length - 1], path };
}

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export interface WinPresentOptions {
  turbo: boolean;
  relics: RelicLayer;
  particles?: Particles;
  reduced?: boolean;
}

interface DrawnLine {
  win: LineWin;
  pts: Pt[];
  /** 0..1 portion drawn. */
  t: number;
  alpha: number;
}

/**
 * Line pays: a bright line draws across the winning symbols, following the exact payline path.
 * Each symbol lights up as the line reaches it, then the line win appears at the end of the line.
 * Several winning lines are shown one after another, then together.
 */
export class WinLayer extends Container {
  private frames = new Container();
  private lines = new Graphics();
  private heads = new Container();
  private labels = new Container();
  private drawn: DrawnLine[] = [];
  private tweener: Tweener;
  private grid: ReelGrid;
  private token = 0;

  constructor(tweener: Tweener, grid: ReelGrid) {
    super();
    this.tweener = tweener;
    this.grid = grid;
    this.addChild(this.frames, this.lines, this.heads, this.labels);
  }

  /** True while a win is on screen. */
  get hasContent(): boolean {
    return this.frames.children.length > 0 || this.drawn.length > 0;
  }

  clear(): void {
    this.token++;
    this.drawn = [];
    this.lines.clear();
    for (const layer of [this.frames, this.heads, this.labels]) layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const v of this.grid.allViews()) {
      v.dim(false);
      v.highlight(false);
      v.scale.set(1);
    }
  }

  /** Redraws every line at its current progress and opacity. */
  private redraw(): void {
    this.lines.clear();
    for (const d of this.drawn) {
      if (d.alpha <= 0 || d.t <= 0) continue;
      const { path } = along(d.pts, d.t);
      const color = LINE_COLORS[(d.win.line - 1) % LINE_COLORS.length];
      const stroke = (width: number, c: number, alpha: number) => {
        this.lines.moveTo(path[0].x, path[0].y);
        for (const p of path.slice(1)) this.lines.lineTo(p.x, p.y);
        this.lines.stroke({ color: c, width, alpha: alpha * d.alpha, join: 'round', cap: 'round' });
      };
      stroke(22, color, 0.18); // soft outer glow
      stroke(11, 0x150a20, 0.55); // dark edge keeps the line readable on any symbol
      stroke(7, color, 1); // colour
      stroke(2.5, 0xffffff, 0.95); // bright core
    }
  }

  /** A glowing frame behind a winning cell. */
  private frameCell(c: Cell, color: number): void {
    const key = `${c.reel},${c.row}`;
    if (this.frames.children.some((f) => f.label === key)) return;
    const root = new Container();
    root.label = key;
    const p = center(c);
    root.position.set(p.x, p.y);
    const glow = new Sprite(glowTexture());
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.tint = color;
    glow.alpha = 0.5;
    glow.width = glow.height = CELL * 1.35;
    const f = new Graphics()
      .roundRect(-CELL / 2 + 6, -CELL / 2 + 6, CELL - 12, CELL - 12, 18).fill({ color: 0x150a20, alpha: 0.3 })
      .roundRect(-CELL / 2 + 6, -CELL / 2 + 6, CELL - 12, CELL - 12, 18).stroke({ color: 0xffd36a, width: 3.5 });
    root.addChild(glow, f);
    root.scale.set(0.8);
    root.alpha = 0;
    this.frames.addChildAt(root, 0);
    void this.tweener.run(280, (q) => { if (root.destroyed) return; root.alpha = q; root.scale.set(0.8 + q * 0.2); }, ease.outBack);
  }

  /** Soft symbol pop as the line reaches it. */
  private pop(cell: Cell, size = 0.12): Promise<void> {
    const v = this.grid.view(cell);
    return this.tweener.run(380, (q) => v.scale.set(1 + Math.sin(q * Math.PI) * size), easeInOutSine);
  }

  /**
   * Draws one or more lines from left to right. Each winning symbol lights up (frame, pop, sparks)
   * at the moment the line's head reaches it.
   */
  private async draw(wins: LineWin[], ms: number, opts: WinPresentOptions, token: number): Promise<void> {
    const items = wins.map((win) => {
      const d: DrawnLine = { win, pts: winPath(win), t: 0, alpha: 1 };
      this.drawn.push(d);
      const head = new Sprite(glowTexture());
      head.anchor.set(0.5);
      head.blendMode = 'add';
      head.width = head.height = 56;
      this.heads.addChild(head);
      // fraction of the path at which each winning symbol is reached
      const total = pathLength(d.pts);
      const marks = [...win.cells].sort((a, b) => a.reel - b.reel).map((c, i) => ({ c, at: pathLength(d.pts.slice(0, i + 2)) / total, done: false }));
      return { d, head, marks, color: LINE_COLORS[(win.line - 1) % LINE_COLORS.length] };
    });
    await this.tweener.run(ms, (p) => {
      if (token !== this.token) return;
      for (const it of items) {
        it.d.t = p;
        const { head } = along(it.d.pts, p);
        if (!it.head.destroyed) {
          it.head.position.set(head.x, head.y);
          it.head.alpha = p < 0.85 ? 1 : (1 - p) / 0.15;
        }
        for (const m of it.marks) {
          if (m.done || p < m.at) continue;
          m.done = true;
          this.frameCell(m.c, it.color);
          void this.pop(m.c);
          if (opts.particles && !opts.reduced) {
            const cp = center(m.c);
            opts.particles.burst(cp.x, cp.y, opts.turbo ? 2 : 5, tex('fx_spark'), { speed: 0.3, scale: 0.26, life: 520 });
          }
        }
      }
      this.redraw();
    }, easeInOutSine);
    items.forEach((it) => it.head.destroyed || it.head.destroy());
  }

  /** Fades the given lines (and labels) to a target opacity. */
  private fadeLines(lines: DrawnLine[], to: number, ms: number, token: number): Promise<void> {
    const from = lines.map((d) => d.alpha);
    const labels = [...this.labels.children];
    return this.tweener.run(ms, (q) => {
      if (token !== this.token) return;
      lines.forEach((d, i) => (d.alpha = from[i] + (to - from[i]) * q));
      for (const l of labels) if (!l.destroyed) l.alpha = 1 - q;
      this.redraw();
    }, ease.inOutQuad);
  }

  async present(wins: LineWin[], formatWin: (centi: number) => string, opts: WinPresentOptions): Promise<void> {
    if (!wins.length) return;
    this.clear();
    const token = this.token;
    const winning = new Set(wins.flatMap((w) => w.cells.map((c) => `${c.reel},${c.row}`)));
    for (let reel = 0; reel < REELS; reel++) {
      for (let row = 0; row < ROWS; row++) {
        const on = winning.has(`${reel},${row}`);
        this.grid.view({ reel, row }).dim(!on);
        this.grid.view({ reel, row }).highlight(on);
      }
    }
    opts.relics.pulse(wins.flatMap((w) => w.cells));

    if (opts.turbo) {
      // turbo: every line draws at once
      await this.draw(wins, 300, opts, token);
      if (token !== this.token) return;
      if (wins.length === 1) this.lineLabel(wins[0], formatWin);
      await this.tweener.wait(220);
      return;
    }

    // one line at a time: draw, show its win, then fade it back so the next one reads clearly
    const solo = wins.slice(0, 6);
    for (const [i, w] of solo.entries()) {
      if (token !== this.token) return;
      await this.draw([w], 520, opts, token);
      if (token !== this.token) return;
      this.lineLabel(w, formatWin);
      await this.tweener.wait(wins.length === 1 ? 700 : 420);
      if (wins.length > 1 && i < solo.length - 1) await this.fadeLines(this.drawn, 0.22, 220, token);
    }
    // remaining lines (if many) draw together
    const rest = wins.slice(6);
    if (rest.length && token === this.token) {
      await this.fadeLines(this.drawn, 0.22, 200, token);
      await this.draw(rest, 520, opts, token);
    }
    // finish with every winning line visible together
    if (wins.length > 1 && token === this.token) {
      const fromAlpha = this.drawn.map((d) => d.alpha);
      await this.tweener.run(260, (q) => {
        if (token !== this.token) return;
        this.drawn.forEach((d, k) => (d.alpha = fromAlpha[k] + (0.75 - fromAlpha[k]) * q));
        this.redraw();
      }, ease.inOutQuad);
    }
  }

  /** Line win amount on a dark plate with a gold rim, at the end of the line. */
  private lineLabel(w: LineWin, formatWin: (centi: number) => string): void {
    this.labels.removeChildren().forEach((c) => c.destroy({ children: true }));
    const cells = [...w.cells].sort((a, b) => a.reel - b.reel);
    const p = center(cells[cells.length - 1]);
    const root = new Container();
    const t = new Text({ text: formatWin(w.win), style: textStyle(32) });
    t.anchor.set(0.5);
    const pw = t.width + 40;
    const ph = t.height + 14;
    const plate = new Graphics()
      .roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill({ color: 0x150a20, alpha: 0.9 })
      .roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).stroke({ color: 0xffd36a, width: 3 })
      .roundRect(-pw / 2 + 5, -ph / 2 + 5, pw - 10, ph - 10, (ph - 10) / 2).stroke({ color: LINE_COLORS[(w.line - 1) % LINE_COLORS.length], width: 1.5, alpha: 0.8 });
    root.addChild(plate, t);
    // keep the plate inside the board, just below the last winning symbol
    const half = pw / 2 + 6;
    root.position.set(Math.max(half, Math.min(CELL * REELS - half, p.x)), Math.max(ph, Math.min(CELL * ROWS - ph, p.y + CELL * 0.34)));
    root.scale.set(0.6);
    root.alpha = 0;
    this.labels.addChild(root);
    void this.tweener.run(300, (q) => { if (root.destroyed) return; root.scale.set(0.6 + q * 0.4); root.alpha = Math.min(1, q * 2); }, ease.outBack);
  }
}

// ---------------------------------------------------------------- particles

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  max: number;
  gravity: number;
}

export class Particles extends Container {
  private pool: Sprite[] = [];
  private live: Particle[] = [];
  private readonly cap = 260;
  enabled = true;

  burst(x: number, y: number, n: number, texture: Texture, opts: { speed?: number; gravity?: number; scale?: number; life?: number } = {}): void {
    if (!this.enabled) return;
    for (let i = 0; i < n && this.live.length < this.cap; i++) {
      const s = this.pool.pop() ?? new Sprite();
      s.texture = texture;
      s.anchor.set(0.5);
      s.x = x;
      s.y = y;
      s.alpha = 1;
      s.blendMode = texture === tex('fx_coin') ? 'normal' : 'add';
      const sc = (opts.scale ?? 0.5) * (0.6 + Math.random() * 0.8);
      s.scale.set(sc);
      this.addChild(s);
      const a = Math.random() * Math.PI * 2;
      const v = (opts.speed ?? 0.5) * (0.4 + Math.random());
      const max = (opts.life ?? 900) * (0.7 + Math.random() * 0.6);
      this.live.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.gravity ? 0.6 : 0), vr: (Math.random() - 0.5) * 0.01, life: 0, max, gravity: opts.gravity ?? 0 });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      p.vy += p.gravity * dt * 0.002;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.rotation += p.vr * dt;
      p.s.alpha = 1 - p.life / p.max;
      if (p.life >= p.max) {
        this.removeChild(p.s);
        this.pool.push(p.s);
        this.live.splice(i, 1);
      }
    }
  }
}

// ---------------------------------------------------------------- feature props

export class Props extends Container {
  private chains = new Map<number, Container>();
  private tweener: Tweener;
  private particles: Particles;
  readonly portal = new Sprite(tex('fx_portal'));
  readonly phantom = new Sprite(tex('fx_phantom'));
  readonly clock = new Container();
  private clockHand = new Sprite(tex('fx_clock_hand'));
  readonly door = new Sprite(tex('fx_vault_door'));
  private ring = new Graphics();
  private marks = new Graphics();

  constructor(tweener: Tweener, particles: Particles) {
    super();
    this.tweener = tweener;
    this.particles = particles;
    for (const s of [this.portal, this.phantom, this.door]) {
      s.anchor.set(0.5);
      s.visible = false;
    }
    const face = new Sprite(tex('fx_clock_face'));
    face.anchor.set(0.5);
    this.clockHand.anchor.set(0.5, 448 / 512);
    this.clock.addChild(face, this.clockHand);
    this.clock.visible = false;
    this.addChild(this.marks, this.ring, this.portal, this.phantom, this.clock, this.door);
  }

  // ----- Lockdown chains
  lockReel(reel: number): void {
    if (this.chains.has(reel)) return;
    const c = new Container();
    const h = CELL * ROWS;
    for (const dir of [-1, 1]) {
      const chain = new TilingSprite({ texture: tex('fx_chain'), width: Math.hypot(CELL, h) + 40, height: 30 });
      chain.anchor.set(0.5);
      chain.tileScale.set(0.31);
      chain.alpha = 0.85;
      chain.x = reel * CELL + CELL / 2;
      chain.y = h / 2;
      chain.rotation = dir * Math.atan2(h, CELL);
      c.addChild(chain);
    }
    const lock = new Sprite(tex('fx_lock'));
    lock.anchor.set(0.5);
    lock.width = lock.height = CELL * 0.5;
    lock.x = reel * CELL + CELL / 2;
    lock.y = h / 2;
    c.addChild(lock);
    c.alpha = 0;
    this.addChildAt(c, 0);
    this.chains.set(reel, c);
    void this.tweener.run(260, (p) => {
      c.alpha = p;
      lock.scale.set((CELL * 0.5 / 256) * (1.6 - 0.6 * p));
    }, ease.outBack);
  }

  async breakChains(): Promise<void> {
    for (const [reel, c] of this.chains) {
      this.particles.burst(reel * CELL + CELL / 2, (CELL * ROWS) / 2, 14, tex('fx_spark'), { speed: 0.6, scale: 0.35 });
      void this.tweener.run(360, (p) => {
        c.alpha = 1 - p;
        c.scale.set(1 + p * 0.05);
      }).then(() => c.destroy({ children: true }));
    }
    this.chains.clear();
    await this.tweener.wait(380);
  }

  clearChains(): void {
    for (const c of this.chains.values()) c.destroy({ children: true });
    this.chains.clear();
  }

  // ----- Phantom Heist
  async phantomSweep(cells: Cell[], turbo: boolean): Promise<void> {
    const w = CELL * REELS;
    this.portal.visible = this.phantom.visible = true;
    this.portal.x = w + 40;
    this.portal.y = CELL * 1.2;
    this.portal.width = this.portal.height = CELL * 1.6;
    this.phantom.width = CELL * 1.6;
    this.phantom.height = CELL * 2;
    this.phantom.x = this.portal.x;
    this.phantom.y = this.portal.y;
    this.phantom.alpha = 0;
    await this.tweener.run(turbo ? 150 : 380, (p) => {
      this.portal.rotation = p * 2;
      this.portal.alpha = p;
      this.phantom.alpha = p;
    });
    this.marks.clear();
    for (const c of cells) this.marks.roundRect(c.reel * CELL + 8, c.row * CELL + 8, CELL - 16, CELL - 16, 16).stroke({ color: 0x7dffa8, width: 6, alpha: 0.9 });
    const path = [...cells].sort((a, b) => a.reel - b.reel || a.row - b.row).map(center);
    for (const pt of path) {
      const sx = this.phantom.x, sy = this.phantom.y;
      await this.tweener.run(turbo ? 60 : 150, (p) => {
        this.phantom.x = sx + (pt.x - sx) * p;
        this.phantom.y = sy + (pt.y - sy) * p;
        this.portal.rotation += 0.05;
      }, ease.inOutQuad);
      this.particles.burst(pt.x, pt.y, 6, tex('fx_wisp'), { speed: 0.15, scale: 0.6, life: 700 });
    }
  }

  async phantomExit(turbo: boolean): Promise<void> {
    this.marks.clear();
    const sx = this.phantom.x, sy = this.phantom.y;
    await this.tweener.run(turbo ? 150 : 360, (p) => {
      this.phantom.x = sx + (this.portal.x - sx) * p;
      this.phantom.y = sy + (this.portal.y - sy) * p;
      this.phantom.alpha = 1 - p;
      this.portal.alpha = 1 - p;
    });
    this.portal.visible = this.phantom.visible = false;
  }

  // ----- Thirteenth Hour clock
  showClock(hour: number, x: number, y: number, size: number): void {
    this.clock.visible = true;
    this.clock.x = x;
    this.clock.y = y;
    this.clock.scale.set(size / 768);
    this.clockHand.rotation = handAngle(hour);
  }

  async advanceClock(hour: number): Promise<void> {
    const from = this.clockHand.rotation;
    const to = handAngle(hour);
    await this.tweener.run(420, (p) => (this.clockHand.rotation = from + (to - from) * p), ease.outElastic);
  }

  async strikeClock(reduced: boolean): Promise<void> {
    const s = this.clock.scale.x;
    this.particles.burst(this.clock.x, this.clock.y, 30, tex('fx_spark'), { speed: 0.7, scale: 0.4 });
    if (!reduced) await this.tweener.run(520, (p) => this.clock.scale.set(s * (1 + Math.sin(p * Math.PI) * 0.35)), ease.linear);
    this.shockwave(this.clock.x, this.clock.y, 0xf5a13a);
  }

  hideClock(): void {
    this.clock.visible = false;
  }

  // ----- Vault door
  /** The painted vault door covers the grid, rattles, then swings open on its left hinge. */
  async openVault(reduced: boolean): Promise<void> {
    const w = CELL * REELS;
    const h = CELL * ROWS;
    const size = w * 1.06;
    this.door.visible = true;
    this.door.anchor.set(0, 0.5);
    this.door.x = (w - size) / 2;
    this.door.y = h / 2;
    this.door.width = this.door.height = size;
    const base = this.door.scale.x;
    this.door.alpha = 1;
    this.door.rotation = 0;
    this.door.tint = 0xffffff;
    if (reduced) {
      await this.tweener.wait(300);
      await this.tweener.run(500, (p) => (this.door.alpha = 1 - p));
    } else {
      await this.tweener.run(500, (p) => (this.door.rotation = Math.sin(p * Math.PI * 6) * 0.015 * (1 - p)), ease.linear);
      this.particles.burst(w / 2, h / 2, 24, tex('fx_spark'), { speed: 0.5, scale: 0.4 });
      await this.tweener.run(800, (p) => {
        this.door.scale.x = base * (1 - p);
        this.door.tint = Math.round(255 - 120 * p) * 0x10101;
      }, ease.inCubic);
    }
    this.door.visible = false;
    this.door.scale.x = base;
    this.particles.burst(w / 2, h / 2, 40, tex('fx_coin'), { speed: 0.8, gravity: 1, scale: 0.4, life: 1400 });
  }

  /** Expanding ring used for level-ups, strikes and the Relic Overload shockwave. */
  shockwave(x: number, y: number, color: number): void {
    const g = new Graphics();
    this.addChild(g);
    void this.tweener.run(600, (p) => {
      g.clear();
      g.circle(x, y, 40 + p * 420).stroke({ color, width: 18 * (1 - p), alpha: 1 - p });
    }, ease.outQuad).then(() => g.destroy());
  }
}

/** Hour IX..XIII mapped onto a 13-hour dial (XIII at the top). */
function handAngle(hour: number): number {
  return ((hour % 13) / 13) * Math.PI * 2;
}
