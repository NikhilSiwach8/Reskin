// Sugar Scream client entry point and round controller.
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/700.css';
import './styles.css';
import { Application } from 'pixi.js';
import { BET_MODES, BUY_MODES } from '../engine/config.ts';
import type { ModeName } from '../engine/round.ts';
import type { Board, GameEvent } from '../engine/types.ts';
import { validateBook } from '../engine/validate.ts';
import { loadAssets, panelSrc, symbolSrc } from './assets.ts';
import { Audio } from './audio.ts';
import { Clips, type ClipName } from './clips.ts';
import { Player } from './game/player.ts';
import { Scene } from './game/scene.ts';
import { Hud, wait, type Settings as UiSettings } from './hud.ts';
import { formatMoney, SOCIAL_CURRENCIES, winMicros } from './money.ts';
import { RgsClient, errorMessage, type Jurisdiction, type RgsConfig, type RgsRound } from './rgs.ts';
import { buildRules, type MathSummary } from './rules.ts';
import { isSocial, localizeTree, setSocial, t } from './text.ts';

type DevRequest = (rgs: RgsClient, amount: number, mode: string) => Promise<{ balance: { amount: number; currency: string }; round: RgsRound }>;

const params = new URLSearchParams(location.search);
const launch = {
  sessionID: params.get('sessionID') ?? '',
  rgsUrl: params.get('rgs_url') ?? '',
  // English is the only language; anything malformed is sent to the RGS as `en`
  lang: /^[a-z]{2}(-[a-z]{2})?$/i.test(params.get('lang') ?? '') ? params.get('lang')! : 'en',
  currency: params.get('currency') ?? 'USD',
  social: params.get('social') === 'true' || params.get('social') === '1',
  replay: params.get('replay') === 'true',
  game: params.get('game') ?? '',
  version: params.get('version') ?? '',
  mode: params.get('mode') ?? 'base',
  event: params.get('event') ?? '',
  /** Replay bet amount (RGS integer, 6 implied decimals); defaults to 1.00. */
  amount: Number(params.get('amount')) > 0 ? Number(params.get('amount')) : 1_000_000,
};
setSocial(launch.social || SOCIAL_CURRENCIES.has(launch.currency));

// The loading screen's clip (silent, made with Remotion): the intro's witch fly-by landing on the
// logo, played once and held on its last frame. It starts before anything else loads, in the cut
// that fits the screen, over its own first frame. Reduced motion keeps the still painting.
{
  const v = document.getElementById('loading-video') as HTMLVideoElement | null;
  if (v && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const cut = innerHeight > innerWidth ? 'p' : 'l';
    v.poster = `assets/clips/loading-${cut}.webp`;
    v.src = `assets/clips/loading-${cut}.mp4`;
    v.muted = true;
    v.play().catch(() => {});
  }
}

// mobile: no pinch or double-tap zoom (iOS ignores user-scalable=no; CSS touch-action covers double tap)
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

const BUY_ART: Record<string, string> = { bonus: panelSrc('cauldron_icon') ?? 'assets/cauldron.svg', fullmoon: symbolSrc('JK'), lootbox: panelSrc('loot_icon') ?? 'assets/loot_box.svg', graveyard: panelSrc('orb_soul') ?? symbolSrc('GM') };

const IDLE_BOARD: Board = [
  ['CC', 'PU', 'BH', 'EY', 'BT'],
  ['GM', 'SC', 'PA', 'CC', 'SL'],
  ['BT', 'WP', 'EY', 'PU', 'GM'],
  ['PA', 'CC', 'SL', 'BH', 'EY'],
  ['EY', 'BT', 'GM', 'WP', 'PU'],
  ['SL', 'PA', 'CC', 'BT', 'WP'],
];

interface Settings extends UiSettings {
  muted: boolean;
  ante: boolean;
}

function loadSettings(): Settings {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const defaults: Settings = { turbo: false, reduced, muted: false, music: true, sfx: true, musicVol: 0.7, sfxVol: 0.8, intro: true, scares: true, haptics: true, skin: 'classic', ante: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('ss-settings') ?? '{}') };
  } catch {
    return defaults;
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem('ss-settings', JSON.stringify(s));
  } catch {
    /* storage unavailable: settings last for this session only */
  }
}

