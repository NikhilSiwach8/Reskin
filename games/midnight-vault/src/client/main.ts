// Midnight Vault client entry point and round controller.
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/cinzel-decorative/900.css';
import './ui/styles.css';
import { Application } from 'pixi.js';
import { BET_MODES } from '../engine/config.ts';
import type { Board, GameEvent } from '../engine/types.ts';
import { validateBook } from '../engine/validate.ts';
import { loadAssets } from './assets.ts';
import { Audio } from './audio.ts';
import { Player } from './game/player.ts';
import { Stage } from './game/stage.ts';
import { formatMoney, winMicros } from './money.ts';
import { RgsClient, errorMessage, type Jurisdiction, type RgsConfig, type RgsRound } from './rgs.ts';
import { Hud, wait, type Settings as UiSettings } from './ui/hud.ts';
import { Scares } from './game/scares.ts';
import { buildRules, type MathSummary } from './ui/rules.ts';
import { setSocial, t } from './ui/text.ts';

type DevRequest = (rgs: RgsClient, amount: number, mode: string) => Promise<{ balance: { amount: number; currency: string }; round: RgsRound }>;

const params = new URLSearchParams(location.search);
const launch = {
  sessionID: params.get('sessionID') ?? '',
  rgsUrl: params.get('rgs_url') ?? '',
  lang: params.get('lang') ?? 'en',
  currency: params.get('currency') ?? 'USD',
  social: params.get('social') === 'true' || params.get('social') === '1',
  replay: params.get('replay') === 'true',
  game: params.get('game') ?? '',
  version: params.get('version') ?? '',
  mode: params.get('mode') ?? 'base',
  event: params.get('event') ?? '',
};
setSocial(launch.social);

const IDLE_BOARD: Board = [
  ['A', 'GB', 'Q', 'TC', 'K'],
  ['J', 'LG', 'RL', 'T', 'A'],
  ['TC', 'Q', 'VD', 'K', 'GB'],
  ['K', 'PH', 'A', 'CL', 'J'],
  ['EL', 'T', 'Q', 'GB', 'A'],
];

interface Settings extends UiSettings {
  muted: boolean;
}

function loadSettings(): Settings {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const defaults: Settings = { turbo: false, reduced, muted: false, music: true, sfx: true, scares: !reduced, intro: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('mv-settings') ?? '{}') };
  } catch {
    return defaults;
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem('mv-settings', JSON.stringify(s));
  } catch {
    /* storage unavailable: settings last for this session only */
  }
}

class Game {
  private rgs: RgsClient;
  private hud: Hud;
  private audio = new Audio();
  private stage!: Stage;
  private player!: Player;
  private scares!: Scares;
  private settings = loadSettings();
  private config: RgsConfig | null = null;
  private levels: number[] = [];
  private betIndex = 0;
  private balance = 0;
  private currency = launch.currency;
  private busy = false;
  private roundBet = 0;
  private autoplay: { left: number; stopOnFeature: boolean } | null = null;
  private math?: MathSummary;

  constructor() {
    this.rgs = new RgsClient(launch.rgsUrl, launch.sessionID);
    this.hud = new Hud({
      spin: () => this.onSpinButton(),
      betStep: (d) => this.stepBet(d),
      autoplay: (n, stop) => this.startAutoplay(n, stop),
      stopAutoplay: () => this.stopAutoplay(),
      turbo: (on) => this.setTurbo(on),
      mute: () => this.toggleMute(),
      buy: () => void this.spin('bonus'),
      settings: (s) => this.applySettings(s),
      replayPlay: () => void this.playReplay(),
      openRules: () => this.openRules(),
      autoplaySummary: (n) => t(`${n} rounds at ${this.fmtMoney(this.bet)} each. Autoplay stops if your balance is too low.`),
      buyText: () => {
        const cost = this.bet * BET_MODES[1].cost;
        return t(`Buy the bonus for ${this.fmtMoney(cost)} (${BET_MODES[1].cost}x your bet of ${this.fmtMoney(this.bet)})?`);
      },
    });
  }

