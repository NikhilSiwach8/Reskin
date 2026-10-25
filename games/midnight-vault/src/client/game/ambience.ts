// Ambient animation for the painted backgrounds and the logo: flickering flames and lamps,
// a pulsing moon, drifting fog, rising embers and passing bats. Purely decorative.
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { TextureName } from '../assets.ts';

/** A light in normalised background-texture coordinates. */
interface Light {
  x: number;
  y: number;
  r: number; // radius as a fraction of the texture width
  color: number;
  flicker: number; // 0 = steady, 1 = strong flicker
  alpha: number;
}

const GREEN = 0x7dffa8;
const AMBER = 0xf5a13a;
const VIOLET = 0xb48cff;

// Positions measured on the painted backgrounds (1672x941 sources, normalised).
const BANK: Light[] = [
  { x: 0.326, y: 0.16, r: 0.05, color: GREEN, flicker: 1, alpha: 0.55 },
  { x: 0.664, y: 0.16, r: 0.05, color: GREEN, flicker: 1, alpha: 0.55 },
  { x: 0.195, y: 0.32, r: 0.035, color: GREEN, flicker: 1, alpha: 0.45 },
  { x: 0.78, y: 0.32, r: 0.035, color: GREEN, flicker: 1, alpha: 0.45 },
  { x: 0.29, y: 0.63, r: 0.06, color: GREEN, flicker: 1, alpha: 0.6 },
  { x: 0.706, y: 0.63, r: 0.06, color: GREEN, flicker: 1, alpha: 0.6 },
  { x: 0.316, y: 0.47, r: 0.035, color: AMBER, flicker: 0.5, alpha: 0.5 },
  { x: 0.685, y: 0.47, r: 0.035, color: AMBER, flicker: 0.5, alpha: 0.5 },
  { x: 0.028, y: 0.51, r: 0.03, color: AMBER, flicker: 0.5, alpha: 0.45 },
  { x: 0.972, y: 0.51, r: 0.03, color: AMBER, flicker: 0.5, alpha: 0.45 },
  { x: 0.831, y: 0.175, r: 0.11, color: VIOLET, flicker: 0.1, alpha: 0.35 }, // moon
];

const VAULT = (flame: number, core: number): Light[] => [
  { x: 0.16, y: 0.2, r: 0.05, color: flame, flicker: 1, alpha: 0.55 },
  { x: 0.84, y: 0.2, r: 0.05, color: flame, flicker: 1, alpha: 0.55 },
  { x: 0.5, y: 0.46, r: 0.2, color: core, flicker: 0.25, alpha: 0.35 },
  { x: 0.5, y: 0.1, r: 0.06, color: core, flicker: 0.4, alpha: 0.4 },
  { x: 0.03, y: 0.35, r: 0.03, color: AMBER, flicker: 0.7, alpha: 0.4 },
  { x: 0.97, y: 0.35, r: 0.03, color: AMBER, flicker: 0.7, alpha: 0.4 },
  { x: 0.27, y: 0.72, r: 0.035, color: AMBER, flicker: 0.7, alpha: 0.35 },
  { x: 0.74, y: 0.72, r: 0.035, color: AMBER, flicker: 0.7, alpha: 0.35 },
];

const LIGHTS: Partial<Record<TextureName, Light[]>> = {
  bg_bank: BANK,
  bg_final_heist: VAULT(GREEN, GREEN),
  bg_cursed_fortune: VAULT(GREEN, GREEN),
  bg_phantom_payday: VAULT(VIOLET, VIOLET),
  bg_midnight_countdown: VAULT(AMBER, AMBER),
};

const EMBER_COLORS: Partial<Record<TextureName, number[]>> = {
  bg_bank: [GREEN, VIOLET, AMBER],
  bg_phantom_payday: [VIOLET, 0xe0c8ff],
  bg_midnight_countdown: [AMBER, 0xffd36a],
};

let glowTex: Texture | null = null;

/** Soft radial glow texture generated once at runtime. */
export function glowTexture(): Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = Texture.from(c);
  return glowTex;
}

