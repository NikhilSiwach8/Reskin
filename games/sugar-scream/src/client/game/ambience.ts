// Ambient animation behind the board: the background slowly "breathes" and drifts, mode-coloured
// particles float up (sugar sparkles in the base game, brew bubbles in Haunted Cauldron, embers in
// Full Moon), bats flap across now and then, and mode changes cross-fade the background.
// Purely cosmetic; everything stops in reduced-motion mode.
import { Container, Graphics, Sprite, type Application, type Texture } from 'pixi.js';

export type AmbientMode = 'base' | 'cauldron' | 'fullMoon';

interface Mote {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
}

interface Bat {
  root: Container;
  wings: Graphics;
  x: number;
  y: number;
  vx: number;
  t: number;
  scale: number;
}

const PALETTE: Record<AmbientMode, { colors: number[]; rise: number; count: number; sway: number }> = {
  base: { colors: [0xff7ad8, 0xffd34d, 0xffffff, 0xc58bff], rise: 18, count: 46, sway: 14 },
  cauldron: { colors: [0x9dff4a, 0xc8ff8a, 0x5fd400], rise: 34, count: 54, sway: 8 },
  fullMoon: { colors: [0xff8a00, 0xffc04d, 0xff4a1a], rise: 46, count: 60, sway: 22 },
};

export class Ambience {
  /** Background layer (behind the board). */
  readonly root = new Container();
  private readonly bgA = new Sprite();
  private readonly bgB = new Sprite();
  private readonly motes = new Container();
  private readonly batLayer = new Container();
  private list: Mote[] = [];
  private bats: Bat[] = [];
  private mode: AmbientMode = 'base';
  private t = 0;
  private nextBat = 4;
  private fade = 1; // 0..1 cross-fade progress from bgB (old) to bgA (new)
  reduced = false;

  private readonly app: Application;

  constructor(app: Application, texture: Texture) {
    this.app = app;
    for (const s of [this.bgB, this.bgA]) s.anchor.set(0.5);
    this.bgA.texture = texture;
    this.bgB.visible = false;
    this.root.addChild(this.bgB, this.bgA, this.batLayer, this.motes);
    this.respawn();
    app.ticker.add((tk) => this.step(Math.min(tk.deltaMS, 50) / 1000));
  }

  /** Cross-fades to a new background texture (tint for the fallback vector scene). */
  setBackground(texture: Texture, tint: number, mode: AmbientMode): void {
    if (this.bgA.texture !== texture || this.bgA.tint !== tint) {
      this.bgB.texture = this.bgA.texture;
      this.bgB.tint = this.bgA.tint;
      this.bgB.visible = true;
      this.bgA.texture = texture;
      this.bgA.tint = tint;
      this.fade = this.reduced ? 1 : 0;
    }
    if (mode !== this.mode) {
      this.mode = mode;
      this.respawn();
    }
    this.layout();
  }

  layout(): void {
    const { width: w, height: h } = this.app.screen;
    for (const s of [this.bgA, this.bgB]) {
      const k = Math.max(w / (s.texture.width || 1920), h / (s.texture.height || 1080)) * 1.05; // 5% headroom for the drift
      s.scale.set(k);
      s.position.set(w / 2, h / 2);
    }
  }

  private respawn(): void {
    this.motes.removeChildren().forEach((c) => c.destroy());
    const p = PALETTE[this.mode];
    const { width: w, height: h } = this.app.screen;
    this.list = Array.from({ length: p.count }, () => {
      const size = 1.5 + Math.random() * (this.mode === 'cauldron' ? 5 : 3);
      const color = p.colors[Math.floor(Math.random() * p.colors.length)];
      const g = new Graphics();
      if (this.mode === 'cauldron') g.circle(0, 0, size).stroke({ color, width: 1.5, alpha: 0.9 }).circle(-size * 0.3, -size * 0.3, size * 0.25).fill({ color: 0xffffff, alpha: 0.8 });
      else g.circle(0, 0, size * 2.4).fill({ color, alpha: 0.12 }).circle(0, 0, size).fill({ color, alpha: 0.95 });
      g.blendMode = 'add';
      this.motes.addChild(g);
      return { g, x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 10, vy: -(p.rise * (0.5 + Math.random())), phase: Math.random() * Math.PI * 2, size };
    });
  }

