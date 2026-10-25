// Random jump scares. Purely cosmetic presentation: they are chosen with Math.random on the
// client, never depend on or hint at an outcome, never delay a round, and can be turned off.
// They are suppressed with reduced motion, in turbo, during features and in replay mode.
import { Container, Graphics, Sprite } from 'pixi.js';
import type { Audio } from '../audio.ts';
import { tex } from '../assets.ts';
import { glowTexture, makeBat } from './ambience.ts';
import type { Stage } from './stage.ts';
import { ease } from './tween.ts';

export type ScareVariant = 'lunge' | 'eyes' | 'bats';

const COOLDOWN_MS = 75_000;
const SPIN_CHANCE = 1 / 22;
const IDLE_MIN_MS = 25_000;
const IDLE_MAX_MS = 60_000;
const IDLE_CHANCE = 0.45;

export class Scares {
  enabled = true;
  /** Returns false while scares must not play (feature, turbo, reduced motion, replay, modal...). */
  allowed: () => boolean = () => true;
  /** Extra condition for idle scares (no round in progress). */
  idleAllowed: () => boolean = () => true;
  private stage: Stage;
  private audio: Audio;
  private last = -COOLDOWN_MS;
  private playing = false;
  private idleTimer = 0;

  constructor(stage: Stage, audio: Audio) {
    this.stage = stage;
    this.audio = audio;
  }

  private ready(): boolean {
    return this.enabled && !this.playing && performance.now() - this.last > COOLDOWN_MS && this.allowed();
  }

  /** Called when a base-game spin starts. Never awaited by the spin. */
  onSpin(): void {
    this.armIdle();
    if (this.ready() && Math.random() < SPIN_CHANCE) void this.play();
  }

  /** (Re)arms the idle timer; a scare may play after the player has been idle for a while. */
  armIdle(): void {
    clearTimeout(this.idleTimer);
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    this.idleTimer = window.setTimeout(() => {
      if (this.ready() && this.idleAllowed() && Math.random() < IDLE_CHANCE) void this.play();
      this.armIdle();
    }, delay);
  }

