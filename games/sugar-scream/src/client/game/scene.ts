// PixiJS scene: background, board panel, the 6x5 grid of candies and every board animation.
// Animations only present an outcome that the book has already fixed.
import { Application, Container, Graphics, NineSliceSprite, Sprite, Text, type Ticker } from 'pixi.js';
import { REELS, ROWS } from '../../engine/config.ts';
import type { Board, Cell, MultCell, SymbolId } from '../../engine/types.ts';
import { hasTexture, isPainted, symbolTexture, tex } from '../assets.ts';
import { Tweener, ease } from './tween.ts';

/** Board design units: one cell is S x S. */
const S = 160;
const BOARD_W = REELS * S;
const BOARD_H = ROWS * S;
const SYMBOL_SIZE = S * 0.86;

/**
 * Measured on the painted frame (art/source/panel_board.webp, 1374x1145): its 5 divider lines
 * give a column pitch of 191.75 px and an inner window from x 111 to 1262, y 206 to 918.
 * The window is wider than a 6x5 grid of square cells, so the frame is nine-sliced and only
 * its plain middle band (y 215 to 815) is stretched vertically; corners stay undistorted.
 */
const BOARD_FRAME = { left: 111, top: 206, bottom: 918, pitch: 191.75, sliceTop: 215, sliceBottom: 330, sliceSide: 140 };

interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

class CellView {
  readonly root = new Container();
  readonly sprite = new Sprite();
  label: Text | null = null;
  symbol: SymbolId;

  constructor(symbol: SymbolId, mult: number) {
    this.symbol = symbol;
    this.sprite.anchor.set(0.5);
    this.root.addChild(this.sprite);
    this.set(symbol, mult);
  }

  set(symbol: SymbolId, mult: number): void {
    this.symbol = symbol;
    this.sprite.texture = symbolTexture(symbol);
    this.sprite.width = SYMBOL_SIZE;
    this.sprite.height = SYMBOL_SIZE;
    this.label?.destroy();
    this.label = null;
    if (symbol === 'JK' && mult > 0) {
      this.label = new Text({
        text: `x${mult}`,
        style: { fontFamily: 'Creepster, Fredoka, sans-serif', fontSize: 56, fill: '#fff6c2', stroke: { color: '#5a1300', width: 8 }, dropShadow: { color: '#000', blur: 6, distance: 3, alpha: 0.7 } },
      });
      this.label.anchor.set(0.5);
      // painted lantern: the value sits in its open mouth
      this.label.y = isPainted('JK') ? S * 0.17 : S * 0.3;
      this.root.addChild(this.label);
    }
  }
}

export class Scene {
  readonly tween: Tweener;
  private readonly bg = new Sprite();
  private readonly world = new Container();
  private readonly panel = new Sprite();
  /** Board-unit box covered by the frame (for layout). */
  private frameBox: FrameBox = { x: -55, y: -46, w: BOARD_W + 110, h: BOARD_H + 92 };
  private readonly grid = new Container();
  private readonly fx = new Container();
  private readonly gridMask = new Graphics();
  private views: CellView[][] = [];
  private readonly ticker: Ticker;
  reduced = false;
  private readonly app: Application;

  constructor(app: Application, board: Board) {
    this.app = app;
    this.ticker = app.ticker;
    this.tween = new Tweener(app.ticker);
    this.bg.texture = tex('bg');
    this.bg.anchor.set(0.5);
    app.stage.addChild(this.bg, this.world);
    this.gridMask.rect(-10, -6, BOARD_W + 20, BOARD_H + 12).fill(0xffffff);
    this.grid.mask = this.gridMask;
    this.world.addChild(this.makeFrame(), this.gridMask, this.grid, this.fx);
    this.setBoard(board, []);
    this.layout();
    window.addEventListener('resize', () => this.layout());
    // idle bob of the Jack-o'-Lanterns and Lollipops
    let t = 0;
    this.ticker.add((tk) => {
      t += tk.deltaMS / 1000;
      if (this.reduced) return;
      this.views.forEach((col, r) => col.forEach((v, row) => {
        if (v.symbol === 'SC' || v.symbol === 'JK') v.sprite.rotation = Math.sin(t * 2 + r + row) * 0.06;
      }));
    });
  }