  private spawnBat(): void {
    const { width: w, height: h } = this.app.screen;
    const fromLeft = Math.random() < 0.5;
    const scale = 0.5 + Math.random() * 0.7;
    const root = new Container();
    const body = new Graphics().ellipse(0, 0, 9, 12).fill(0x14031f).circle(0, -12, 7).fill(0x14031f)
      .poly([-6, -16, -3, -24, 0, -17]).fill(0x14031f).poly([6, -16, 3, -24, 0, -17]).fill(0x14031f)
      .circle(-2.5, -13, 1.4).fill(0xffd34d).circle(2.5, -13, 1.4).fill(0xffd34d);
    const wings = new Graphics()
      .poly([0, -4, -16, -14, -34, -8, -44, 6, -32, 2, -24, 10, -14, 2, -6, 8]).fill(0x14031f)
      .poly([0, -4, 16, -14, 34, -8, 44, 6, 32, 2, 24, 10, 14, 2, 6, 8]).fill(0x14031f);
    root.addChild(wings, body);
    root.scale.set(scale * (fromLeft ? 1 : -1), scale);
    root.alpha = 0.85;
    this.batLayer.addChild(root);
    this.bats.push({ root, wings, x: fromLeft ? -60 : w + 60, y: h * (0.08 + Math.random() * 0.35), vx: (fromLeft ? 1 : -1) * (120 + Math.random() * 120), t: Math.random() * 6, scale });
  }

  private step(dt: number): void {
    const { width: w, height: h } = this.app.screen;
    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / 0.9);
      this.bgA.alpha = this.fade;
      if (this.fade >= 1) this.bgB.visible = false;
    }
    if (this.reduced) {
      this.motes.visible = this.batLayer.visible = false;
      return;
    }
    this.motes.visible = this.batLayer.visible = true;
    this.t += dt;
    // slow breathing zoom and drift (Ken Burns)
    const base = Math.max(w / (this.bgA.texture.width || 1920), h / (this.bgA.texture.height || 1080)) * 1.05;
    const z = 1 + Math.sin(this.t * 0.11) * 0.018;
    this.bgA.scale.set(base * z);
    this.bgA.position.set(w / 2 + Math.sin(this.t * 0.07) * w * 0.012, h / 2 + Math.cos(this.t * 0.09) * h * 0.01);
    this.bgB.scale.copyFrom(this.bgA.scale);
    this.bgB.position.copyFrom(this.bgA.position);
    // particles
    const sway = PALETTE[this.mode].sway;
    for (const m of this.list) {
      m.phase += dt * 1.6;
      m.x += (m.vx + Math.sin(m.phase) * sway) * dt;
      m.y += m.vy * dt;
      if (m.y < -20 || m.x < -30 || m.x > w + 30) {
        m.y = h + 10;
        m.x = Math.random() * w;
      }
      m.g.position.set(m.x, m.y);
      m.g.alpha = 0.45 + Math.sin(m.phase * 1.7) * 0.4;
    }
    // bats
    this.nextBat -= dt;
    if (this.nextBat <= 0) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.spawnBat();
      this.nextBat = 7 + Math.random() * 9;
    }
    for (const b of [...this.bats]) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += Math.sin(b.t * 2.2) * 18 * dt;
      b.root.position.set(b.x, b.y);
      b.wings.scale.y = 0.35 + Math.abs(Math.sin(b.t * 14)) * 0.75;
      if (b.x < -100 || b.x > w + 100) {
        b.root.destroy({ children: true });
        this.bats.splice(this.bats.indexOf(b), 1);
      }
    }
  }
}