  async play(variant?: ScareVariant): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    this.last = performance.now();
    const v = variant ?? (['lunge', 'eyes', 'bats'] as const)[Math.floor(Math.random() * 3)];
    const layer = new Container();
    layer.eventMode = 'none';
    this.stage.overlay.addChild(layer);
    try {
      if (v === 'lunge') await this.lunge(layer);
      else if (v === 'eyes') await this.eyes(layer);
      else await this.bats(layer);
    } finally {
      layer.destroy({ children: true });
      this.playing = false;
    }
  }

  private get size() {
    return { w: this.stage.app.screen.width, h: this.stage.app.screen.height };
  }

  private shade(layer: Container, alpha: number): Graphics {
    const { w, h } = this.size;
    const g = new Graphics().rect(0, 0, w, h).fill(0x000000);
    g.alpha = alpha;
    layer.addChild(g);
    return g;
  }

  private run(ms: number, fn: (p: number) => void, easing = ease.outCubic): Promise<void> {
    // Scares run in real time (not affected by turbo or slam stop).
    return new Promise((resolve) => {
      const start = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - start) / ms);
        fn(easing(p));
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** The Phantom rushes out of the dark straight at the player. */
  private async lunge(layer: Container): Promise<void> {
    const { w, h } = this.size;
    const dark = this.shade(layer, 0);
    const ghost = new Sprite(tex('fx_phantom'));
    ghost.anchor.set(0.5);
    ghost.position.set(w / 2, h / 2);
    ghost.alpha = 0;
    const eyes = new Sprite(glowTexture());
    eyes.anchor.set(0.5);
    eyes.tint = 0x7dffa8;
    eyes.blendMode = 'add';
    layer.addChild(ghost, eyes);
    const base = Math.min(w, h) / 1024;
    this.audio.play('whisper');
    await this.run(350, (p) => (dark.alpha = p * 0.8));
    this.audio.play('scare');
    await this.run(420, (p) => {
      ghost.alpha = Math.min(1, p * 2);
      ghost.scale.set(base * (0.4 + p * 2.6));
      ghost.position.set(w / 2 + (Math.random() - 0.5) * 18 * p, h / 2 + (Math.random() - 0.5) * 18 * p);
      eyes.position.set(ghost.x, ghost.y - ghost.height * 0.06);
      eyes.width = eyes.height = ghost.width * 0.5;
      eyes.alpha = p * 0.6;
    }, ease.inQuad);
    void this.stage.shake(16, 380);
    await this.run(500, (p) => {
      layer.alpha = 1 - p;
    }, ease.inQuad);
  }

  /** The lights go out and glowing eyes open all around, then one pair lunges. */
  private async eyes(layer: Container): Promise<void> {
    const { w, h } = this.size;
    const dark = this.shade(layer, 0);
    this.audio.play('whisper');
    await this.run(450, (p) => (dark.alpha = p * 0.92));
    const pairs: Container[] = [];
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const pair = new Container();
      const s = (18 + Math.random() * 28) * Math.min(w, h) / 800;
      const color = Math.random() < 0.7 ? 0x7dffa8 : 0xb48cff;
      for (const dx of [-1, 1]) {
        const e = new Sprite(glowTexture());
        e.anchor.set(0.5);
        e.tint = color;
        e.blendMode = 'add';
        e.width = s;
        e.height = s * 0.55;
        e.x = dx * s * 0.75;
        pair.addChild(e);
      }
      pair.position.set(w * (0.08 + Math.random() * 0.84), h * (0.1 + Math.random() * 0.75));
      pair.alpha = 0;
      layer.addChild(pair);
      pairs.push(pair);
    }
    // eyes open one by one and blink
    await this.run(1100, (p) => {
      pairs.forEach((pr, i) => {
        const open = Math.max(0, Math.min(1, p * n - i * 0.6));
        const blink = Math.sin(p * 20 + i) > 0.92 ? 0.1 : 1;
        pr.alpha = open;
        pr.scale.y = blink;
      });
    }, ease.linear);
    const lead = pairs[Math.floor(Math.random() * pairs.length)];
    this.audio.play('scare');
    const sx = lead.x, sy = lead.y;
    await this.run(320, (p) => {
      lead.scale.set(1 + p * 9);
      lead.position.set(sx + (w / 2 - sx) * p, sy + (h / 2 - sy) * p);
    }, ease.inQuad);
    void this.stage.shake(12, 300);
    await this.run(450, (p) => (layer.alpha = 1 - p), ease.inQuad);
  }

  /** A swarm of bats bursts across the screen. */
  private async bats(layer: Container): Promise<void> {
    const { w, h } = this.size;
    const dark = this.shade(layer, 0);
    const fromLeft = Math.random() < 0.5;
    const swarm = Array.from({ length: 34 }, () => {
      const b = makeBat((40 + Math.random() * 90) * Math.min(w, h) / 800) as Container & { wings: Graphics[] };
      const y = h * (0.05 + Math.random() * 0.9);
      const delay = Math.random() * 0.35;
      const speed = 0.8 + Math.random() * 0.6;
      const wobble = Math.random() * 6;
      layer.addChild(b);
      return { b, y, delay, speed, wobble };
    });
    this.audio.play('screech');
    await this.run(1400, (p) => {
      dark.alpha = Math.sin(p * Math.PI) * 0.45;
      for (const s of swarm) {
        const q = Math.max(0, (p - s.delay) / (1 - s.delay)) * s.speed;
        const x = fromLeft ? -200 + q * (w + 400) : w + 200 - q * (w + 400);
        s.b.position.set(x, s.y + Math.sin(q * 12 + s.wobble) * 30);
        s.b.scale.x = fromLeft ? 1 : -1;
        for (const wing of s.b.wings) wing.scale.y = 0.3 + Math.abs(Math.sin(q * 40 + s.wobble)) * 0.8;
      }
    }, ease.linear);
  }
}