  /** The painted candy-cane frame when imported, else the vector panel. */
  private makeFrame(): Container {
    if (!hasTexture('frame')) {
      this.panel.texture = tex('panel');
      this.panel.anchor.set(0.5);
      this.panel.width = BOARD_W + 110;
      this.panel.height = BOARD_H + 92;
      this.panel.position.set(BOARD_W / 2, BOARD_H / 2);
      return this.panel;
    }
    const t = tex('frame');
    const f = BOARD_FRAME;
    const frame = new NineSliceSprite({ texture: t, leftWidth: f.sliceSide, rightWidth: f.sliceSide, topHeight: f.sliceTop, bottomHeight: f.sliceBottom });
    const k = S / f.pitch; // texture px -> board units
    const extra = ROWS * f.pitch - (f.bottom - f.top); // window height the grid needs beyond the painted one
    frame.width = t.width;
    frame.height = t.height + extra;
    frame.scale.set(k);
    frame.position.set(-f.left * k, -f.top * k);
    this.frameBox = { x: frame.x, y: frame.y, w: t.width * k, h: (t.height + extra) * k };
    return frame;
  }

  /** Lays the board out above the bottom HUD (and beside the side panel on wide screens). */
  layout(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const scale = Math.max(w / (this.bg.texture.width || 1920), h / (this.bg.texture.height || 1080));
    this.bg.scale.set(scale);
    this.bg.position.set(w / 2, h / 2);
    const portrait = h > w;
    // portrait: the HUD plus the row of side buttons / feature panels above it
    const hudH = portrait ? Math.min(190, h * 0.3) + 92 : h <= 460 ? 84 : Math.min(118, h * 0.2);
    const top = portrait ? 64 : Math.min(84, h * 0.13);
    const side = portrait ? 0 : Math.min(240, w * 0.16);
    const availW = w - side * 2 - 24;
    const availH = h - hudH - top - 16;
    const fb = this.frameBox;
    const k = Math.min(availW / fb.w, availH / fb.h);
    this.world.scale.set(k);
    // centre the frame (not just the grid) in the available area
    this.world.position.set((w - fb.w * k) / 2 - fb.x * k, top + (availH - fb.h * k) / 2 - fb.y * k);
    document.documentElement.style.setProperty('--board-top', `${this.world.y}px`);
    document.documentElement.style.setProperty('--board-left', `${this.world.x}px`);
    document.documentElement.style.setProperty('--board-w', `${BOARD_W * k}px`);
    document.documentElement.style.setProperty('--board-h', `${BOARD_H * k}px`);
    document.documentElement.style.setProperty('--board-pad', `${Math.max(-fb.x, fb.x + fb.w - BOARD_W) * k}px`);
  }

  private pos(reel: number, row: number) {
    return { x: reel * S + S / 2, y: row * S + S / 2 };
  }

  private place(v: CellView, reel: number, row: number): void {
    const p = this.pos(reel, row);
    v.root.position.set(p.x, p.y);
    v.root.scale.set(1);
    v.root.alpha = 1;
  }

  setBoard(board: Board, mults: MultCell[]): void {
    this.grid.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.views = board.map((col, reel) => col.map((s, row) => {
      const v = new CellView(s, mults.find((m) => m.reel === reel && m.row === row)?.value ?? 0);
      this.place(v, reel, row);
      this.grid.addChild(v.root);
      return v;
    }));
  }

  setMode(mode: 'base' | 'cauldron' | 'fullMoon'): void {
    // A painted feature background when one exists, else the base scene tinted for the feature.
    const name = mode === 'base' ? 'bg' : mode === 'fullMoon' ? 'bg_fullmoon' : 'bg_cauldron';
    const own = mode === 'base' || hasTexture(name);
    this.bg.texture = tex(own ? name : 'bg');
    this.bg.tint = own ? 0xffffff : mode === 'fullMoon' ? 0xffb0a0 : 0xd8c8ff;
    this.layout();
  }

  /** Current symbols fall out of the bottom of the board, reel by reel. */
  async dropOut(): Promise<void> {
    const jobs: Promise<void>[] = [];
    this.views.forEach((col, reel) => col.forEach((v) => {
      const y0 = v.root.y;
      jobs.push(this.tween.wait(reel * 40).then(() => this.tween.run(260, (p) => { v.root.y = y0 + p * BOARD_H * 1.1; }, ease.inQuad)));
    }));
    await Promise.all(jobs);
  }

  /** A new board drops in from above with a small bounce. */
  async dropIn(board: Board, mults: MultCell[]): Promise<void> {
    this.setBoard(board, mults);
    const jobs: Promise<void>[] = [];
    this.views.forEach((col, reel) => col.forEach((v, row) => {
      const target = v.root.y;
      v.root.y = target - BOARD_H - S;
      const delay = reel * 70 + (ROWS - 1 - row) * 22;
      jobs.push(this.tween.wait(delay).then(() => this.tween.run(380, (p) => { v.root.y = target - (1 - p) * (BOARD_H + S); }, ease.outBack)));
    }));
    await Promise.all(jobs);
  }