/** Simple bat silhouette; wings flap by scaling. */
export function makeBat(size: number): Container {
  const bat = new Container();
  const body = new Graphics().ellipse(0, 0, size * 0.12, size * 0.18).fill(0x0a0612);
  const wing = (dir: number) =>
    new Graphics()
      .moveTo(0, 0)
      .bezierCurveTo(dir * size * 0.3, -size * 0.35, dir * size * 0.55, -size * 0.2, dir * size * 0.62, size * 0.05)
      .lineTo(dir * size * 0.45, size * 0.0)
      .lineTo(dir * size * 0.38, size * 0.12)
      .lineTo(dir * size * 0.25, size * 0.04)
      .lineTo(dir * size * 0.14, size * 0.14)
      .closePath()
      .fill(0x0a0612);
  const left = wing(-1);
  const right = wing(1);
  bat.addChild(left, right, body);
  (bat as Container & { wings: Graphics[] }).wings = [left, right];
  return bat;
}

interface Ember {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  phase: number;
}

interface Bat {
  c: Container & { wings?: Graphics[] };
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

export class Ambience extends Container {
  private lights: { s: Sprite; l: Light; seed: number }[] = [];
  private fog: { s: Sprite; v: number; base: number }[] = [];
  private embers: Ember[] = [];
  private bats: Bat[] = [];
  private emberLayer = new Container();
  private batLayer = new Container();
  private lightLayer = new Container();
  private fogLayer = new Container();
  private t = 0;
  private nextBats = 6000;
  private bgName: TextureName = 'bg_bank';
  private rect = { x: 0, y: 0, w: 1, h: 1 };
  reduced = false;

  constructor() {
    super();
    this.addChild(this.lightLayer, this.fogLayer, this.emberLayer, this.batLayer);
    this.eventMode = 'none';
    for (let i = 0; i < 4; i++) {
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.tint = 0xb9a2e8;
      s.blendMode = 'add';
      this.fogLayer.addChild(s);
      this.fog.push({ s, v: 0.006 + Math.random() * 0.01, base: Math.random() });
    }
  }

  /** Called with the on-screen rectangle of the background texture. */
  setRect(x: number, y: number, w: number, h: number): void {
    this.rect = { x, y, w, h };
    this.placeLights();
  }

  setBackground(name: TextureName): void {
    this.bgName = name;
    this.lightLayer.removeChildren().forEach((c) => c.destroy());
    this.lights = (LIGHTS[name] ?? []).map((l, i) => {
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.tint = l.color;
      s.blendMode = 'add';
      this.lightLayer.addChild(s);
      return { s, l, seed: i * 1.7 };
    });
    this.placeLights();
  }

  private placeLights(): void {
    const { x, y, w, h } = this.rect;
    for (const { s, l } of this.lights) {
      s.position.set(x + l.x * w, y + l.y * h);
      s.width = s.height = l.r * w * 2.4;
    }
  }

  update(dt: number, screenW: number, screenH: number): void {
    this.t += dt;
    const t = this.t / 1000;
    for (const { s, l, seed } of this.lights) {
      const n = Math.sin(t * 9 + seed) * 0.5 + Math.sin(t * 23 + seed * 3) * 0.3 + Math.sin(t * 2.1 + seed) * 0.2;
      s.alpha = this.reduced ? l.alpha * 0.85 : l.alpha * (1 - l.flicker * 0.3 + n * l.flicker * 0.25);
    }
    // fog drifts across the lower third
    this.fog.forEach((f, i) => {
      const p = (f.base + t * f.v) % 1.4;
      f.s.width = screenW * 0.9;
      f.s.height = screenH * 0.28;
      f.s.position.set(-screenW * 0.4 + p * screenW * 1.4, screenH * (0.7 + 0.08 * i));
      f.s.alpha = this.reduced ? 0.06 : 0.07 + 0.04 * Math.sin(t * 0.4 + i);
    });
    if (this.reduced) {
      this.emberLayer.visible = this.batLayer.visible = false;
      return;
    }
    this.emberLayer.visible = this.batLayer.visible = true;
    this.updateEmbers(dt, screenW, screenH);
    this.updateBats(dt, screenW, screenH);
  }