class Game {
  private rgs = new RgsClient(launch.rgsUrl, launch.sessionID);
  private hud: Hud;
  private audio = new Audio();
  private scene!: Scene;
  private player!: Player;
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
  private clips = new Clips();
  /** Jumpscares: never in the first few rounds, then rarely and at most every two minutes. */
  private roundsPlayed = 0;
  /** This session's play, for the Session panel and the jurisdiction session bar (RGS amounts). */
  private session = { start: Date.now(), rounds: 0, bet: 0, won: 0, best: 0, bestX: 0 };
  /** Cost multiplier of the round being shown (1 spin, 1.25 Ante Bet, 100 for a buy, ...). */
  private roundCost = 1;
  private lastScare = 0;
  private lastScareClip: ClipName | null = null;

  constructor() {
    this.hud = new Hud({
      spin: () => this.onSpinButton(),
      betStep: (d) => this.stepBet(d),
      betIndex: (i) => this.setBetIndex(i),
      autoplay: (n, stop) => this.startAutoplay(n, stop),
      stopAutoplay: () => this.stopAutoplay(),
      turbo: (on) => this.setTurbo(on),
      mute: () => this.toggleMute(),
      ante: (on) => this.setAnte(on),
      buy: (mode) => void this.spin(mode as ModeName),
      settings: (s) => this.applySettings(s),
      replayPlay: () => void this.playReplay(),
      sound: (name) => this.audio.play(name),
      openRules: () => this.openRules(),
      session: () => {
        const s = this.session;
        const net = s.won - s.bet;
        return [
          ['Session time', clock(Date.now() - s.start)],
          ['Rounds', String(s.rounds)],
          ['Total bet', this.fmtMoney(s.bet)],
          ['Total won', this.fmtMoney(s.won)],
          ['Net result', `${net >= 0 ? '+' : '−'}${this.fmtMoney(Math.abs(net))}`],
          ['Biggest win', s.best > 0 ? `${this.fmtMoney(s.best)} (${s.bestX.toLocaleString('en-US')}x)` : '–'],
        ];
      },
      autoplaySummary: (n) => t(`${n} rounds at ${this.fmtMoney(this.bet * this.spinCost)} each. Autoplay stops if your balance is too low.`),
      buyOptions: () => BUY_MODES.map((m) => ({
        mode: m.name,
        label: m.label,
        desc: m.description,
        price: this.fmtMoney(this.bet * m.cost),
        art: BUY_ART[m.name],
        affordable: this.bet * m.cost <= this.balance,
        vol: ({ bonus: 3, fullmoon: 5, lootbox: 4, graveyard: 2 } as Record<string, number>)[m.name] ?? 3,
        preview: ({ bonus: 'entry-cauldron', fullmoon: 'entry-fullmoon', lootbox: 'entry-loot', graveyard: 'entry-graveyard' } as Record<string, ClipName>)[m.name],
      })),
      buyText: (mode) => {
        const m = BUY_MODES.find((b) => b.name === mode)!;
        return t(`Buy ${m.label} for ${this.fmtMoney(this.bet * m.cost)} (${m.cost}x your bet of ${this.fmtMoney(this.bet)})?`);
      },
    });
  }

  private get bet(): number {
    return this.levels[this.betIndex] ?? 0;
  }

  private get spinMode(): ModeName {
    return this.settings.ante ? 'ante' : 'base';
  }

  private get spinCost(): number {
    return BET_MODES.find((m) => m.name === this.spinMode)!.cost;
  }

  private get jurisdiction(): Jurisdiction | undefined {
    return this.config?.jurisdiction;
  }

  private fmtMoney(micros: number): string {
    return formatMoney(micros, this.currency);
  }