  /** Pulses the winning cells and dims the rest. */
  async highlight(cells: Cell[]): Promise<void> {
    const set = new Set(cells.map((c) => `${c.reel},${c.row}`));
    const jobs: Promise<void>[] = [];
    this.views.forEach((col, reel) => col.forEach((v, row) => {
      const hit = set.has(`${reel},${row}`);
      if (!hit) {
        jobs.push(this.tween.to(v.root, { alpha: 0.45 }, 200));
        return;
      }
      jobs.push(this.tween.run(520, (p) => v.root.scale.set(1 + Math.sin(p * Math.PI * 2) * 0.12), ease.linear));
    }));
    await Promise.all(jobs);
  }

  undim(): void {
    for (const col of this.views) for (const v of col) v.root.alpha = 1;
  }

  /** Winning candies burst into sugar sparks. */
  async explode(cells: Cell[]): Promise<void> {
    const jobs = cells.map((c) => {
      const v = this.views[c.reel][c.row];
      this.flash('p_fx_pop', v.root.x, v.root.y, 1.15);
      this.burst(v.root.x, v.root.y, v.symbol === 'BH' ? 0xff3355 : v.symbol === 'SL' ? 0x8dff3a : v.symbol === 'WP' || v.symbol === 'BT' ? 0xc070ff : 0xffc040, 10);
      return this.tween.run(220, (p) => { v.root.scale.set(1 + p * 0.4); v.root.alpha = 1 - p; }, ease.outQuad);
    });
    await Promise.all(jobs);
  }

  /** Survivors fall to fill the gaps; new candies drop in from the top. */
  async collapse(removed: Cell[], board: Board, mults: MultCell[]): Promise<void> {
    const jobs: Promise<void>[] = [];
    const next: CellView[][] = [];
    for (let reel = 0; reel < REELS; reel++) {
      const gone = new Set(removed.filter((c) => c.reel === reel).map((c) => c.row));
      const survivors: CellView[] = [];
      this.views[reel].forEach((v, row) => {
        if (gone.has(row)) v.root.destroy({ children: true });
        else survivors.push(v);
      });
      const fresh: CellView[] = [];
      for (let i = 0; i < gone.size; i++) {
        const v = new CellView(board[reel][i], mults.find((m) => m.reel === reel && m.row === i)?.value ?? 0);
        const p = this.pos(reel, i - gone.size);
        v.root.position.set(p.x, p.y - S * 0.4);
        this.grid.addChild(v.root);
        fresh.push(v);
      }
      const col = [...fresh, ...survivors];
      col.forEach((v, row) => {
        v.root.alpha = 1;
        v.root.scale.set(1);
        // keep the view in sync with the book's board (survivors keep their symbol)
        if (v.symbol !== board[reel][row]) v.set(board[reel][row], mults.find((m) => m.reel === reel && m.row === row)?.value ?? 0);
        const y0 = v.root.y;
        const y1 = this.pos(reel, row).y;
        if (y0 !== y1) jobs.push(this.tween.wait(reel * 30).then(() => this.tween.run(320, (p) => { v.root.y = y0 + (y1 - y0) * p; }, ease.outBack)));
      });
      next.push(col);
    }
    this.views = next;
    await Promise.all(jobs);
  }

  /** The Witch flies over the board and her spell turns cells into one candy. */
  async spell(cells: Cell[], symbol: SymbolId): Promise<void> {
    const painted = hasTexture('p_witch');
    const witch = new Sprite(tex(painted ? 'p_witch' : 'witch'));
    witch.anchor.set(0.5);
    if (painted) witch.scale.set(760 / witch.texture.width);
    else witch.scale.set(0.9);
    witch.position.set(-300, BOARD_H * 0.3);
    this.fx.addChild(witch);
    const trail = () => {
      if (!this.reduced && Math.random() < 0.6) this.spark(witch.x - 120, witch.y + 30, 0xd88bff);
    };
    this.ticker.add(trail);
    await this.tween.run(1100, (p) => {
      witch.x = -300 + p * (BOARD_W + 600);
      witch.y = BOARD_H * 0.3 + Math.sin(p * Math.PI * 2) * 60;
    }, ease.inOutQuad);
    this.ticker.remove(trail);
    witch.destroy();
    await Promise.all(cells.map(async (c, i) => {
      const v = this.views[c.reel][c.row];
      await this.tween.wait(i * 60);
      this.burst(v.root.x, v.root.y, 0xc070ff, 8);
      this.flash('p_fx_spell', v.root.x, v.root.y, 1.5);
      await this.tween.run(160, (p) => v.root.scale.set(1 - p * 0.9), ease.inQuad);
      v.set(symbol, 0);
      await this.tween.run(260, (p) => v.root.scale.set(0.1 + p * 0.9), ease.outBack);
    }));
  }