  private updateEmbers(dt: number, w: number, h: number): void {
    const colors = EMBER_COLORS[this.bgName] ?? [0x7dffa8, 0xffd36a];
    while (this.embers.length < 36) {
      const s = new Sprite(glowTexture());
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.emberLayer.addChild(s);
      this.embers.push({ s, vx: 0, vy: 0, life: 1, max: 0, phase: 0 });
    }
    for (const e of this.embers) {
      if (e.life >= e.max) {
        e.s.position.set(Math.random() * w, h * (0.75 + Math.random() * 0.3));
        e.vx = (Math.random() - 0.5) * 0.02;
        e.vy = -(0.02 + Math.random() * 0.05);
        e.max = 3000 + Math.random() * 5000;
        e.life = 0;
        e.phase = Math.random() * 6;
        e.s.tint = colors[Math.floor(Math.random() * colors.length)];
        e.s.width = e.s.height = 6 + Math.random() * 10;
      }
      e.life += dt;
      e.s.x += (e.vx + Math.sin(this.t / 600 + e.phase) * 0.015) * dt;
      e.s.y += e.vy * dt;
      const p = e.life / e.max;
      e.s.alpha = Math.sin(p * Math.PI) * 0.8;
    }
  }

  private updateBats(dt: number, w: number, h: number): void {
    this.nextBats -= dt;
    if (this.nextBats <= 0 && this.bats.length === 0) {
      this.nextBats = 9000 + Math.random() * 14000;
      const fromLeft = Math.random() < 0.5;
      const n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const c = makeBat(26 + Math.random() * 22);
        c.position.set(fromLeft ? -60 - i * 50 : w + 60 + i * 50, h * (0.08 + Math.random() * 0.25));
        this.batLayer.addChild(c);
        const speed = 0.18 + Math.random() * 0.12;
        this.bats.push({ c, vx: fromLeft ? speed : -speed, vy: (Math.random() - 0.5) * 0.03, phase: Math.random() * 6, speed });
      }
    }
    for (let i = this.bats.length - 1; i >= 0; i--) {
      const b = this.bats[i];
      b.phase += dt * 0.02;
      b.c.x += b.vx * dt;
      b.c.y += (b.vy + Math.sin(b.phase * 0.3) * 0.04) * dt;
      for (const wing of b.c.wings ?? []) wing.scale.y = 0.35 + Math.abs(Math.sin(b.phase)) * 0.75;
      if (b.c.x < -200 || b.c.x > w + 200) {
        b.c.destroy({ children: true });
        this.bats.splice(i, 1);
      }
    }
  }
}

/** Logo with a gentle float, a glow pulse and a periodic shine sweep. */
export class AnimatedLogo extends Container {
  private art: Sprite;
  private glow: Sprite;
  private shine = new Graphics();
  private shineMask: Sprite;
  private t = 0;
  reduced = false;

  constructor(texture: Texture) {
    super();
    this.art = new Sprite(texture);
    this.glow = new Sprite(texture);
    this.shineMask = new Sprite(texture);
    for (const s of [this.art, this.glow, this.shineMask]) s.anchor.set(0.5, 0);
    this.glow.blendMode = 'add';
    this.glow.alpha = 0;
    this.shine.blendMode = 'add';
    this.shine.mask = this.shineMask;
    this.addChild(this.glow, this.art, this.shineMask, this.shine);
  }

  get artWidth(): number {
    return this.art.texture.width;
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t / 1000;
    if (this.reduced) {
      this.art.y = 0;
      this.glow.alpha = 0;
      this.shine.clear();
      return;
    }
    this.art.y = this.glow.y = this.shineMask.y = Math.sin(t * 1.3) * 8;
    this.glow.alpha = 0.12 + Math.sin(t * 2.2) * 0.1;
    this.glow.scale.set(1.01 + Math.sin(t * 2.2) * 0.008);
    // shine band crosses the logo every 6 seconds
    const cycle = (t % 6) / 1.2;
    this.shine.clear();
    if (cycle < 1) {
      const w = this.art.texture.width;
      const h = this.art.texture.height;
      const x = -w / 2 - 200 + cycle * (w + 400);
      this.shine.poly([x, this.art.y, x + 90, this.art.y, x - 60, this.art.y + h, x - 150, this.art.y + h]).fill({ color: 0xffffff, alpha: 0.35 });
    }
  }
}
