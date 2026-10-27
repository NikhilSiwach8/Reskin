// Plays a validated book's events on the scene and HUD. Presentation only: every amount
// shown comes from the book, and skipping or turbo never changes what is paid.
import { applyTumble, cellsOf, winningCells } from '../../engine/board.ts';
import { FREE_SPINS, LOOT_TIERS, SYMBOLS, WINCAP } from '../../engine/config.ts';
import type { Board, GameEvent, SymbolId } from '../../engine/types.ts';
import { bgSrc, panelSrc, symbolSrc } from '../assets.ts';
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

/** Lighter splashes for every win below Big Win. */
const SMALL_TIERS = [
  { min: 1, title: 'NICE WIN' },
  { min: 500, title: 'SWEET WIN' },
];

const WIN_TIERS = [
  { min: 1500, title: 'BIG WIN', art: 'win_big' },
  { min: 4000, title: 'MEGA WIN', art: 'win_mega' },
  { min: 10000, title: 'MONSTER WIN', art: 'win_monster' },
  { min: 50000, title: 'SUGAR SCREAM!', art: 'win_sugar' },
  { min: WINCAP, title: 'MAX WIN', art: 'win_max' },
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
    let freeTotal = 0;
    const fast = () => this.o.turbo() || this.skipping || this.o.hands();
    const autoMs = () => (this.o.hands() || this.o.turbo() || this.skipping ? 1600 : null);
    // bonus rounds celebrate every hit as it lands (each winning spin, Treat or Loot Box prize),
    // not the total at the end
    const perHit = events.some((ev) => ev.type === 'freeSpinsStart' || ev.type === 'trickOrTreat' || ev.type === 'lootBox');
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.type) {
        case 'reveal': {
          if (this.dropping) await this.dropping;
          else await this.scene.dropOut();
          this.dropping = null;
          this.board = e.board;
          this.hud.setTumble(null);
          await this.scene.dropIn(e.board, e.mults, e.phase === 'base' && !this.o.turbo() && !this.skipping);
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
          this.hud.messageWins(e.wins.map((w) => ({ src: symbolSrc(w.symbol), count: w.count, pay: this.o.fmt(w.pay) })));
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
          this.hud.message(`${this.o.fmt(e.base)} × ${e.mult} = ${this.o.fmt(e.base * e.mult)}`);
          await this.hud.banner(`x${e.mult}`, `${this.o.fmt(e.base)} × ${e.mult} = ${this.o.fmt(e.base * e.mult)}`, this.ms(1300));
          break;
        case 'win':
          this.hud.countWin(e.totalWin - e.amount, e.totalWin, this.o.fmt, this.o.reduced() ? 0 : this.ms(700));
          this.hud.message(`${freeKind ? 'Total win' : 'Win'} ${this.o.fmt(e.totalWin)}`);
          if (e.kind === 'scatter') await this.hud.banner('Lollipop Pay', this.o.fmt(e.amount), this.ms(1100));
          // one splash per spin once its tumble chain (and any multiplier) has finished
          if (perHit && e.kind === 'spin') await this.winSplash(e.amount);
          break;
        case 'trickOrTreat': {
          this.inFeature = true;
          await this.scene.pulseCells(e.cells, this.ms(900));
          await this.hud.banner('Trick or Treat!', '3 Skull Lollipops', this.ms(1300));
          await this.hud.enterDoor('tot', fast(), () => this.audio.setMusic('feature'));
          const knocks: KnockEvent[] = [];
          while (events[i + 1]?.type === 'knock') knocks.push(events[++i] as KnockEvent);
          // only autoplay and replays pick by themselves; turbo just plays the reveals faster
          await this.hud.trickOrTreat(knocks, this.o.fmt, this.o.hands(), autoMs() !== null, async (k) => {
            this.audio.play('knock');
            setTimeout(() => this.audio.play(k.prize === 'treat' ? 'treat' : k.prize === 'trick' ? 'boo' : 'lollipop'), 250);
            if (k.prize === 'treat') await this.winSplash(k.amount);
          });
          this.inFeature = false;
          break;
        }
        case 'trickOrTreatEnd':
          if (e.lollipop) await this.hud.banner('Golden Lollipop!', 'Haunted Cauldron free spins', this.ms(1600));
          else await this.hud.exitDoor(fast(), () => this.audio.setMusic('base'));
          break;
        case 'freeSpinsStart': {
          this.inFeature = true;
          freeKind = e.kind;
          const def = FREE_SPINS[e.kind];
          void this.scene.shake(600, 14);
          await this.scene.pulseCells(e.cells, this.ms(900));
          this.audio.play('bonus');
          freeTotal = e.spins;
          const sub = e.kind === 'fullMoon'
            ? `Congratulations!\nYou have won ${e.spins} free spins\nThe Cauldron starts at x${e.cauldron} and every Jack-o'-Lantern counts double.`
            : `Congratulations!\nYou have won ${e.spins} free spins\nJack-o'-Lanterns on winning spins fill the Cauldron, which multiplies every later win.`;
          this.hud.message(`${def.name}: ${e.spins} free spins`);
          await this.hud.enterDoor(e.kind === 'fullMoon' ? 'fullmoon' : 'cauldron', fast(), () => {
            this.scene.setMode(e.kind);
            this.audio.setMusic(e.kind === 'fullMoon' ? 'fullMoon' : 'free');
          });
          await this.hud.splash(def.name, sub, 'Start', autoMs(), bgSrc(e.kind === 'fullMoon' ? 'fs_fullmoon' : 'fs_cauldron'));
          this.hud.showFree(def.name, 0, e.spins);
          this.hud.setCauldron(e.cauldron);
          break;
        }
        case 'freeSpin':
          freeTotal = e.total;
          this.hud.showFree(FREE_SPINS[freeKind ?? 'cauldron'].name, e.index, e.total);
          break;
        case 'retrigger':
          this.audio.play('retrigger');
          void this.scene.shake(400, 8);
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
          this.audio.sting('end');
          await this.hud.splash('Congratulations!', `You have won\n${this.o.fmt(e.featureWin)}\nin ${freeTotal} free spins`, 'Collect', autoMs(), bgSrc('feature_end'));
          freeKind = null;
          await this.hud.exitDoor(fast(), () => {
            this.scene.setMode('base');
            this.audio.setMusic('base');
          });
          this.hud.hideFree();
          this.hud.setTumble(null);
          this.inFeature = false;
          break;
        case 'wincap':
          this.audio.play('bigWin');
          this.audio.sting('bigwin');
          void this.scene.shake(900, 18);
          await this.hud.banner('MAX WIN', this.o.fmt(e.totalWin), this.ms(1800));
          break;
        case 'lootBox': {
          // a bought Loot Box has no board: bring the old board back first
          if (this.dropping) {
            await this.dropping;
            this.dropping = null;
            await this.scene.dropIn(this.board, []);
          }
          this.inFeature = true;
          this.audio.play('bonus');
          void this.scene.shake(500, 10);
          await this.hud.banner('Loot Box!', 'Open a box', this.ms(1300), panelSrc('loot_trigger'));
          await this.hud.enterDoor('loot', fast(), () => this.audio.setMusic('feature'));
          const t = LOOT_TIERS[e.tier];
          await this.hud.lootBox(e.boxes, {
            title: t.name,
            art: panelSrc(`win_${e.tier}`),
            mult: `x${e.multiplier.toLocaleString('en-US')}`,
            amount: this.o.fmt(Math.min(WINCAP, e.multiplier * 100)),
          }, this.o.hands(), autoMs() !== null, () => this.audio.play('knock'));
          this.audio.play('bigWin');
          this.audio.sting('bigwin');
          await this.hud.exitDoor(fast(), () => this.audio.setMusic('base'));
          this.inFeature = false;
          break;
        }
        case 'finalWin':
          this.scene.undim();
          if (e.amount > 0) {
            this.hud.message(`Win ${this.o.fmt(e.amount)}`);
            // bonus rounds already celebrated each hit (and showed the bonus total screen)
            if (!perHit) await this.winSplash(e.amount);
          }
          break;
      }
    }
    // a round always ends back in the base game
    this.audio.setMusic('base');
  }

  /**
   * Win splash for one hit (a round, or in a bonus each winning spin or Treat): the tiers the
   * win reached punch in one after another, then the amount appears at once. Wins below Big
   * Win get the lighter Nice / Sweet splash.
   */
  private async winSplash(amount: number): Promise<void> {
    const fast = this.o.turbo() || this.skipping || this.o.hands();
    const x = `${(amount / 100).toLocaleString('en-US')}x`;
    const big = WIN_TIERS.filter((tier) => amount >= tier.min);
    if (!big.length) {
      const small = [...SMALL_TIERS].reverse().find((tier) => amount >= tier.min) ?? SMALL_TIERS[0];
      this.audio.play('win');
      await this.hud.winSplash([{ title: small.title }], this.o.fmt(amount), x, { tierMs: fast ? 250 : 450, holdMs: fast ? 550 : 1000, mini: true });
      return;
    }
    this.audio.play('bigWin');
    this.audio.sting('bigwin');
    const tiers = big.map((tier) => ({ title: tier.title, art: panelSrc(tier.art) }));
    await this.hud.winSplash(tiers, this.o.fmt(amount), x, { tierMs: fast ? 450 : 900, holdMs: fast ? 1100 : 2200, fountain: true });
  }
}