  private get bet(): number {
    return this.levels[this.betIndex] ?? 0;
  }

  private get jurisdiction(): Jurisdiction | undefined {
    return this.config?.jurisdiction;
  }

  private fmtMoney(micros: number): string {
    return formatMoney(micros, this.currency);
  }

  async boot(): Promise<void> {
    const app = new Application();
    await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2) });
    document.getElementById('app')!.appendChild(app.canvas);
    const failures = await loadAssets((p) => this.hud.setLoading(p * 0.8));
    if (failures.length) console.warn(`Missing assets: ${failures.join(', ')}`);
    try {
      const res = await fetch('math.json');
      if (res.ok) this.math = (await res.json()) as MathSummary;
    } catch {
      /* rules show "RTP information is not available" */
    }

    this.stage = new Stage(app, IDLE_BOARD);
    this.player = new Player(this.stage, this.hud, this.audio, {
      fmt: (centi) => this.fmtMoney(winMicros(this.roundBet || this.bet, centi)),
      turbo: () => this.settings.turbo && !this.jurisdiction?.disabledTurbo,
      reduced: () => this.settings.reduced,
      autoplay: () => this.autoplay !== null,
    });
    this.scares = new Scares(this.stage, this.audio);
    // Jump scares are cosmetic: never during features, turbo, reduced motion, replay, dialogs or splash screens.
    this.scares.allowed = () =>
      !launch.replay && !this.settings.reduced && !this.settings.turbo && !this.player.inFeature && !this.hud.anyModalOpen() && !this.hud.splashOpen;
    this.scares.idleAllowed = () => !this.busy;
    this.applySettings(this.settings);
    this.hud.showSettings(this.settings);
    this.hud.setMuted(this.settings.muted);
    this.audio.muted = this.settings.muted;
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false });
    window.addEventListener('keydown', (e) => this.onKey(e));
    if (failures.length) this.hud.toast(`Some artwork could not be loaded (${failures.length}). The game remains playable.`);

    if (launch.replay) return this.bootReplay();
    if (!launch.sessionID || !launch.rgsUrl) {
      this.hud.setLoading(1, 'Missing sessionID or rgs_url launch parameter.');
      return;
    }
    this.hud.setLoading(0.9, 'Connecting to the vault…');
    try {
      const auth = await this.rgs.authenticate(launch.lang);
      this.config = auth.config;
      this.balance = auth.balance.amount;
      this.currency = auth.balance.currency || launch.currency;
      this.levels = auth.config.betLevels
        .filter((l) => l >= auth.config.minBet && l <= auth.config.maxBet && l % (auth.config.stepBet || 1) === 0)
        .sort((a, b) => a - b);
      this.betIndex = Math.max(0, this.levels.indexOf(auth.config.defaultBetLevel));
      this.hud.hideLoading();
      this.refresh();
      this.hud.setWin(this.fmtMoney(0));
      if (this.settings.intro) {
        const { skipNextTime } = await this.hud.introSplash();
        this.audio.unlock();
        if (skipNextTime) this.applySettings({ ...this.settings, intro: false });
        this.hud.showSettings(this.settings);
      }
      this.scares.armIdle();
      if (auth.round && (auth.round.active ?? true) && auth.round.payoutMultiplier !== undefined) await this.resume(auth.round);
    } catch (e) {
      this.hud.setLoading(1, errorMessage(e));
    }
  }

  private refresh(): void {
    const j = this.jurisdiction;
    this.hud.setBalance(this.fmtMoney(this.balance));
    this.hud.setBet(this.fmtMoney(this.bet), this.betIndex > 0, this.betIndex < this.levels.length - 1, this.busy || this.autoplay !== null);
    this.hud.setControlsLocked(this.busy, {
      buyAvailable: !j?.disabledBuyFeature,
      autoAvailable: !j?.disabledAutoplay,
      turboAvailable: !j?.disabledTurbo,
    });
    this.hud.setSpin(this.busy ? (j?.disabledSlamstop ? 'disabled' : 'skip') : this.levels.length ? 'idle' : 'disabled');
    this.hud.setAutoplay(this.autoplay?.left ?? null);
  }

  private stepBet(dir: -1 | 1): void {
    if (this.busy) return;
    this.betIndex = Math.min(this.levels.length - 1, Math.max(0, this.betIndex + dir));
    this.audio.play('click');
    this.refresh();
  }

  private onSpinButton(): void {
    this.audio.unlock();
    if (this.busy) {
      if (!this.jurisdiction?.disabledSlamstop) this.player.skip();
      return;
    }
    void this.spin('base');
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code !== 'Space' || e.repeat) return;
    if (this.hud.anyModalOpen() || this.hud.splashOpen || launch.replay || this.jurisdiction?.disabledSpacebar) return;
    const target = e.target as HTMLElement;
    if (target?.tagName === 'INPUT') return;
    e.preventDefault();
    this.onSpinButton();
  }

  private async spin(mode: 'base' | 'bonus', devRequest?: DevRequest): Promise<void> {
    if (this.busy || !this.config) return;
    const cost = this.bet * (BET_MODES.find((m) => m.name === mode)?.cost ?? 1);
    if (cost > this.balance) {
      this.hud.toast('Insufficient balance for this bet.');
      this.stopAutoplay();
      return;
    }
    this.busy = true;
    this.roundBet = this.bet;
    this.refresh();
    this.hud.setWin(this.fmtMoney(0));
    const started = performance.now();
    this.player.startSpin();
    if (mode === 'base' && !devRequest) this.scares.onSpin();
    let round: RgsRound;
    try {
      const res = devRequest ? await devRequest(this.rgs, this.bet, mode) : await this.rgs.play(this.bet, mode);
      this.balance = res.balance.amount;
      this.hud.setBalance(this.fmtMoney(this.balance));
      round = res.round;
    } catch (e) {
      await this.player.abortSpin();
      this.hud.toast(errorMessage(e));
      this.busy = false;
      this.stopAutoplay();
      this.refresh();
      return;
    }
    const feature = await this.presentRound(round);
    const minMs = this.jurisdiction?.minimumRoundDuration ?? 0;
    const elapsed = performance.now() - started;
    if (minMs > elapsed) await wait(minMs - elapsed);
    this.busy = false;
    this.refresh();
    this.continueAutoplay(feature);
  }

  /** Validates and plays a round, then settles it with end-round. Returns whether a feature triggered. */
  private async presentRound(round: RgsRound): Promise<boolean> {
    const events = round.state as GameEvent[];
    const payoutCenti = Math.round(round.payoutMultiplier * 100);
    const check = validateBook({ payoutMultiplier: payoutCenti, events });
    let feature = false;
    if (check.ok) {
      feature = events.some((e) => e.type === 'featureTrigger' || e.type === 'bonusPath');
      try {
        await this.player.play(events);
      } catch (e) {
        console.error(e);
        this.hud.toast('The round could not be fully displayed. Your result is settled by the server.');
      }
    } else {
      console.error('Invalid round data', check.errors);
      await this.player.abortSpin();
      this.hud.toast('The round could not be displayed. Your result is settled by the server.');
    }
    if (round.payoutMultiplier > 0 && !launch.replay) {
      try {
        const res = await this.rgs.endRound();
        this.balance = res.balance.amount;
      } catch (e) {
        this.hud.toast(`${errorMessage(e)} Reload the game to finish the round.`);
        this.stopAutoplay();
      }
    }
    this.hud.setWin(this.fmtMoney(winMicros(this.roundBet, payoutCenti)));
    this.hud.setBalance(this.fmtMoney(this.balance));
    return feature;
  }

  private async resume(round: RgsRound): Promise<void> {
    this.busy = true;
    this.roundBet = round.amount ?? this.bet;
    this.refresh();
    await this.hud.banner('Resuming your round', '', 1400);
    await this.presentRound(round);
    this.busy = false;
    this.refresh();
  }

  // ---------------------------------------------------------------- autoplay
  private startAutoplay(count: number, stopOnFeature: boolean): void {
    if (this.jurisdiction?.disabledAutoplay) return;
    this.autoplay = { left: count, stopOnFeature };
    this.refresh();
    if (!this.busy) this.continueAutoplay(false);
  }

  private stopAutoplay(): void {
    this.autoplay = null;
    this.refresh();
  }

  private continueAutoplay(featureTriggered: boolean): void {
    if (!this.autoplay) return;
    if (featureTriggered && this.autoplay.stopOnFeature) return this.stopAutoplay();
    if (this.autoplay.left <= 0) return this.stopAutoplay();
    this.autoplay.left--;
    this.refresh();
    setTimeout(() => void this.spin('base'), 350);
  }

  // ---------------------------------------------------------------- settings
  private setTurbo(on: boolean): void {
    this.settings.turbo = on && !this.jurisdiction?.disabledTurbo;
    this.hud.setTurbo(this.settings.turbo);
    saveSettings(this.settings);
  }

  private toggleMute(): void {
    this.audio.unlock();
    this.settings.muted = !this.settings.muted;
    this.audio.muted = this.settings.muted;
    this.audio.apply();
    this.hud.setMuted(this.settings.muted);
    saveSettings(this.settings);
  }

  private applySettings(s: UiSettings): void {
    Object.assign(this.settings, s);
    this.audio.musicOn = s.music;
    this.audio.sfxOn = s.sfx;
    this.audio.apply();
    this.stage.setReducedMotion(s.reduced);
    this.stage.particles.enabled = !s.reduced;
    this.scares.enabled = s.scares;
    saveSettings(this.settings);
    this.hud.setReducedMotion(s.reduced);
    (document.getElementById('set-music') as HTMLInputElement).checked = s.music;
    (document.getElementById('set-sfx') as HTMLInputElement).checked = s.sfx;
    this.setTurbo(s.turbo);
  }

  private openRules(): void {
    buildRules(document.getElementById('rules-body')!, {
      math: this.math,
      betFormatter: (centi) => this.fmtMoney(winMicros(this.bet || 1_000_000, centi)),
      disabledBuy: !!this.jurisdiction?.disabledBuyFeature,
    });
    this.hud.open('#modal-rules');
  }

  // ---------------------------------------------------------------- replay
  private replayRound: RgsRound | null = null;

  private async bootReplay(): Promise<void> {
    this.hud.setReplayMode();
    this.hud.setReplayButton('Loading…', false);
    try {
      this.replayRound = await this.rgs.replay(launch.game, launch.version, launch.mode, launch.event);
      this.roundBet = 1_000_000;
      this.hud.hideLoading();
      this.hud.setReplayButton('Play', true);
    } catch (e) {
      this.hud.hideLoading();
      this.hud.toast(`Replay unavailable: ${errorMessage(e)}`, 60000);
      this.hud.setReplayButton('Replay unavailable', false);
    }
  }

  private async playReplay(): Promise<void> {
    if (!this.replayRound || this.busy) return;
    this.audio.unlock();
    this.busy = true;
    this.hud.setReplayButton('Playing…', false);
    this.player.startSpin();
    await wait(300);
    await this.presentRound(this.replayRound);
    this.busy = false;
    this.hud.setReplayButton('Play again', true);
  }

  /** Development harness hook (local mock RGS only; never mounted in production builds). */
  async devScenario(mode: 'base' | 'bonus', request: DevRequest): Promise<void> {
    await this.spin(mode, request);
  }

  /** Development harness: preview a jump scare or the intro splash. */
  devPreview(what: string): void {
    if (what === 'intro') void this.hud.introSplash();
    else void this.scares.play(what as 'lunge' | 'eyes' | 'bats');
  }
}

const game = new Game();
void game.boot();

if (import.meta.env.DEV) {
  void import('./dev/harness.ts').then((m) => m.mountHarness((mode, request) => game.devScenario(mode, request), (what) => game.devPreview(what)));
}