  async boot(): Promise<void> {
    const app = new Application();
    await app.init({ resizeTo: window, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), powerPreference: 'high-performance' });
    document.getElementById('app')!.appendChild(app.canvas);
    await document.fonts.load('700 40px Fredoka').catch(() => {});
    const failures = await loadAssets((p) => this.hud.setLoading(p * 0.8));
    if (failures.length) console.warn(`Missing assets: ${failures.join(', ')}`);
    try {
      const res = await fetch('math.json');
      if (res.ok) this.math = (await res.json()) as MathSummary;
    } catch {
      /* rules show "RTP information is not available" */
    }
    this.scene = new Scene(app, IDLE_BOARD);
    this.player = new Player(this.scene, this.hud, this.audio, {
      fmt: (centi) => this.fmtMoney(winMicros(this.roundBet || this.bet, centi)),
      turbo: () => this.settings.turbo && !this.jurisdiction?.disabledTurbo,
      reduced: () => this.settings.reduced,
      hands: () => this.autoplay !== null || launch.replay,
      replay: () => launch.replay,
      cost: () => Math.round(this.roundCost * 100),
    }, IDLE_BOARD);
    this.applySettings(this.settings);
    this.hud.showSettings(this.settings);
    this.hud.setMuted(this.settings.muted);
    this.audio.muted = this.settings.muted;
    this.clips.enabled = () => !this.settings.reduced;
    this.clips.volume = () => this.audio.clipVolume();
    this.clips.onPlaying = (on) => this.audio.setClipPlaying(on);
    this.hud.clips = this.clips;
    window.addEventListener('pointerdown', () => {
      this.audio.unlock();
      this.clips.unlock();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    if (failures.length) this.hud.toast(`Some artwork could not be loaded (${failures.length}). The game remains playable.`);

    if (launch.replay) return this.bootReplay();
    if (!launch.sessionID || !launch.rgsUrl) {
      this.hud.setLoading(1, 'Missing sessionID or rgs_url launch parameter.');
      return;
    }
    this.hud.setLoading(0.9, 'Unwrapping the candy…');
    try {
      const auth = await this.rgs.authenticate(launch.lang);
      this.config = auth.config;
      this.balance = auth.balance.amount;
      this.currency = auth.balance.currency || launch.currency;
      // stake.us: social wording follows the jurisdiction flag or a social currency, not only the URL
      if (!isSocial() && (auth.config.jurisdiction?.socialCasino || SOCIAL_CURRENCIES.has(this.currency))) {
        setSocial(true);
        localizeTree(document.body);
      }
      this.levels = auth.config.betLevels
        .filter((l) => l >= auth.config.minBet && l <= auth.config.maxBet && l % (auth.config.stepBet || 1) === 0)
        .sort((a, b) => a - b);
      this.betIndex = Math.max(0, this.levels.indexOf(auth.config.defaultBetLevel));
      if (auth.config.jurisdiction?.disabledBuyFeature) this.settings.ante = false;
      await this.hud.loadingClipShown();
      this.hud.hideLoading();
      this.refresh();
      this.scene.layout(); // the HUD is now filled in: fit the board around it
      this.hud.setWin(this.fmtMoney(0));
      this.hud.tips();
      if (this.settings.intro) {
        const { skipNextTime } = await this.hud.introSplash();
        this.audio.unlock();
        if (skipNextTime) this.applySettings({ ...this.settings, intro: false });
        this.hud.showSettings(this.settings);
        // the slot intro clip (tap to skip)
        await this.clips.play('intro');
      }
      // the session clock ticks for the bar and an open Session panel
      this.session.start = Date.now();
      this.updateSessionBar();
      window.setInterval(() => {
        this.updateSessionBar();
        if (this.hud.sessionOpen()) this.hud.renderSession();
      }, 1000);
      // a first visit gets the short guide to the controls (the menu can show it again)
      if (!auth.round?.active && !readFlag('ss-guide-done')) {
        await this.hud.guide();
        writeFlag('ss-guide-done');
      }
      // warm the cache for the clips a session is likely to need, after the game has settled
      window.setTimeout(() => void this.clips.prefetch(['entry-tot', 'win-big', 'entry-cauldron', 'scare-ghost', 'scare-witch', 'scare-pumpkin', 'scare-skull', 'spell', 'win-mega', 'retrigger', 'fs-total', 'entry-loot', 'lollipop', 'entry-fullmoon', 'entry-graveyard', 'scare-eyeball', 'scare-bat', 'scare-apple']), 5000);
      if (auth.round && (auth.round.active ?? true) && auth.round.payoutMultiplier !== undefined) await this.resume(auth.round);
    } catch (e) {
      this.hud.setLoading(1, errorMessage(e));
    }
  }

  private refresh(): void {
    const j = this.jurisdiction;
    this.hud.setBalance(this.fmtMoney(this.balance));
    this.hud.setBet(this.fmtMoney(this.bet), this.betIndex > 0, this.betIndex < this.levels.length - 1, this.busy || this.autoplay !== null, { index: this.betIndex, count: this.levels.length });
    this.hud.setAntePrice(`${this.fmtMoney(this.bet * 1.25)} ${t('per spin')}`);
    this.hud.setControlsLocked(this.busy, {
      buyAvailable: !j?.disabledBuyFeature,
      autoAvailable: !j?.disabledAutoplay,
      turboAvailable: !j?.disabledTurbo,
      anteOn: this.settings.ante,
    });
    this.hud.setSpin(this.busy ? (j?.disabledSlamstop && !this.autoplay ? 'disabled' : 'spinning') : this.levels.length ? 'idle' : 'disabled');
    this.hud.setAutoplay(this.autoplay?.left ?? null);
  }

  private setBetIndex(i: number): void {
    if (this.busy || this.autoplay) return;
    this.betIndex = Math.min(this.levels.length - 1, Math.max(0, i));
    this.refresh();
  }

  private stepBet(dir: -1 | 1): void {
    if (this.busy) return;
    this.betIndex = Math.min(this.levels.length - 1, Math.max(0, this.betIndex + dir));
    this.audio.play('click');
    this.refresh();
  }

  private setAnte(on: boolean): void {
    if (this.busy) return;
    this.settings.ante = on;
    saveSettings(this.settings);
    this.audio.play('click');
    this.refresh();
  }

  private onSpinButton(): void {
    this.audio.unlock();
    if (this.busy) {
      if (!this.jurisdiction?.disabledSlamstop) this.player.skip();
      return;
    }
    void this.spin(this.spinMode);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code !== 'Space' || e.repeat) return;
    if (this.hud.anyModalOpen() || this.hud.splashOpen || this.clips.playing || launch.replay || this.jurisdiction?.disabledSpacebar) return;
    // also stops a focused button from being activated by the same key press
    e.preventDefault();
    this.onSpinButton();
  }

