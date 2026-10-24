// Pixi scene graph and responsive layout.
import { Application, Container, Sprite } from 'pixi.js';
import type { Board } from '../../engine/types.ts';
import { tex, type TextureName } from '../assets.ts';
import { Particles, Props, RelicLayer, WinLayer } from './effects.ts';
import { ReelGrid } from './reels.ts';
import { Tweener } from './tween.ts';

/** Frame artwork geometry (see tools/art/scenes.mjs): reel window at 125,200 size 750. */
const FRAME = { w: 1000, h: 1060, wx: 125, wy: 200 };

export type Orientation = 'landscape' | 'portrait';

export class Stage {
  readonly app: Application;
  readonly tweener: Tweener;
  readonly root = new Container();
  readonly board = new Container();
  readonly gridLayer = new Container();
  readonly reels: ReelGrid;
  readonly relics: RelicLayer;
  readonly wins: WinLayer;
  readonly props: Props;
  readonly particles = new Particles();
  private bgA = new Sprite();
  private bgB = new Sprite();
  private bgName: TextureName = 'bg_bank';
  private logo = new Sprite(tex('logo'));
  orientation: Orientation = 'landscape';
  /** Board rectangle in CSS pixels, published for the DOM overlay. */
  boardRect = { x: 0, y: 0, w: 0, h: 0 };
  onLayout?: () => void;

  constructor(app: Application, initial: Board) {
    this.app = app;
    this.tweener = new Tweener(app.ticker);
    this.reels = new ReelGrid(this.tweener, initial);
    this.relics = new RelicLayer(this.tweener, this.reels);
    this.wins = new WinLayer(this.tweener, this.reels);
    this.props = new Props(this.tweener, this.particles);

    for (const bg of [this.bgA, this.bgB]) bg.anchor.set(0.5);
    this.bgA.texture = tex('bg_bank');
    this.bgB.alpha = 0;

    const frame = new Sprite(tex('frame'));
    const panel = new Sprite(tex('reel_panel'));
    panel.position.set(FRAME.wx, FRAME.wy);
    this.gridLayer.position.set(FRAME.wx, FRAME.wy);
    this.gridLayer.addChild(this.reels, this.relics, this.wins, this.props, this.particles);
    this.board.addChild(panel, this.gridLayer, frame);
    this.logo.anchor.set(0.5, 0);
    this.root.addChild(this.board, this.logo);
    app.stage.addChild(this.bgA, this.bgB, this.root);

    app.ticker.add((t) => {
      this.reels.update(t.deltaMS);
      this.particles.update(t.deltaMS);
    });
    window.addEventListener('resize', () => this.layout());
    for (const id of ['controls', 'replay-bar']) {
      const el = document.getElementById(id);
      if (el) new ResizeObserver(() => this.layout()).observe(el);
    }
    this.layout();
  }

  layout(): void {
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    this.orientation = vw >= vh ? 'landscape' : 'portrait';
    for (const bg of [this.bgA, this.bgB]) {
      const t = bg.texture;
      const s = Math.max(vw / (t.width || 1), vh / (t.height || 1));
      bg.scale.set(s);
      bg.position.set(vw / 2, vh / 2);
    }
    const land = this.orientation === 'landscape';
    // Design space of the playfield (logo + board). It is fitted into the area above the
    // DOM control bar, whose real height depends on the screen (it wraps on narrow phones).
    const bar = document.getElementById('controls')?.offsetHeight || document.getElementById('replay-bar')?.offsetHeight || 0;
    const availH = Math.max(100, vh - bar);
    const dw = land ? 1920 : 1080;
    const dh = land ? 960 : 1340;
    const s = Math.min(vw / dw, availH / dh);
    this.root.scale.set(s);
    this.root.position.set((vw - dw * s) / 2, (availH - dh * s) / 2);
    if (land) {
      this.board.scale.set(0.84);
      this.board.position.set((dw - FRAME.w * 0.84) / 2, 40);
      this.logo.width = 500;
      this.logo.scale.y = this.logo.scale.x;
      this.logo.position.set(dw / 2, 2);
    } else {
      this.board.scale.set(1);
      this.board.position.set((dw - FRAME.w) / 2, 260);
      this.logo.width = 720;
      this.logo.scale.y = this.logo.scale.x;
      this.logo.position.set(dw / 2, 30);
    }
    const g = this.gridLayer.getGlobalPosition();
    const k = this.board.scale.x * s;
    this.boardRect = { x: g.x, y: g.y, w: 750 * k, h: 750 * k };
    this.onLayout?.();
  }

  /** Clock placement in grid coordinates (left of the board in landscape, below it in portrait). */
  clockSpot(): { x: number; y: number; size: number } {
    return this.orientation === 'landscape' ? { x: -330, y: 520, size: 330 } : { x: 120, y: 900, size: 260 };
  }

  async setBackground(name: TextureName): Promise<void> {
    if (name === this.bgName) return;
    this.bgName = name;
    this.bgB.texture = tex(name);
    this.layout();
    await this.tweener.run(700, (p) => (this.bgB.alpha = p));
    this.bgA.texture = this.bgB.texture;
    this.bgB.alpha = 0;
    this.layout();
  }

  async shake(strength = 12, ms = 400): Promise<void> {
    if (this.tweener.reducedMotion) return;
    const bx = this.root.x;
    const by = this.root.y;
    await this.tweener.run(ms, (p) => {
      const k = (1 - p) * strength;
      this.root.x = bx + (Math.random() - 0.5) * k;
      this.root.y = by + (Math.random() - 0.5) * k;
    });
    this.root.position.set(bx, by);
  }
}