  /** Lollipops wobble and glow (feature triggers). */
  async pulseCells(cells: Cell[], ms = 900): Promise<void> {
    await Promise.all(cells.map((c) => {
      const v = this.views[c.reel]?.[c.row];
      if (!v) return Promise.resolve();
      this.burst(v.root.x, v.root.y, 0xff4fd8, 12);
      return this.tween.run(ms, (p) => v.root.scale.set(1 + Math.sin(p * Math.PI * 3) * 0.18), ease.linear);
    }));
  }

  /** Jack-o'-Lanterns fling their values towards the given point (board units). */
  async flingMults(cells: MultCell[], to: { x: number; y: number }): Promise<void> {
    await Promise.all(cells.map(async (c, i) => {
      const v = this.views[c.reel]?.[c.row];
      if (!v) return;
      await this.tween.wait(i * 120);
      const orb = new Text({ text: `x${c.value}`, style: { fontFamily: 'Creepster, sans-serif', fontSize: 64, fill: '#ffe066', stroke: { color: '#5a1300', width: 8 } } });
      orb.anchor.set(0.5);
      orb.position.set(v.root.x, v.root.y);
      this.fx.addChild(orb);
      const x0 = orb.x, y0 = orb.y;
      await this.tween.run(520, (p) => {
        orb.x = x0 + (to.x - x0) * p;
        orb.y = y0 + (to.y - y0) * p - Math.sin(p * Math.PI) * 120;
        orb.scale.set(1 + Math.sin(p * Math.PI) * 0.5);
      }, ease.inOutQuad);
      this.burst(orb.x, orb.y, 0xffb300, 10);
      orb.destroy();
    }));
  }

  /** Floating text over the board (board units). */
  async floatText(text: string, x: number, y: number, size = 58, color = '#ffffff'): Promise<void> {
    const t = new Text({ text, style: { fontFamily: 'Fredoka, sans-serif', fontWeight: '700', fontSize: size, fill: color, stroke: { color: '#2a0040', width: 10 } } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.fx.addChild(t);
    await this.tween.run(260, (p) => t.scale.set(0.4 + p * 0.6), ease.outBack);
    await this.tween.run(520, (p) => { t.y = y - p * 40; t.alpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4; }, ease.linear);
    t.destroy();
  }

  centroid(cells: Cell[]): { x: number; y: number } {
    const x = cells.reduce((s, c) => s + c.reel, 0) / cells.length;
    const y = cells.reduce((s, c) => s + c.row, 0) / cells.length;
    return this.pos(x, y);
  }

  get center(): { x: number; y: number } {
    return { x: BOARD_W / 2, y: BOARD_H / 2 };
  }

  /** Converts a DOM point to board units (to fly values to a DOM meter). */
  fromScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.world.x) / this.world.scale.x, y: (y - this.world.y) / this.world.scale.y };
  }

  private spark(x: number, y: number, color: number): void {
    const g = new Graphics().circle(0, 0, 4 + Math.random() * 6).fill({ color, alpha: 0.9 });
    g.position.set(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
    this.fx.addChild(g);
    const vy = 1 + Math.random() * 2;
    void this.tween.run(600, (p) => { g.alpha = 1 - p; g.y += vy; }, ease.linear).then(() => g.destroy());
  }

  /** A painted effect sprite that pops, spins slightly and fades (skipped if not imported). */
  private flash(name: string, x: number, y: number, size: number): void {
    if (this.reduced || !hasTexture(name)) return;
    const f = new Sprite(tex(name));
    f.anchor.set(0.5);
    f.position.set(x, y);
    f.blendMode = 'add';
    const base = (S * size) / f.texture.width;
    this.fx.addChild(f);
    void this.tween.run(420, (p) => {
      f.scale.set(base * (0.4 + p * 0.8));
      f.rotation = p * 0.5;
      f.alpha = p < 0.3 ? 1 : 1 - (p - 0.3) / 0.7;
    }, ease.outQuad).then(() => f.destroy());
  }

  burst(x: number, y: number, color: number, n: number): void {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const g = new Graphics().circle(0, 0, 5 + Math.random() * 7).fill({ color, alpha: 0.95 });
      g.position.set(x, y);
      this.fx.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 90;
      void this.tween.run(480, (p) => {
        g.position.set(x + Math.cos(a) * d * p, y + Math.sin(a) * d * p + p * p * 60);
        g.alpha = 1 - p;
      }, ease.outQuad).then(() => g.destroy());
    }
  }
}
