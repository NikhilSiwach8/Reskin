// Plays a validated book's events on the scene and HUD. Presentation only: every amount
// shown comes from the book, and skipping or turbo never changes what is paid.
import { applyTumble, cellsOf, winningCells } from '../../engine/board.ts';
import { FREE_SPINS, SYMBOLS } from '../../engine/config.ts';
import type { Board, GameEvent, SymbolId } from '../../engine/types.ts';
import { bgSrc } from '../assets.ts';
import type { Audio } from '../audio.ts';
import { Hud, wait, type KnockEvent } from '../hud.ts';
import { t } from '../text.ts';
import type { Scene } from './scene.ts';

export interface PlayerOptions {
  /** Formats a centi-bet amount as money for the current round bet. */
  fmt: (centi: number) => string;
  turbo: () => boolean;
  reduced: () => boolean;
  /** Autoplay or replay: dialogs continue by themselves. */
  hands: () => boolean;
}

const WIN_TIERS = [
  { min: 2000, title: 'BIG WIN' },
  { min: 5000, title: 'MEGA WIN' },
  { min: 25000, title: 'MONSTER WIN' },
  { min: 100000, title: 'SUGAR SCREAM!' },
];

export class Player {
  inFeature = false;
  private skipping = false;
  private dropping: Promise<void> | null = null;
  private board: Board;
  private readonly scene: Scene;
  private readonly hud: Hud;
  private readonly audio: Audio;
  private readonly o: PlayerOptions;

  constructor(scene: Scene, hud: Hud, audio: Audio, o: PlayerOptions, board: Board) {
    this.scene = scene;
    this.hud = hud;
    this.audio = audio;
    this.o = o;
    this.board = board;
  }

  private get speed(): number {
    return (this.o.turbo() ? 2.2 : 1) * (this.skipping ? 6 : 1);
  }

  private ms(v: number): number {
    return v / this.speed;
  }

  private syncSpeed(): void {
    this.scene.tween.speed = this.speed;
  }

  /** Called on the spin press, before the RGS answers: the old board falls away. */
  startSpin(): void {
    this.skipping = false;
    this.syncSpeed();
    this.audio.play('drop');
    this.dropping = this.scene.dropOut();
  }

  /** The request failed: bring the previous board back. */
  async abortSpin(): Promise<void> {
    await this.dropping;
    this.dropping = null;
    await this.scene.dropIn(this.board, []);
  }

  /** Slam stop: everything still to come plays much faster. */
  skip(): void {
    this.skipping = true;
    this.syncSpeed();
    this.scene.tween.finishAll();
  }