  private async spin(mode: ModeName, devRequest?: DevRequest): Promise<void> {
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
    this.hud.setShare(null);
    this.hud.setWin(this.fmtMoney(0));
    this.hud.message('Good luck!');
    const started = performance.now();
    this.player.startSpin();
    let round: RgsRound;
    try {
      const res = devRequest ? await devRequest(this.rgs, this.bet, mode) : await this.rgs.play(this.bet, mode);
      this.balance = res.balance.amount;
      this.hud.setBalance(this.fmtMoney(this.balance));
      round = res.round;
      this.session.rounds++;
      this.session.bet += cost;
    } catch (e) {
      await this.player.abortSpin();
      this.hud.toast(errorMessage(e));
      this.busy = false;
      this.stopAutoplay();
      this.refresh();
      return;
    }
    const feature = await this.presentRound(round);
    this.roundsPlayed++;
    if (round.payoutMultiplier === 0 && (mode === 'base' || mode === 'ante')) await this.maybeScare();
    const minMs = this.jurisdiction?.minimumRoundDuration ?? 0;
    const elapsed = performance.now() - started;
    if (minMs > elapsed) await wait(minMs - elapsed);
    this.busy = false;
    this.refresh();
    this.continueAutoplay(feature);
  }

  /**
   * A random jumpscare after a losing base game spin (1 in 6). Cosmetic only: it plays after the
   * round has settled, never in autoplay or turbo, never in the first two rounds, at most every
   * 40 seconds, never the same creature twice in a row, and can be switched off in the menu
   * (reduced motion turns it off too).
   */
  private async maybeScare(): Promise<void> {
    const now = Date.now();
    if (!this.settings.scares || this.autoplay || this.settings.turbo || launch.replay) return;
    if (this.roundsPlayed < 3 || now - this.lastScare < 40_000 || Math.random() >= 1 / 6) return;
    const all: ClipName[] = ['scare-ghost', 'scare-witch', 'scare-pumpkin', 'scare-skull', 'scare-eyeball', 'scare-bat', 'scare-apple'];
    const pick = all.filter((c) => c !== this.lastScareClip);
    const clip = pick[Math.floor(Math.random() * pick.length)];
    this.audio.haptic(250);
    if (await this.clips.play(clip)) {
      this.lastScare = now;
      this.lastScareClip = clip;
    }
  }

  /**
   * A replay link for a round when the game knows its Stake game ID and version (the replay
   * launch needs both), else the bet ID, which Stake's bet history can replay and share.
   */
  private shareFor(round: RgsRound): { text: string; isLink: boolean } | null {
    const event = round.betID ?? round.event;
    if (event === undefined || event === null) return null;
    const game = launch.game || this.config?.gameID;
    if (game && launch.version) {
      const q = new URLSearchParams({
        replay: 'true', game, version: launch.version, mode: round.mode ?? 'base', event: String(event),
        rgs_url: launch.rgsUrl, currency: this.currency, lang: launch.lang, amount: String(round.amount ?? this.roundBet),
      });
      if (isSocial()) q.set('social', 'true');
      return { text: `${location.origin}${location.pathname}?${q}`, isLink: true };
    }
    return { text: String(event), isLink: false };
  }

