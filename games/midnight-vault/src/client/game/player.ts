// Replays a book's events. The book (from the RGS) is the authoritative outcome; the player
// only presents it. Every board shown comes from an event, never from client-side logic.
import { Graphics } from 'pixi.js';
import { REELS, ROWS } from '../../engine/config.ts';
import type { BonusPath, Cell, GameEvent, LedgerState, SealId, SymbolId } from '../../engine/types.ts';
import type { Audio } from '../audio.ts';
import { tex, type TextureName } from '../assets.ts';
import type { Hud } from '../ui/hud.ts';
import { FEATURE_NAMES } from '../ui/text.ts';
import { CELL } from './reels.ts';
import type { Stage } from './stage.ts';
import { ease } from './tween.ts';

export interface PlayContext {
  /** Formats a centi-bet amount as money at the current bet. */
  fmt: (centi: number) => string;
  turbo: () => boolean;
  reduced: () => boolean;
  /** True while autoplay runs (splash screens then continue sooner). */
  autoplay: () => boolean;
}

const SPLASH: Record<BonusPath, { art: string; background: string; desc: string }> = {
  cursedFortune: {
    art: 'assets/key_cursed_fortune.webp', background: 'assets/bg_cursed_fortune.webp',
    desc: 'More Cursed Relics with multipliers up to 100x. Every Relic and Ledger charges Relic Overload for bigger expansions.',
  },
  phantomPayday: {
    art: 'assets/key_phantom_payday.webp', background: 'assets/bg_phantom_payday.webp',
    desc: 'Every Phantom that lands transforms symbols. Fill the Phantom Seal and the Phantom starts creating wilds.',
  },
  midnightCountdown: {
    art: 'assets/key_midnight_countdown.webp', background: 'assets/bg_midnight_countdown.webp',
    desc: 'Every Clock and Ledger moves the hand. When it strikes XIII, a Final Countdown Spin brings a 4x4 Relic Surge.',
  },
  vaultBreach: {
    art: 'assets/fx_vault_door.webp', background: 'assets/bg_final_heist.webp',
    desc: 'Four stages: The Seal Breaks, The Haunting, Relic Overload and The Final Heist.',
  },
};

const PATH_BG: Record<BonusPath, TextureName> = {
  cursedFortune: 'bg_cursed_fortune',
  phantomPayday: 'bg_phantom_payday',
  midnightCountdown: 'bg_midnight_countdown',
  vaultBreach: 'bg_final_heist',
};