  async play(events: GameEvent[]): Promise<void> {
    this.syncSpeed();
    let lastWin: SymbolId[] = [];
    let freeKind: keyof typeof FREE_SPINS | null = null;
    const autoMs = () => (this.o.hands() || this.o.turbo() || this.skipping ? 1600 : null);
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.type) {
        case 'reveal': {
          if (this.dropping) await this.dropping;
          else await this.scene.dropOut();
          this.dropping = null;
          this.board = e.board;
          this.hud.setTumble(null);
          await this.scene.dropIn(e.board, e.mults);
          this.audio.play('land');
          const sc = cellsOf(e.board, 'SC');
          if (sc.length >= 3) {
            this.audio.play('scatter');
            await this.scene.pulseCells(sc, this.ms(500));
          }
          break;
        }
        case 'witchSpell':
          this.audio.play('spell');
          void this.hud.banner("Witch's Spell!", t(`${SYMBOLS[e.symbol].name} conjured`), this.ms(1600));
          await this.scene.spell(e.cells, e.symbol);
          this.board = e.board;
          break;
        case 'tumbleWin': {
          lastWin = e.wins.map((w) => w.symbol);
          this.audio.play('win');
          const jobs = e.wins.map((w) => {
            const cells = cellsOf(this.board, w.symbol);
            const c = this.scene.centroid(cells);
            return this.scene.floatText(this.o.fmt(w.pay), c.x, c.y);
          });
          await Promise.all([this.scene.highlight(winningCells(this.board, lastWin)), ...jobs.slice(0, 1)]);
          this.hud.setTumble(this.o.fmt(e.tumbleTotal));
          break;
        }
        case 'tumble': {
          const removed = winningCells(this.board, lastWin);
          this.scene.undim();
          this.audio.play('pop');
          await this.scene.explode(removed);
          const next = applyTumble(this.board, lastWin, e.fill);
          if (!next) throw new Error('tumble does not match the board');
          this.board = next;
          await this.scene.collapse(removed, next, e.mults);
          this.audio.play('land');
          break;
        }
        case 'multiplier':
          if (e.cells.length) {
            this.audio.play('mult');
            const p = this.hud.cauldronPoint();
            await this.scene.flingMults(e.cells, p.x || p.y ? this.scene.fromScreen(p.x, p.y) : this.scene.center);
          }
          await this.hud.banner(`x${e.mult}`, `${this.o.fmt(e.base)} × ${e.mult} = ${this.o.fmt(e.base * e.mult)}`, this.ms(1300));
          break;
        case 'win':
          this.hud.setWin(this.o.fmt(e.totalWin));
          if (e.kind === 'scatter') await this.hud.banner('Lollipop Pay', this.o.fmt(e.amount), this.ms(1100));
          break;
        case 'trickOrTreat': {
          this.inFeature = true;
          await this.scene.pulseCells(e.cells, this.ms(900));
          await this.hud.banner('Trick or Treat!', '3 Skull Lollipops', this.ms(1300));
          const knocks: KnockEvent[] = [];
          while (events[i + 1]?.type === 'knock') knocks.push(events[++i] as KnockEvent);
          await this.hud.trickOrTreat(knocks, this.o.fmt, autoMs() !== null, (k) => {
            this.audio.play('knock');
            setTimeout(() => this.audio.play(k.prize === 'treat' ? 'treat' : k.prize === 'trick' ? 'boo' : 'lollipop'), 250);
          });
          this.inFeature = false;
          break;
        }
        case 'trickOrTreatEnd':
          if (e.lollipop) await this.hud.banner('Golden Lollipop!', 'Haunted Cauldron free spins', this.ms(1600));
          break;
        case 'freeSpinsStart': {
          this.inFeature = true;
          freeKind = e.kind;
          const def = FREE_SPINS[e.kind];
          await this.scene.pulseCells(e.cells, this.ms(900));
          this.audio.play('bonus');
          const sub = e.kind === 'fullMoon'
            ? `${e.spins} free spins\nThe Cauldron starts at x${e.cauldron} and every Jack-o'-Lantern counts double.`
            : `${e.spins} free spins\nJack-o'-Lanterns on winning spins fill the Cauldron, which multiplies every later win.`;
          await this.hud.splash(def.name, sub, 'Start', autoMs(), bgSrc(e.kind === 'fullMoon' ? 'fs_fullmoon' : 'fs_cauldron'));
          this.scene.setMode(e.kind);
          this.hud.showFree(def.name, 0, e.spins);
          this.hud.setCauldron(e.cauldron);
          break;
        }
        case 'freeSpin':
          this.hud.showFree(FREE_SPINS[freeKind ?? 'cauldron'].name, e.index, e.total);
          break;
        case 'retrigger':
          this.audio.play('retrigger');
          await this.scene.pulseCells(e.cells, this.ms(700));
          await this.hud.banner(`+${e.added} Free Spins`, '', this.ms(1300));
          break;
        case 'cauldron':
          this.audio.play('cauldron');
          this.hud.setCauldron(e.value, true);
          await wait(this.ms(350));
          break;
        case 'freeSpinsEnd':
          this.audio.play('end');
          await this.hud.splash(`${FREE_SPINS[e.kind].name} complete`, `Feature win\n${this.o.fmt(e.featureWin)}`, 'Collect', autoMs(), bgSrc('feature_end'));
          this.scene.setMode('base');
          this.hud.hideFree();
          this.hud.setTumble(null);
          this.inFeature = false;
          break;
        case 'wincap':
          this.audio.play('bigWin');
          await this.hud.banner('MAX WIN', this.o.fmt(e.totalWin), this.ms(1800));
          break;
        case 'finalWin':
          this.scene.undim();
          if (e.amount >= WIN_TIERS[0].min) await this.bigWin(e.amount);
          break;
      }
    }
  }

  private async bigWin(amount: number): Promise<void> {
    this.audio.play('bigWin');
    const reached = WIN_TIERS.filter((tier) => amount >= tier.min);
    const tiers = reached.map((tier, i) => ({ title: tier.title, until: (i + 1) / reached.length }));
    const ms = this.o.turbo() || this.skipping ? 1200 : 1800 + reached.length * 1100;
    await this.hud.winScreen(tiers, (p) => this.o.fmt(Math.round(amount * (1 - (1 - p) ** 2))), `${(amount / 100).toLocaleString('en-US')}x`, ms);
  }

}
