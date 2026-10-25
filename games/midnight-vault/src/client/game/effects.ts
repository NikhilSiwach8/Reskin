// Visual layers on top of the reels: relic blocks, paylines, particles and feature props.
import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { PAYLINES, REELS, ROWS } from '../../engine/config.ts';
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

/** Points of a payline from the left edge of reel 1 to the right edge of reel 5. */
const linePoints = (win: LineWin): Pt[] => {
  const pts = PAYLINES[win.line - 1].map((row, reel) => center({ reel, row }));
  return [{ x: pts[0].x - CELL / 2, y: pts[0].y }, ...pts, { x: pts[4].x + CELL / 2, y: pts[4].y }];
};

/** Point at fraction t along a polyline, plus the polyline up to that point. */
function along(pts: Pt[], t: number): { head: Pt; path: Pt[] } {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let left = seg.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, t));
  const path = [pts[0]];
  for (let i = 0; i < seg.length; i++) {
    if (left >= seg[i]) {
      left -= seg[i];
      path.push(pts[i + 1]);
      continue;
    }
    const k = seg[i] ? left / seg[i] : 0;
    const head = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    path.push(head);
    return { head, path };
  }
  return { head: pts[pts.length - 1], path };
}

export interface WinPresentOptions {
  turbo: boolean;
  relics: RelicLayer;
  particles?: Particles;
  reduced?: boolean;
}

/**
 * Win presentation: winning symbols light up in a left-to-right ripple inside gold frames,
 * each payline traces itself with a glowing orb, and the line win pops up on a plate.
 */
export class WinLayer extends Container {
  private frames = new Container();
  private lines = new Graphics();
  private orbs = new Container();
  private labels = new Container();
  private tweener: Tweener;
  private grid: ReelGrid;
  private token = 0;

  constructor(tweener: Tweener, grid: ReelGrid) {
    super();
    this.tweener = tweener;
    this.grid = grid;
    this.addChild(this.frames, this.lines, this.orbs, this.labels);
  }