  /** The session line (timer, net position, RTP) for jurisdictions whose RGS flags ask for it. */
  private updateSessionBar(): void {
    const j = this.jurisdiction;
    const parts: string[] = [];
    if (j?.displaySessionTimer) parts.push(`Time ${clock(Date.now() - this.session.start)}`);
    if (j?.displayNetPosition) {
      const net = this.session.won - this.session.bet;
      parts.push(`Net ${net >= 0 ? '+' : '−'}${this.fmtMoney(Math.abs(net))}`);
    }
    if (j?.displayRTP) {
      const rtp = this.math?.modes.find((m) => m.mode === this.spinMode)?.rtp;
      parts.push(`RTP ${rtp !== undefined ? (rtp * 100).toFixed(2) : '96.00'}%`);
    }
    this.hud.setSessionBar(parts.length ? parts.join('  ·  ') : null);
  }

  /** Validates and plays a round, then settles it with end-round. Returns whether a feature triggered. */
  private async presentRound(round: RgsRound): Promise<boolean> {
    const events = round.state as GameEvent[];
    const payoutCenti = Math.round(round.payoutMultiplier * 100);
    this.roundCost = round.costMultiplier ?? BET_MODES.find((m) => m.name === (round.mode ?? 'base'))?.cost ?? 1;
    const check = validateBook({ payoutMultiplier: payoutCenti, events });
    let feature = false;
    if (check.ok) {
      feature = events.some((e) => e.type === 'freeSpinsStart' || e.type === 'trickOrTreat' || e.type === 'lootBox');
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
    const won = winMicros(this.roundBet, payoutCenti);
    this.hud.setWin(this.fmtMoney(won));
    this.hud.setBalance(this.fmtMoney(this.balance));
    if (payoutCenti === 0) this.hud.tips();
    if (!launch.replay) {
      this.session.won += won;
      if (won > this.session.best) {
        this.session.best = won;
        this.session.bestX = round.payoutMultiplier;
      }
      this.updateSessionBar();
      // Big Win and above: offer the round as a replay to share
      if (payoutCenti >= 1500) this.hud.setShare(this.shareFor(round));
    }
    return feature;
  }

  private async resume(round: RgsRound): Promise<void> {
    this.busy = true;
    this.roundBet = round.amount ?? this.bet;
    // show the bet the round was played at
    const level = this.levels.indexOf(this.roundBet);
    if (level >= 0) this.betIndex = level;
    this.refresh();
    if (level < 0) this.hud.setBet(this.fmtMoney(this.roundBet), false, false, true);
    await this.hud.banner('Resuming your round', '', 1400);
    this.player.startSpin();
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
    setTimeout(() => void this.spin(this.spinMode), 300);
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
    this.audio.musicVol = s.musicVol;
    this.audio.sfxVol = s.sfxVol;
    this.audio.hapticsOn = s.haptics;
    this.audio.apply();
    this.scene.reduced = s.reduced;
    this.scene.setSkin(s.skin);
    this.hud.showSettings(this.settings);
    this.setTurbo(s.turbo);
    saveSettings(this.settings);
  }

  private openRules(): void {
    buildRules(document.getElementById('rules-body')!, {
      math: this.math,
      fmt: (centi) => this.fmtMoney(winMicros(this.bet || 1_000_000, centi)),
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
      this.roundBet = launch.amount;
      const cost = this.replayRound.costMultiplier ?? BET_MODES.find((m) => m.name === launch.mode)?.cost ?? 1;
      this.hud.setReplayInfo({
        bet: this.fmtMoney(this.roundBet),
        mode: BET_MODES.find((m) => m.name === launch.mode)?.label ?? launch.mode,
        cost: `${cost}x = ${this.fmtMoney(this.roundBet * cost)}`,
        mult: `${this.replayRound.payoutMultiplier.toLocaleString('en-US')}x`,
        win: this.fmtMoney(Math.round(this.roundBet * this.replayRound.payoutMultiplier)),
      });
      this.hud.setWin(this.fmtMoney(0));
      await this.hud.loadingClipShown();
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
    await this.presentRound(this.replayRound);
    this.busy = false;
    this.hud.setReplayButton('Play again', true);
  }

  /** Development harness hook (local mock RGS only; never mounted in production builds). */
  async devScenario(mode: ModeName, request: DevRequest): Promise<void> {
    await this.spin(mode, request);
  }
}

const game = new Game();
void game.boot();

if (import.meta.env.DEV) {
  void import('./dev/harness.ts').then((m) => m.mountHarness((mode, request) => game.devScenario(mode, request)));
}

/** h:mm:ss (or m:ss under an hour). */
function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* storage unavailable: the guide shows again next time */
  }
}
