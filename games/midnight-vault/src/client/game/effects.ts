// Visual layers on top of the reels: relic blocks, paylines, particles and feature props.
import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { PAYLINES, REELS, ROWS } from '../../engine/config.ts';
import type { Cell, LineWin, RelicBlock } from '../../engine/types.ts';
import { symbolTexture, tex } from '../assets.ts';
import { CELL, type ReelGrid } from './reels.ts';
import { ease, type Tweener } from './tween.ts';

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

  private draw(v: BlockView, x: number, y: number, size: number): void {
    const w = size;
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
    const frame = new Graphics();
    const art = new Sprite(block.size > 1 && tex('relic_block') !== Texture.EMPTY ? tex('relic_block') : symbolTexture('RL'));
    art.anchor.set(0.5);
    const label = new Text({ text: block.mult > 1 ? `x${block.mult}` : '', style: textStyle(block.size > 1 ? 44 : 34) });
    label.anchor.set(1, 1);
    root.addChild(frame, art, label);
    this.addChild(root);
    const v: BlockView = { root, frame, art, label, block };
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

export class WinLayer extends Container {
  private lines = new Graphics();
  private labels = new Container();
  private tweener: Tweener;
  private grid: ReelGrid;

  constructor(tweener: Tweener, grid: ReelGrid) {
    super();
    this.tweener = tweener;
    this.grid = grid;
    this.addChild(this.lines, this.labels);
  }

  clear(): void {
    this.lines.clear();
    this.labels.removeChildren().forEach((c) => c.destroy());
    for (const v of this.grid.allViews()) v.dim(false);
  }

  private drawLine(win: LineWin, alpha = 1): void {
    const pts = PAYLINES[win.line - 1].map((row, reel) => center({ reel, row }));
    const color = LINE_COLORS[(win.line - 1) % LINE_COLORS.length];
    this.lines.moveTo(pts[0].x - CELL / 2, pts[0].y);
    for (const p of pts) this.lines.lineTo(p.x, p.y);
    this.lines.lineTo(pts[4].x + CELL / 2, pts[4].y);
    this.lines.stroke({ color: 0x150a20, width: 14, alpha: alpha * 0.8 });
    this.lines.moveTo(pts[0].x - CELL / 2, pts[0].y);
    for (const p of pts) this.lines.lineTo(p.x, p.y);
    this.lines.lineTo(pts[4].x + CELL / 2, pts[4].y);
    this.lines.stroke({ color, width: 6, alpha });
  }

  /** Shows every winning line at once, then cycles through them. */
  async present(wins: LineWin[], formatWin: (centi: number) => string, opts: { turbo: boolean; relics: RelicLayer }): Promise<void> {
    if (!wins.length) return;
    const winning = new Set(wins.flatMap((w) => w.cells.map((c) => `${c.reel},${c.row}`)));
    for (let reel = 0; reel < REELS; reel++) for (let row = 0; row < ROWS; row++) this.grid.view({ reel, row }).dim(!winning.has(`${reel},${row}`));
    for (const w of wins) this.drawLine(w);
    opts.relics.pulse(wins.flatMap((w) => w.cells));
    const views = [...winning].map((k) => {
      const [reel, row] = k.split(',').map(Number);
      return this.grid.view({ reel, row });
    });
    await this.tweener.run(opts.turbo ? 260 : 600, (p) => views.forEach((v) => v.scale.set(1 + Math.sin(p * Math.PI) * 0.12)), ease.linear);
    if (opts.turbo || wins.length === 1) {
      if (wins.length === 1) this.lineLabel(wins[0], formatWin);
      await this.tweener.wait(opts.turbo ? 200 : 700);
      return;
    }
    for (const w of wins.slice(0, 6)) {
      this.lines.clear();
      this.labels.removeChildren().forEach((c) => c.destroy());
      this.drawLine(w);
      this.lineLabel(w, formatWin);
      const cells = w.cells.map((c) => this.grid.view(c));
      await this.tweener.run(520, (p) => cells.forEach((v) => v.scale.set(1 + Math.sin(p * Math.PI) * 0.1)), ease.linear);
    }
    this.lines.clear();
    for (const w of wins) this.drawLine(w, 0.55);
  }

  private lineLabel(w: LineWin, formatWin: (centi: number) => string): void {
    const last = w.cells[w.cells.length - 1];
    const p = center(last);
    const t = new Text({ text: formatWin(w.win), style: textStyle(36) });
    t.anchor.set(0.5);
    t.x = p.x;
    t.y = p.y;
    this.labels.addChild(t);
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
  async openVault(reduced: boolean): Promise<void> {
    const w = CELL * REELS;
    this.door.visible = true;
    this.door.x = w / 2;
    this.door.y = (CELL * ROWS) / 2;
    this.door.width = this.door.height = w * 1.04;
    this.door.alpha = 1;
    this.door.rotation = 0;
    await this.tweener.wait(250);
    if (reduced) {
      await this.tweener.run(500, (p) => (this.door.alpha = 1 - p));
    } else {
      await this.tweener.run(600, (p) => (this.door.rotation = p * Math.PI), ease.inOutQuad);
      await this.tweener.run(700, (p) => {
        this.door.x = w / 2 + p * w * 1.2;
        this.door.rotation = Math.PI + p * Math.PI * 2;
      }, ease.inCubic);
    }
    this.door.visible = false;
    this.particles.burst(w / 2, (CELL * ROWS) / 2, 40, tex('fx_coin'), { speed: 0.8, gravity: 1, scale: 0.4, life: 1400 });
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