const ACTIVE_SEALS: Record<BonusPath, SealId[]> = {
  cursedFortune: ['relic'],
  phantomPayday: ['phantom'],
  midnightCountdown: ['clock'],
  vaultBreach: ['relic', 'phantom', 'clock'],
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
const SPECIAL: SymbolId[] = ['RL', 'VK', 'VD', 'PH', 'CL', 'EL'];

export class Player {
  private stage: Stage;
  private hud: Hud;
  private audio: Audio;
  private ctx: PlayContext;
  private blackout = new Graphics();
  private total = 0;
  private bonusWin = 0;
  private path: BonusPath | null = null;
  private inSequence = false;
  private reelsSpinning = false;

  constructor(stage: Stage, hud: Hud, audio: Audio, ctx: PlayContext) {
    this.stage = stage;
    this.hud = hud;
    this.audio = audio;
    this.ctx = ctx;
    this.blackout.rect(0, 0, CELL * REELS, CELL * ROWS).fill(0x000000);
    this.blackout.alpha = 0;
    stage.gridLayer.addChild(this.blackout);
  }

  private get turbo(): boolean {
    return this.ctx.turbo();
  }

  private ms(normal: number, turbo = normal * 0.35): number {
    return this.turbo ? turbo : normal;
  }

  /** Starts the base-game spin animation before the RGS answers (pure presentation). */
  startSpin(): void {
    this.stage.wins.clear();
    this.stage.relics.clear();
    this.stage.props.clearChains();
    this.stage.reels.start({ turbo: this.turbo });
    this.reelsSpinning = true;
    this.audio.play('spin');
  }

  /** Stops a spin that started before an RGS error, restoring the previous board. */
  async abortSpin(): Promise<void> {
    if (!this.reelsSpinning) return;
    await this.stage.reels.stop(this.stage.reels.board, { turbo: true });
    this.reelsSpinning = false;
  }

  /** Slam stop / skip: completes running animations immediately. */
  skip(): void {
    this.stage.tweener.finishAll();
  }

  async play(events: GameEvent[]): Promise<void> {
    this.total = 0;
    this.bonusWin = 0;
    this.path = null;
    this.inSequence = false;
    for (const e of events) {
      await this.handle(e);
    }
    this.reelsSpinning = false;
  }

  private async handle(e: GameEvent): Promise<void> {
    const { stage, hud, audio } = this;
    switch (e.type) {
      case 'reveal': {
        if (!this.reelsSpinning) {
          stage.wins.clear();
          stage.relics.clear();
          stage.props.clearChains();
          stage.reels.start({ turbo: this.turbo });
          audio.play('spin');
          await stage.tweener.wait(this.ms(420, 120));
        }
        if (e.blackout && !this.ctx.reduced()) await stage.tweener.to(this.blackout, { alpha: 0.92 }, this.ms(450, 150));
        await stage.reels.stop(e.board, {
          turbo: this.turbo,
          anticipation: e.anticipation,
          onReelStop: (reel) => {
            audio.play('reelStop');
            if (e.board[reel].some((s) => SPECIAL.includes(s))) {
              const special = e.board[reel].find((s) => s === 'RL' || s === 'VK');
              audio.play(special === 'RL' ? 'relic' : special === 'VK' ? 'keys' : 'land');
              e.board[reel].forEach((s, row) => {
                if (s === 'RL' || s === 'VK') stage.particles.burst(reel * CELL + CELL / 2, row * CELL + CELL / 2, 8, tex('fx_spark'), { speed: 0.3, scale: 0.3 });
              });
            }
          },
        });
        this.reelsSpinning = false;
        if (e.blackout) await stage.tweener.to(this.blackout, { alpha: 0 }, this.ms(450, 150));
        break;
      }

      case 'relicExpand': {
        const grows = e.blocks.some((b) => b.size > 1);
        if (grows) audio.play('expand');
        await Promise.all(e.blocks.map((b) => stage.relics.show(b, { reduced: this.ctx.reduced(), turbo: this.turbo })));
        for (const b of e.blocks) for (const c of b.absorbed) stage.particles.burst(c.reel * CELL + CELL / 2, c.row * CELL + CELL / 2, 10, tex('fx_spark'), { speed: 0.4, scale: 0.35 });
        if (grows && !this.turbo) void stage.shake(6, 250);
        stage.reels.board = e.board.map((c) => [...c]);
        break;
      }

      case 'relicSurge': {
        audio.play('surge');
        const b = e.block;
        stage.props.shockwave(b.reel * CELL + (b.size * CELL) / 2, b.row * CELL + (b.size * CELL) / 2, 0x7dffa8);
        await stage.relics.show(b, { surge: true, reduced: this.ctx.reduced(), turbo: this.turbo });
        void stage.shake(10, 350);
        stage.reels.board = e.board.map((c) => [...c]);
        break;
      }

      case 'featureTrigger': {
        await this.pulseCells(e.cells);
        if (e.feature === 'phantomHeist' && this.path) break; // part of Phantom Payday spins
        audio.play(e.feature === 'threeKeys' || e.feature === 'vaultBreach' ? 'keys' : 'land');
        const sub = e.feature === 'threeKeys' || e.feature === 'vaultBreach' ? `${e.cells.length} Vault Keys` : '';
        if (['lockdown', 'phantomHeist', 'spectralRespin', 'thirteenthHour'].includes(e.feature)) {
          this.inSequence = true;
          hud.showFeature(FEATURE_NAMES[e.feature]);
          hud.setBonusWin(this.ctx.fmt(0));
          if (e.feature !== 'thirteenthHour') document.querySelector<HTMLElement>('.fp-spins')!.hidden = true;
        }
        await hud.banner(FEATURE_NAMES[e.feature], sub, this.ms(1500, 700));
        break;
      }

      case 'phantomHeist': {
        audio.play('phantom');
        await stage.props.phantomSweep(e.cells, this.turbo);
        for (const c of e.cells) {
          if (e.target === 'RL') {
            void stage.relics.show({ id: 0, reel: c.reel, row: c.row, size: 1, mult: e.mult ?? 1, origin: c }, { turbo: this.turbo });
          } else {
            stage.reels.setCells([c], e.board);
          }
          stage.particles.burst(c.reel * CELL + CELL / 2, c.row * CELL + CELL / 2, 8, tex('fx_wisp'), { speed: 0.25, scale: 0.5 });
          audio.play('transform');
          await stage.tweener.wait(this.ms(70, 20));
        }
        stage.reels.board = e.board.map((c) => [...c]);
        await stage.props.phantomExit(this.turbo);
        break;
      }

      case 'lockdownStart': {
        audio.play('door');
        audio.play('chain');
        for (const r of e.lockedReels) stage.props.lockReel(r);
        hud.setRespins(e.respins);
        void stage.shake(10, 350);
        await stage.tweener.wait(this.ms(600, 200));
        break;
      }

      case 'lockdownRespin': {
        const prevLocked = new Set(e.lockedReels.filter((r) => !e.newLocks.includes(r)));
        const spinning = [0, 1, 2, 3, 4].filter((r) => !prevLocked.has(r));
        stage.relics.clearReels(spinning);
        stage.wins.clear();
        stage.reels.start({ reels: spinning, turbo: this.turbo });
        audio.play('spin');
        await stage.tweener.wait(this.ms(320, 100));
        await stage.reels.stop(e.board, { reels: spinning, turbo: this.turbo, onReelStop: () => audio.play('reelStop') });
        for (const r of e.newLocks) {
          stage.props.lockReel(r);
          audio.play('chain');
        }
        hud.setRespins(e.respinsLeft);
        await stage.tweener.wait(this.ms(250, 80));
        break;
      }

      case 'lockdownEnd': {
        audio.play('chain');
        await stage.props.breakChains();
        hud.setRespins(null);
        break;
      }

      case 'doorsOpen': {
        audio.play('door');
        for (const c of e.cells) stage.props.shockwave(c.reel * CELL + CELL / 2, c.row * CELL + CELL / 2, 0x7dffa8);
        stage.reels.setCells(e.cells, e.board);
        void stage.shake(8, 300);
        await stage.tweener.wait(this.ms(500, 150));
        break;
      }

      case 'spectralRespin': {
        await this.pulseCells(e.held);
        audio.play('spin');
        await stage.reels.respinCells(e.board, e.held, this.turbo);
        break;
      }

      case 'clockStart': {
        const spot = stage.clockSpot();
        stage.props.showClock(e.hour, spot.x, spot.y, spot.size);
        hud.setHour(e.hour);
        break;
      }

      case 'clockAdvance': {
        audio.play('tick');
        void this.pulseCells(e.cells);
        await stage.props.advanceClock(e.hour);
        hud.setHour(e.hour);
        break;
      }

      case 'clockStrike': {
        audio.play('strike');
        await stage.props.strikeClock(this.ctx.reduced());
        hud.setHour(e.hour);
        await hud.banner('The clock strikes XIII', `Relic Surge ${e.surgeSize}x${e.surgeSize}`, this.ms(1300, 600));
        break;
      }

      case 'overload': {
        if (e.levelUp) {
          audio.play('surge');
          stage.props.shockwave((CELL * REELS) / 2, (CELL * ROWS) / 2, 0x7dffa8);
          await hud.banner('Relic Overload', `Level ${e.level}`, this.ms(1000, 450));
        }
        break;
      }

      case 'ledger': {
        if (!this.path) break;
        hud.setLedger(e.seals as LedgerState, ACTIVE_SEALS[this.path], (p) =>
          this.path === 'vaultBreach' ? `Stage ${p} / 4` : `Hour ${ROMAN[9 + p] ?? p}${e.seals.clock.level ? ` · ${e.seals.clock.level} strike${e.seals.clock.level > 1 ? 's' : ''}` : ''}`,
        );
        break;
      }

      case 'bonusPath': {
        this.path = e.path;
        this.inSequence = true;
        this.bonusWin = 0;
        audio.play('bonusEnter');
        if (e.path !== 'vaultBreach') {
          await hud.keysChoice(e.path, this.turbo);
          await stage.setBackground(PATH_BG[e.path]);
        }
        hud.showFeature(FEATURE_NAMES[e.path]);
        hud.setSpins(0, e.spins);
        hud.setBonusWin(this.ctx.fmt(0));
        hud.setHour(e.path === 'midnightCountdown' ? 9 : null);
        if (e.path === 'midnightCountdown') {
          const spot = stage.clockSpot();
          stage.props.showClock(9, spot.x, spot.y, spot.size);
        }
        audio.play('splash');
        await hud.bonusSplash({
          theme: e.path,
          ...SPLASH[e.path],
          kicker: e.path === 'vaultBreach' ? 'The vault is open' : 'Bonus unlocked',
          title: FEATURE_NAMES[e.path],
          value: e.path === 'vaultBreach' ? `${e.spins} spins in 4 stages` : `${e.spins} free spins`,
          button: 'Start',
          autoMs: this.splashMs(),
        });
        break;
      }

      case 'freeSpin': {
        hud.setSpins(e.index, e.total, e.label === 'Thirteenth Hour' ? 'Special spins' : undefined);
        if (e.label === 'Final Countdown') await hud.banner('Final Countdown Spin', '', this.ms(900, 400));
        await stage.tweener.wait(this.ms(250, 60));
        break;
      }

      case 'retrigger': {
        audio.play('retrigger');
        await this.pulseCells(e.cells);
        await hud.banner(`+${e.added} Free Spins`, '', this.ms(1200, 500));
        break;
      }

      case 'breachStage': {
        if (e.stage === 1) {
          await hud.banner('The Vault Breach', 'The Seal Breaks', this.ms(1600, 700));
          audio.play('door');
          await stage.props.openVault(this.ctx.reduced());
          await stage.setBackground('bg_final_heist');
        } else {
          await hud.banner(e.name, e.spins > 1 ? `${e.spins} spins` : '', this.ms(1300, 550));
        }
        break;
      }

      case 'winInfo': {
        const prev = this.total;
        this.total = e.totalWin;
        if (this.inSequence) {
          this.bonusWin += e.spinWin;
          hud.setBonusWin(this.ctx.fmt(this.bonusWin));
        }
        const big = e.spinWin >= 2000;
        audio.play(big ? 'bigWin' : 'win');
        const counting = this.countWin(prev, this.total, big ? 1600 : 500);
        await stage.wins.present(e.wins, this.ctx.fmt, { turbo: this.turbo, relics: stage.relics });
        if (big) await this.bigWin(e.spinWin);
        await counting;
        break;
      }

      case 'featureEnd': {
        const name = FEATURE_NAMES[e.feature] ?? e.feature;
        stage.wins.clear();
        if (this.path) {
          // Full-screen outro with the bonus total counting up.
          audio.play('bonusEnd');
          const total = e.featureWin;
          await hud.bonusSplash({
            theme: this.path,
            ...SPLASH[this.path],
            kicker: 'Bonus complete',
            title: name,
            value: '',
            desc: total > 0 ? 'Total bonus win' : 'No win this time. The vault will open again.',
            button: 'Continue',
            autoMs: this.splashMs(),
            countUp: total > 0 ? (p) => this.ctx.fmt(Math.round(total * p)) : undefined,
          });
        } else if (e.featureWin > 0) {
          audio.play('bonusEnd');
          await hud.banner(`${name} complete`, this.ctx.fmt(e.featureWin), this.ms(1800, 800), true);
        }
        if (this.path || e.feature === 'thirteenthHour') {
          stage.props.hideClock();
          await stage.setBackground('bg_bank');
        }
        hud.hideFeature();
        this.path = null;
        this.inSequence = false;
        break;
      }

      case 'wincap': {
        audio.play('bigWin');
        stage.particles.burst((CELL * REELS) / 2, (CELL * ROWS) / 2, 60, tex('fx_coin'), { speed: 0.9, gravity: 1, scale: 0.45, life: 1800 });
        await hud.banner('Maximum Win', this.ctx.fmt(e.totalWin), this.ms(2600, 1200), true);
        stage.props.hideClock();
        stage.props.clearChains();
        hud.hideFeature();
        await stage.setBackground('bg_bank');
        this.path = null;
        break;
      }

      case 'finalWin':
        hud.setWin(this.ctx.fmt(e.amount));
        break;
    }
  }

  /** How long a bonus splash waits before continuing on its own. */
  private splashMs(): number {
    if (this.ctx.autoplay()) return 2500;
    return this.turbo ? 2500 : 6000;
  }

  /** True while a feature or bonus sequence is being presented. */
  get inFeature(): boolean {
    return this.inSequence;
  }

  private async pulseCells(cells: Cell[]): Promise<void> {
    const views = cells.map((c) => this.stage.reels.view(c));
    await this.stage.tweener.run(this.ms(500, 200), (p) => views.forEach((v) => v.scale.set(1 + Math.sin(p * Math.PI) * 0.22)), ease.linear);
  }

  private countWin(from: number, to: number, ms: number): Promise<void> {
    return this.stage.tweener.run(this.ms(ms, ms * 0.3), (p) => this.hud.setWin(this.ctx.fmt(Math.round(from + (to - from) * p))), ease.outQuad);
  }

  private async bigWin(amount: number): Promise<void> {
    const level = amount >= 10000 ? 'Epic Win' : amount >= 5000 ? 'Mega Win' : 'Big Win';
    const { stage, hud } = this;
    hud.showBanner(level, this.ctx.fmt(0), true);
    stage.particles.burst((CELL * REELS) / 2, (CELL * ROWS) / 2, this.ctx.reduced() ? 10 : 50, tex('fx_coin'), { speed: 0.8, gravity: 1, scale: 0.4, life: 1600 });
    await stage.tweener.run(this.ms(2200, 700), (p) => hud.setBannerSub(this.ctx.fmt(Math.round(amount * p))), ease.outQuad);
    hud.setBannerSub(this.ctx.fmt(amount));
    await stage.tweener.wait(this.ms(900, 300));
    hud.hideBanner();
  }
}