  clear(): void {
    this.token++;
    this.lines.clear();
    for (const layer of [this.frames, this.orbs, this.labels]) layer.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const v of this.grid.allViews()) {
      v.dim(false);
      v.highlight(false);
      v.scale.set(1);
    }
  }

  private strokePath(path: Pt[], color: number, alpha: number): void {
    if (path.length < 2) return;
    const draw = () => {
      this.lines.moveTo(path[0].x, path[0].y);
      for (const p of path.slice(1)) this.lines.lineTo(p.x, p.y);
    };
    draw();
    this.lines.stroke({ color: 0x150a20, width: 16, alpha: alpha * 0.75, join: 'round', cap: 'round' });
    draw();
    this.lines.stroke({ color, width: 12, alpha: alpha * 0.35, join: 'round', cap: 'round' });
    draw();
    this.lines.stroke({ color, width: 5, alpha, join: 'round', cap: 'round' });
    draw();
    this.lines.stroke({ color: 0xffffff, width: 1.5, alpha: alpha * 0.8, join: 'round', cap: 'round' });
  }

  private drawLine(win: LineWin, alpha = 1): void {
    this.strokePath(linePoints(win), LINE_COLORS[(win.line - 1) % LINE_COLORS.length], alpha);
  }

  /** Draws one or more lines growing from left to right with a glowing orb at each head. */
  private async traceLines(wins: LineWin[], ms: number): Promise<void> {
    const pts = wins.map(linePoints);
    const orbs = wins.map((w) => {
      const o = new Sprite(glowTexture());
      o.anchor.set(0.5);
      o.blendMode = 'add';
      o.tint = LINE_COLORS[(w.line - 1) % LINE_COLORS.length];
      o.width = o.height = 70;
      this.orbs.addChild(o);
      return o;
    });
    const token = this.token;
    await this.tweener.run(ms, (p) => {
      if (token !== this.token) return;
      this.lines.clear();
      wins.forEach((w, i) => {
        const { head, path } = along(pts[i], p);
        this.strokePath(path, LINE_COLORS[(w.line - 1) % LINE_COLORS.length], 1);
        if (orbs[i].destroyed) return;
        orbs[i].position.set(head.x, head.y);
        orbs[i].alpha = p < 0.9 ? 1 : (1 - p) * 10;
      });
    }, ease.inOutQuad);
    orbs.forEach((o) => o.destroyed || o.destroy());
  }

  /** A glowing gold frame behind a winning cell that pops in and then breathes. */
  private frameCell(c: Cell, delay: number, color: number): void {
    const root = new Container();
    const p = center(c);
    root.position.set(p.x, p.y);
    const glow = new Sprite(glowTexture());
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.tint = color;
    glow.width = glow.height = CELL * 1.5;
    const f = new Graphics()
      .roundRect(-CELL / 2 + 5, -CELL / 2 + 5, CELL - 10, CELL - 10, 18).fill({ color: 0x150a20, alpha: 0.35 })
      .roundRect(-CELL / 2 + 5, -CELL / 2 + 5, CELL - 10, CELL - 10, 18).stroke({ color: 0xffd36a, width: 4 })
      .roundRect(-CELL / 2 + 10, -CELL / 2 + 10, CELL - 20, CELL - 20, 14).stroke({ color, width: 2, alpha: 0.8 });
    root.addChild(glow, f);
    root.scale.set(0.6);
    root.alpha = 0;
    this.frames.addChild(root);
    const token = this.token;
    void this.tweener.wait(delay).then(async () => {
      if (token !== this.token) return;
      await this.tweener.run(260, (q) => { if (root.destroyed) return; root.alpha = Math.min(1, q * 1.6); root.scale.set(0.6 + q * 0.4); }, ease.outBack);
      // gentle breathing while the win is on screen (driven by a long tween so slam stop ends it)
      let t = 0;
      const breathe = () => {
        if (token !== this.token || root.destroyed) return;
        void this.tweener.run(1200, (q) => {
          if (root.destroyed) return;
          glow.alpha = 0.55 + Math.sin((t + q) * Math.PI * 2) * 0.25;
        }, ease.linear).then(() => { t++; if (t < 6) breathe(); });
      };
      breathe();
    });
  }

  /** Symbol pop: overshooting scale with a soft settle. */
  private pop(cell: Cell, delay: number, size = 0.2): Promise<void> {
    const v = this.grid.view(cell);
    return this.tweener.wait(delay).then(() =>
      this.tweener.run(420, (q) => v.scale.set(1 + Math.sin(q * Math.PI) * size * (1 - q * 0.5) + q * 0.04), ease.linear));
  }

  async present(wins: LineWin[], formatWin: (centi: number) => string, opts: WinPresentOptions): Promise<void> {
    if (!wins.length) return;
    this.clear();
    const token = this.token;
    const cells = new Map<string, Cell>();
    for (const w of wins) for (const c of w.cells) cells.set(`${c.reel},${c.row}`, c);
    for (let reel = 0; reel < REELS; reel++) {
      for (let row = 0; row < ROWS; row++) {
        const on = cells.has(`${reel},${row}`);
        this.grid.view({ reel, row }).dim(!on);
        this.grid.view({ reel, row }).highlight(on);
      }
    }
    opts.relics.pulse(wins.flatMap((w) => w.cells));
    const wave = opts.turbo ? 25 : 70;
    const color = LINE_COLORS[(wins[0].line - 1) % LINE_COLORS.length];
    // ripple left to right: frame, pop and sparks per winning cell
    const pops = [...cells.values()].map((c) => {
      const delay = c.reel * wave;
      this.frameCell(c, delay, color);
      if (opts.particles && !opts.reduced) {
        const p = center(c);
        void this.tweener.wait(delay + 80).then(() => token === this.token && opts.particles!.burst(p.x, p.y, opts.turbo ? 3 : 7, tex('fx_spark'), { speed: 0.35, scale: 0.28, life: 600 }));
      }
      return this.pop(c, delay);
    });
    const tracing = this.traceLines(wins, opts.turbo ? 260 : 520);
    await Promise.all([...pops, tracing]);
    if (token !== this.token) return;
    if (opts.turbo || wins.length === 1) {
      if (wins.length === 1) this.lineLabel(wins[0], formatWin);
      await this.tweener.wait(opts.turbo ? 200 : 750);
      return;
    }
    // cycle through the lines one at a time
    for (const w of wins.slice(0, 6)) {
      if (token !== this.token) return;
      this.labels.removeChildren().forEach((c) => c.destroy({ children: true }));
      const tr = this.traceLines([w], 320);
      this.lineLabel(w, formatWin);
      await Promise.all([tr, ...w.cells.map((c, k) => this.pop(c, k * 45, 0.14))]);
      await this.tweener.wait(180);
    }
    if (token !== this.token) return;
    this.lines.clear();
    for (const w of wins) this.drawLine(w, 0.5);
  }

  /** Line win amount on a dark plate with a gold rim, popping in near the last winning symbol. */
  private lineLabel(w: LineWin, formatWin: (centi: number) => string): void {
    const last = w.cells[w.cells.length - 1];
    const p = center(last);
    const root = new Container();
    const t = new Text({ text: formatWin(w.win), style: textStyle(32) });
    t.anchor.set(0.5);
    const pw = t.width + 40;
    const ph = t.height + 14;
    const plate = new Graphics()
      .roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill({ color: 0x150a20, alpha: 0.88 })
      .roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).stroke({ color: 0xffd36a, width: 3 })
      .roundRect(-pw / 2 + 5, -ph / 2 + 5, pw - 10, ph - 10, (ph - 10) / 2).stroke({ color: LINE_COLORS[(w.line - 1) % LINE_COLORS.length], width: 1.5, alpha: 0.8 });
    root.addChild(plate, t);
    // keep the plate inside the board
    const half = pw / 2 + 6;
    root.position.set(Math.max(half, Math.min(CELL * REELS - half, p.x)), Math.max(ph, Math.min(CELL * ROWS - ph, p.y + CELL * 0.32)));
    root.scale.set(0.4);
    root.alpha = 0;
    this.labels.addChild(root);
    void this.tweener.run(320, (q) => { if (root.destroyed) return; root.scale.set(0.4 + q * 0.6); root.alpha = Math.min(1, q * 2); }, ease.outBack);
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
