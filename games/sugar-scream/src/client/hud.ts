// DOM user interface: meters, buttons, dialogs, banners, win screens and the Trick or Treat doors.
import type { KnockPrize } from '../engine/types.ts';
import type { Sfx } from './audio.ts';
import type { ClipName, Clips } from './clips.ts';
import { bgSrc, buttonSrc, panelSrc, portalHole, symbolSrc } from './assets.ts';
import { localizeTree, t } from './text.ts';

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * CSS url() for an asset path. Resolved to an absolute URL against the page, because a
 * relative url() inside a CSS variable is resolved against the stylesheet that uses it,
 * which in the production build lives in dist/assets/ (giving assets/assets/... 404s).
 */
export const cssUrl = (src: string) => `url("${new URL(src, document.baseURI).href}")`;
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

export interface Settings {
  turbo: boolean;
  reduced: boolean;
  music: boolean;
  sfx: boolean;
  /** Volumes 0..1 from the menu sliders (music / sfx are false at 0). */
  musicVol: number;
  sfxVol: number;
  intro: boolean;
  /** Occasional jumpscare clips between rounds. */
  scares: boolean;
  /** Phone vibration on big moments. */
  haptics: boolean;
}

export interface BuyOption {
  mode: string;
  label: string;
  desc: string;
  price: string;
  art: string;
  affordable: boolean;
  /** Volatility 1 (low) to 5 (highest), shown as a bar on the card. */
  vol: number;
}

export interface HudHandlers {
  spin: () => void;
  betStep: (dir: -1 | 1) => void;
  betIndex: (index: number) => void;
  autoplay: (count: number, stopOnFeature: boolean) => void;
  stopAutoplay: () => void;
  turbo: (on: boolean) => void;
  mute: () => void;
  ante: (on: boolean) => void;
  buy: (mode: string) => void;
  buyOptions: () => BuyOption[];
  buyText: (mode: string) => string;
  autoplaySummary: (n: number) => string;
  settings: (s: Settings) => void;
  openRules: () => void;
  replayPlay: () => void;
  /** Sound effects for HUD-driven sequences (the bonus door transition). */
  sound: (name: Sfx) => void;
}

export type KnockEvent = { index: number } & KnockPrize;

export class Hud {
  private turboOn = false;
  private autoCount = 0;
  private skipOverlay: (() => void) | null = null;
  splashOpen = false;
  /** Video clips, set by the game; the bonus door and the big win screens use them when they can play. */
  clips?: Clips;
  private settings!: Settings;
  private readonly h: HudHandlers;

  constructor(h: HudHandlers) {
    this.h = h;
    $('#btn-spin').addEventListener('click', () => (this.autoActive ? h.stopAutoplay() : h.spin()));
    $('#bet-minus').addEventListener('click', () => h.betStep(-1));
    $('#bet-plus').addEventListener('click', () => h.betStep(1));
    $('#btn-turbo').addEventListener('click', () => h.turbo(!this.turboOn));
    $('#btn-sound').addEventListener('click', () => h.mute());
    $('#btn-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!$('#menu-pop').classList.contains('hidden') && !(e.target as HTMLElement).closest('#menu-pop, #btn-menu')) this.toggleMenu(false);
    });
    $('#btn-rules').addEventListener('click', () => { this.toggleMenu(false); h.openRules(); });
    $('#bp-minus').addEventListener('click', () => h.betStep(-1));
    $('#bp-plus').addEventListener('click', () => h.betStep(1));
    $<HTMLInputElement>('#bp-slider').addEventListener('input', (e) => h.betIndex(Number((e.target as HTMLInputElement).value)));
    $('#btn-replay').addEventListener('click', () => h.replayPlay());
    $<HTMLInputElement>('#ante-toggle').addEventListener('change', (e) => h.ante((e.target as HTMLInputElement).checked));
    $('#btn-buy').addEventListener('click', () => this.openBuy());
    $('#btn-auto').addEventListener('click', () => (this.autoActive ? h.stopAutoplay() : this.openAuto()));
    document.querySelectorAll('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) this.close(`#${m.id}`); });
      m.querySelector('.modal-close')?.addEventListener('click', () => this.close(`#${m.id}`));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not(.hidden)').forEach((m) => this.close(`#${m.id}`));
        this.toggleMenu(false);
      }
    });
    for (const id of ['reduced', 'intro', 'scares', 'haptics'] as const) {
      $<HTMLInputElement>(`#set-${id}`).addEventListener('change', (e) => {
        this.settings = { ...this.settings, [id]: (e.target as HTMLInputElement).checked };
        h.settings(this.settings);
      });
    }
    for (const id of ['music', 'sfx'] as const) {
      $<HTMLInputElement>(`#set-${id}`).addEventListener('input', (e) => {
        const v = Number((e.target as HTMLInputElement).value) / 100;
        this.settings = { ...this.settings, [id]: v > 0, [`${id}Vol`]: v };
        h.settings(this.settings);
      });
    }
    // Auto-play counts
    const counts = $('#auto-counts');
    for (const n of [10, 25, 50, 100, 500]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(n);
      b.addEventListener('click', () => {
        this.autoCount = n;
        counts.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        $('#auto-summary').textContent = h.autoplaySummary(n);
        $<HTMLButtonElement>('#auto-start').disabled = false;
      });
      counts.appendChild(b);
    }
    $('#auto-start').addEventListener('click', () => {
      this.close('#modal-auto');
      h.autoplay(this.autoCount, $<HTMLInputElement>('#auto-stop-feature').checked);
    });
    $('#winscreen').addEventListener('click', () => this.skipOverlay?.());
    this.applyButtonArt();
    localizeTree(document.body);
  }

  private autoActive = false;

  /** Swaps CSS-drawn buttons for painted art where it has been imported. */
  private applyButtonArt(): void {
    const map: [string, string, string?][] = [
      ['#btn-spin', 'spin', 'spin_active'], ['#btn-auto', 'auto'], ['#btn-turbo', 'turbo'], ['#btn-menu', 'menu'],
      ['#btn-sound', 'sound', 'mute'], ['#bet-minus', 'minus'], ['#bet-plus', 'plus'], ['#btn-buy', 'buy'], ['#ante', 'ante'],
    ];
    for (const [sel, name, active] of map) {
      const src = buttonSrc(name);
      if (!src) continue;
      const el = $(sel);
      el.classList.add('painted');
      el.style.setProperty('--img', cssUrl(src));
      const act = active && buttonSrc(active);
      if (act) el.style.setProperty('--img-active', cssUrl(act));
    }
    const panels: [string, string][] = [['#meter-balance', 'meter'], ['#meter-win', 'meter'], ['#meter-bet', 'meter'], ['#cauldron', 'free']];
    for (const [sel, name] of panels) {
      const src = panelSrc(name);
      if (!src) continue;
      const el = $(sel);
      el.classList.add('painted-panel');
      el.style.setProperty('--img', cssUrl(src));
    }
    // Preload painted screens shown mid-round so they never pop in late.
    const later = [
      ...['win_big', 'win_mega', 'win_monster', 'win_sugar', 'win_max', 'door_treat', 'door_trick', 'door_lollipop'].map(panelSrc),
      'assets/loot_box.svg',
      panelSrc('door'),
      ...['loot_box_1', 'loot_box_2', 'loot_box_3', 'loot_box_4', 'loot_box_5', 'loot_box_6', 'loot_open', 'loot_pedestal', 'loot_title', 'loot_trigger',
        'portal_wall', 'portal_doors', 'portal_flash', 'bonus_banner'].map(panelSrc),
      ...['loot', 'portal_tunnel', 'portal_cauldron', 'portal_fullmoon', 'portal_tot', 'portal_loot', 'portal_exit'].map(bgSrc),
      ...['fs_cauldron', 'fs_fullmoon', 'feature_end', 'tot'].map(bgSrc),
    ];
    for (const src of later) if (src) new Image().src = src;
    const knob = buttonSrc('ante_knob');
    if (knob) ($('#ante .ante-knob') as HTMLElement).style.backgroundImage = cssUrl(knob);
    $<HTMLImageElement>('#ante-art').src = symbolSrc('SC');
    const pot = panelSrc('cauldron_icon');
    if (pot) $<HTMLImageElement>('#cauldron img').src = pot;
    const lootTitle = panelSrc('loot_title');
    if (lootTitle) {
      $<HTMLImageElement>('#loot-title-art').src = lootTitle;
      $('#loot-title-art').classList.remove('hidden');
      $('#loot .loot-title-main').classList.add('hidden');
    }
    // Full-screen painted backdrops for the loading, intro, Trick or Treat and Loot Box screens.
    for (const [sel, name] of [['#loading', 'loading'], ['#intro', 'intro'], ['#tot', 'tot'], ['#loot', 'loot']] as const) {
      const src = bgSrc(name);
      if (!src) continue;
      $(sel).classList.add('painted-bg');
      $(sel).style.setProperty('--bg', cssUrl(src));
    }
  }

  // ---------------------------------------------------------------- meters & buttons
  setLoading(p: number, msg?: string): void {
    $('#loading-bar').style.width = `${Math.round(p * 100)}%`;
    if (msg) $('#loading-text').textContent = t(msg);
  }

  hideLoading(): void {
    $('#loading').classList.add('hidden');
    // the loading loop is done: free its decoder
    const v = document.getElementById('loading-video') as HTMLVideoElement | null;
    if (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }

  setBalance(text: string): void {
    $('#meter-balance .meter-value').textContent = text;
    $('#bp-balance').textContent = text;
  }

  private winAnim = 0;

  setWin(text: string): void {
    cancelAnimationFrame(this.winAnim);
    $('#meter-win .meter-value').textContent = text;
  }

  /** Counts the Win meter up from one amount to another (centi-bet), with a little pop. */
  countWin(from: number, to: number, fmt: (centi: number) => string, ms: number): void {
    cancelAnimationFrame(this.winAnim);
    const el = $('#meter-win');
    const value = $('#meter-win .meter-value');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    if (ms <= 0) {
      value.textContent = fmt(to);
      return;
    }
    const start = performance.now();
    const frame = () => {
      const p = Math.min(1, (performance.now() - start) / ms);
      value.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p < 1) this.winAnim = requestAnimationFrame(frame);
    };
    frame();
  }

  setBet(text: string, canMinus: boolean, canPlus: boolean, locked: boolean, level?: { index: number; count: number }): void {
    const changed = $('#meter-bet .meter-value').textContent !== text;
    $('#meter-bet .meter-value').textContent = text;
    $('#bp-bet').textContent = text;
    for (const id of ['#bet-minus', '#bp-minus']) $<HTMLButtonElement>(id).disabled = locked || !canMinus;
    for (const id of ['#bet-plus', '#bp-plus']) $<HTMLButtonElement>(id).disabled = locked || !canPlus;
    const slider = $<HTMLInputElement>('#bp-slider');
    slider.disabled = locked;
    if (level) {
      slider.max = String(Math.max(0, level.count - 1));
      slider.value = String(level.index);
      slider.style.setProperty('--fill', `${level.count > 1 ? (level.index / (level.count - 1)) * 100 : 0}%`);
    }
    // prices on the open Bonus Games sheet follow the bet
    if (changed && !$('#modal-buy').classList.contains('hidden')) this.renderBuy();
  }

  /** Opens or closes the settings popover above the menu button. */
  private toggleMenu(open?: boolean): void {
    const pop = $('#menu-pop');
    const show = open ?? pop.classList.contains('hidden');
    pop.classList.toggle('hidden', !show);
    $('#btn-menu').setAttribute('aria-expanded', String(show));
    $('#btn-menu').classList.toggle('on', show);
  }

  setSpin(state: 'idle' | 'spinning' | 'disabled'): void {
    const b = $<HTMLButtonElement>('#btn-spin');
    b.classList.toggle('spinning', state === 'spinning');
    b.disabled = state === 'disabled';
  }

  setAutoplay(left: number | null): void {
    this.autoActive = left !== null;
    $('#btn-spin').classList.toggle('auto', this.autoActive);
    $('#spin-label').textContent = this.autoActive ? String(left) : t('SPIN');
    $('#btn-auto').classList.toggle('on', this.autoActive);
    $('#btn-auto').setAttribute('aria-label', this.autoActive ? t('Stop autoplay') : t('Autoplay'));
  }

  setControlsLocked(busy: boolean, opts: { buyAvailable: boolean; autoAvailable: boolean; turboAvailable: boolean; anteOn: boolean }): void {
    $<HTMLButtonElement>('#btn-buy').disabled = busy || this.autoActive || !opts.buyAvailable;
    $('#btn-buy').closest('.tile')!.classList.toggle('hidden', !opts.buyAvailable);
    $('#ante-badge').classList.toggle('hidden', !opts.anteOn);
    $<HTMLButtonElement>('#btn-auto').disabled = (busy && !this.autoActive) || !opts.autoAvailable;
    $('#btn-auto').classList.toggle('hidden', !opts.autoAvailable);
    $('#btn-turbo').classList.toggle('hidden', !opts.turboAvailable);
    $<HTMLInputElement>('#ante-toggle').disabled = busy || this.autoActive;
    $('#ante').classList.toggle('disabled', busy || this.autoActive);
    $('#ante').classList.toggle('on', opts.anteOn);

    $<HTMLInputElement>('#ante-toggle').checked = opts.anteOn;
  }

  setAntePrice(text: string): void {
    $('#ante-price').textContent = text;
  }

  setTurbo(on: boolean): void {
    this.turboOn = on;
    $('#btn-turbo').classList.toggle('on', on);
    $('#btn-turbo').setAttribute('aria-pressed', String(on));
  }

  setMuted(m: boolean): void {
    $('#btn-sound').textContent = m ? '🔇' : '🔊';
    $('#btn-sound').classList.toggle('muted', m);
    $('#btn-sound').setAttribute('aria-label', m ? t('Unmute') : t('Mute'));
  }

  showSettings(s: Settings): void {
    this.settings = { ...s };
    for (const id of ['reduced', 'intro', 'scares', 'haptics'] as const) $<HTMLInputElement>(`#set-${id}`).checked = s[id];
    $<HTMLInputElement>('#set-music').value = String(Math.round((s.music ? s.musicVol : 0) * 100));
    $<HTMLInputElement>('#set-sfx').value = String(Math.round((s.sfx ? s.sfxVol : 0) * 100));
    document.body.classList.toggle('reduced', s.reduced);
  }

  /** Replay: only the play button, the win meter, the sound switch and the replay details stay. */
  setReplayMode(): void {
    document.body.classList.add('replay');
    $('#btn-replay').classList.remove('hidden');
    $('#replay-info').classList.remove('hidden');
  }

  /** The replayed round's bet, mode, cost and win multiplier. */
  setReplayInfo(i: { bet: string; mode: string; cost: string; mult: string; win: string }): void {
    $('#ri-bet').textContent = i.bet;
    $('#ri-mode').textContent = t(i.mode);
    $('#ri-cost').textContent = i.cost;
    $('#ri-mult').textContent = i.mult;
    $('#ri-win').textContent = i.win;
  }

  setReplayButton(text: string, enabled: boolean): void {
    const b = $<HTMLButtonElement>('#btn-replay');
    b.textContent = t(text);
    b.disabled = !enabled;
  }

  // ---------------------------------------------------------------- message bar
  private tipTimer = 0;
  private tipIndex = 0;
  private static readonly TIPS = [
    '8 or more matching candies win anywhere',
    '3 Skull Lollipops start Trick or Treat',
    '4 Skull Lollipops award Haunted Cauldron free spins',
    '5 or more Skull Lollipops award Full Moon free spins',
    'Press space to spin',
  ];

  /** Plain message under the board (stops the idle tips). */
  message(text: string): void {
    clearInterval(this.tipTimer);
    this.tipTimer = 0;
    this.setMsg(document.createTextNode(t(text)));
  }

  /** "12 × [candy] PAYS $1.20" lines for the current tumble. */
  messageWins(wins: { src: string; count: number; pay: string }[]): void {
    clearInterval(this.tipTimer);
    this.tipTimer = 0;
    const frag = document.createDocumentFragment();
    wins.forEach((w, i) => {
      const line = document.createElement('span');
      line.className = 'msg-win';
      line.style.animationDelay = `${i * 0.12}s`;
      const img = document.createElement('img');
      img.src = w.src;
      img.alt = '';
      line.append(`${w.count} × `, img, ` ${t('PAYS')} ${w.pay}`);
      frag.appendChild(line);
    });
    this.setMsg(frag);
  }

  /** Rotating game tips between rounds. */
  tips(): void {
    if (this.tipTimer) return;
    const show = () => this.setMsg(document.createTextNode(t(Hud.TIPS[this.tipIndex++ % Hud.TIPS.length])));
    show();
    this.tipTimer = window.setInterval(show, 4000);
  }

  private setMsg(content: Node): void {
    const el = $('#msg-text');
    el.replaceChildren(content);
    el.classList.remove('msg-in');
    void el.offsetWidth;
    el.classList.add('msg-in');
  }

  // ---------------------------------------------------------------- feature panels
  /** Free spins counter: how many are left, as the format's players expect. */
  showFree(title: string, index: number, total: number): void {
    $('#fs-panel').classList.remove('hidden');
    document.body.classList.add('in-free');
    $('#fs-title').textContent = t(`${title}: spins left`);
    const el = $('#fs-count');
    const left = String(total - index);
    if (el.textContent !== left) {
      el.textContent = left;
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  setCauldron(value: number | null, bump = false): void {
    const el = $('#cauldron');
    el.classList.toggle('hidden', value === null);
    if (value === null) return;
    $('#cauldron-value').textContent = `x${value}`;
    // the brew heats up as the multiplier grows: warm, hot, inferno
    const heat = value >= 50 ? 3 : value >= 15 ? 2 : value >= 5 ? 1 : 0;
    for (let i = 1; i <= 3; i++) el.classList.toggle(`heat-${i}`, heat === i);
    if (bump) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  }

  /** The Cauldron quakes before a big pour (a truthful tell: the pour is about to happen). */
  rumbleCauldron(): void {
    const el = $('#cauldron');
    el.classList.remove('rumble');
    void el.offsetWidth;
    el.classList.add('rumble');
  }

  /** Tumble chain counter over the board ("TUMBLE x3"); null hides it. */
  combo(n: number | null): void {
    const el = $('#combo');
    if (n === null || n < 2) {
      el.classList.add('hidden');
      return;
    }
    el.querySelector('.combo-n')!.textContent = `x${n}`;
    el.dataset.level = String(Math.min(5, n));
    el.classList.remove('hidden', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /** The witch peeks in from the side of the board: something big is about to happen. */
  async peek(ms: number): Promise<void> {
    const src = panelSrc('witch');
    if (!src || document.body.classList.contains('reduced')) return;
    const el = $<HTMLImageElement>('#peek');
    el.src = src;
    el.style.setProperty('--peek-ms', `${ms}ms`);
    el.classList.remove('hidden', 'go');
    void el.offsetWidth;
    el.classList.add('go');
    await wait(ms);
    el.classList.add('hidden');
  }

  cauldronPoint(): { x: number; y: number } {
    const r = $('#cauldron').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  hideFree(): void {
    $('#fs-panel').classList.add('hidden');
    document.body.classList.remove('in-free');
    this.setCauldron(null);
  }

  setTumble(text: string | null): void {
    $('#tumble-win').classList.toggle('hidden', text === null);
    if (text !== null) $('#tumble-value').textContent = text;
  }

  // ---------------------------------------------------------------- transient messages
  toast(msg: string, ms = 3500): void {
    const el = $('#toast');
    el.textContent = t(msg);
    el.classList.remove('hidden');
    clearTimeout((el as unknown as { _t?: number })._t);
    (el as unknown as { _t?: number })._t = window.setTimeout(() => el.classList.add('hidden'), ms);
  }

  /** Banner over the board; `art` (painted lettering) replaces the text when given. */
  async banner(title: string, sub: string, ms: number, art?: string | null): Promise<void> {
    const el = $('#banner');
    $('#banner-title').textContent = t(title);
    $('#banner-sub').textContent = t(sub);
    const img = $<HTMLImageElement>('#banner-art');
    img.classList.toggle('hidden', !art);
    $('#banner-title').classList.toggle('hidden', !!art);
    $('#banner-sub').classList.toggle('hidden', !!art);
    if (art) {
      img.src = art;
      img.alt = t(title);
    }
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    await wait(ms);
    el.classList.add('hidden');
  }

  /** A full-screen card; resolves on the button, or after `autoMs` (autoplay / turbo / replay). */
  splash(title: string, sub: string, button: string, autoMs: number | null, art?: string | null): Promise<void> {
    this.splashOpen = true;
    $('#splash').classList.toggle('painted-bg', !!art);
    if (art) $('#splash').style.setProperty('--bg', cssUrl(art));
    $('#splash').dataset.art = art?.match(/bg_(\w+)\./)?.[1] ?? '';
    $('#splash-title').textContent = t(title);
    $('#splash-sub').textContent = t(sub);
    const go = $<HTMLButtonElement>('#splash-go');
    go.textContent = t(button);
    $('#splash').classList.remove('hidden');
    go.focus();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        go.removeEventListener('click', done);
        $('#splash').classList.add('hidden');
        this.splashOpen = false;
        resolve();
      };
      const timer = autoMs === null ? 0 : window.setTimeout(done, autoMs);
      go.addEventListener('click', done);
    });
  }

  introSplash(): Promise<{ skipNextTime: boolean }> {
    this.splashOpen = true;
    $('#intro').classList.remove('hidden');
    const go = $<HTMLButtonElement>('#intro-go');
    go.focus();
    return new Promise((resolve) => {
      go.addEventListener('click', () => {
        $('#intro').classList.add('hidden');
        this.splashOpen = false;
        resolve({ skipNextTime: $<HTMLInputElement>('#intro-skip').checked });
      }, { once: true });
    });
  }

  /** Big / Mega / Sugar Rush win screen with a count-up. Tap to skip. */
  /**
   * Win splash shown for every winning round: each tier the win reached punches in one after
   * the other (painted lettering where imported, else text), then the total win appears at
   * once (no count-up) and holds. `mini` is the lighter splash for wins below Big Win.
   * A tap skips straight to the total; a second tap closes.
   */
  async winSplash(
    tiers: { title: string; art?: string | null }[],
    total: string,
    x: string,
    opts: { tierMs: number; holdMs: number; mini?: boolean; fountain?: boolean; clip?: { name: ClipName; landAt: number; rate: number }; onCss?: () => void },
  ): Promise<void> {
    // Big Win and above: the win clip climbs through the tiers and the real amount lands on it
    if (opts.clip && this.clips) {
      const amount = $('#clip-amount');
      amount.querySelector('.ca-value')!.textContent = total;
      amount.querySelector('.ca-x')!.textContent = x;
      amount.classList.add('hidden');
      amount.classList.remove('show');
      const land = () => {
        amount.classList.remove('hidden');
        void amount.offsetWidth;
        amount.classList.add('show');
      };
      const ok = await this.clips.play(opts.clip.name, { rate: opts.clip.rate, cues: [[opts.clip.landAt, land]], skipTo: opts.clip.landAt });
      amount.classList.add('hidden');
      if (ok) return;
    }
    opts.onCss?.();
    return this.cssWinSplash(tiers, total, x, opts);
  }

  private cssWinSplash(tiers: { title: string; art?: string | null }[], total: string, x: string, opts: { tierMs: number; holdMs: number; mini?: boolean; fountain?: boolean }): Promise<void> {
    const el = $('#winscreen');
    $('#win-title').textContent = t(tiers[0].title);
    el.classList.remove('hidden', 'show-total', 'punch');
    el.classList.toggle('mini', !!opts.mini);
    el.querySelector('.candy-rain')?.remove();
    const stopFountain = opts.fountain && !document.body.classList.contains('reduced') ? this.fountain(el) : () => {};
    $('#win-amount').textContent = total;
    $('#win-x').textContent = x;
    const showTier = (tier: { title: string; art?: string | null }) => {
      el.classList.remove('punch');
      void el.offsetWidth;
      el.classList.add('punch');
      const img = $<HTMLImageElement>('#win-art');
      img.classList.toggle('hidden', !tier.art);
      $('#win-title').classList.toggle('hidden', !!tier.art);
      if (tier.art) {
        img.src = tier.art;
        img.alt = t(tier.title);
      }
      $('#win-title').textContent = t(tier.title);
    };
    return new Promise((resolve) => {
      const timers: number[] = [];
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        this.skipOverlay = null;
        stopFountain();
        el.classList.add('hidden');
        el.classList.remove('show-total', 'mini');
        resolve();
      };
      const showTotal = () => {
        timers.forEach(clearTimeout);
        showTier(tiers[tiers.length - 1]);
        el.classList.add('show-total');
        this.skipOverlay = close;
        timers.push(window.setTimeout(close, opts.holdMs));
      };
      this.skipOverlay = showTotal;
      showTier(tiers[0]);
      tiers.slice(1).forEach((tier, i) => timers.push(window.setTimeout(() => showTier(tier), (i + 1) * opts.tierMs)));
      timers.push(window.setTimeout(showTotal, Math.max(1, tiers.length - 1) * opts.tierMs + opts.tierMs * 0.6));
    });
  }

  /**
   * Bonus entrance, using the painted transition art:
   *   1. "BONUS!" punches in over the spinning candy tunnel;
   *   2. the haunted hallway appears with the double doors shut in its archway, and they knock;
   *   3. the doors swing open onto the bonus's own world (`dest`: cauldron, fullmoon, tot, loot);
   *   4. the camera flies through the doorway, a flash bursts at the threshold and the world
   *      fills the screen, then fades onto the game.
   * `onClosed` runs while the screen is covered, so the scene behind can switch to the bonus.
   * Without the painted art (or with reduced motion) it just calls `onClosed`.
   */
  async enterDoor(dest: string, fast: boolean, onClosed: () => void): Promise<void> {
    // the bonus entry clip: tunnel, hallway, the doors open, through into the bonus world
    const clip = ({ cauldron: 'entry-cauldron', fullmoon: 'entry-fullmoon', tot: 'entry-tot', loot: 'entry-loot' } as Record<string, ClipName>)[dest];
    if (clip && this.clips) {
      // the scene switches while the camera dives through the doorway (3.1 s to 3.9 s in the clip)
      const ok = await this.clips.play(clip, { rate: fast ? 1.6 : 1, cues: [[3.7, onClosed]], skipTo: 3.85 });
      if (ok) return;
    }
    const wall = panelSrc('portal_wall');
    const doors = panelSrc('portal_doors');
    const world = bgSrc(`portal_${dest}`);
    if (document.body.classList.contains('reduced') || !wall || !doors || !world || !portalHole) {
      onClosed();
      return;
    }
    const el = $('#portal');
    const k = this.portalSpeed(fast);
    el.style.setProperty('--k', String(k));
    el.querySelector<HTMLElement>('.portal-dest')!.style.backgroundImage = cssUrl(world);
    el.querySelector<HTMLImageElement>('.portal-wall')!.src = wall;
    el.querySelectorAll<HTMLImageElement>('.portal-door img').forEach((i) => (i.src = doors));
    const banner = panelSrc('bonus_banner');
    const intro = el.querySelector<HTMLElement>('.portal-intro')!;
    const tunnel = bgSrc('portal_tunnel');
    intro.style.setProperty('--tunnel', tunnel ? cssUrl(tunnel) : 'none');
    el.querySelector<HTMLImageElement>('.portal-banner')!.src = banner ?? '';
    el.querySelector<HTMLImageElement>('.portal-flash')!.src = panelSrc('portal_flash') ?? '';
    this.layoutPortal();
    el.className = '';
    void el.offsetWidth;
    this.h.sound('portal');
    if (banner || tunnel) {
      el.classList.add('intro');
      await wait(1050 * k);
    }
    el.classList.add('hall');
    await wait(650 * k);
    el.classList.add('knock');
    this.h.sound('knock');
    await wait(450 * k);
    onClosed();
    el.classList.add('open');
    this.h.sound('creak');
    await wait(800 * k);
    el.classList.add('through');
    this.h.sound('whoosh');
    await wait(750 * k);
    el.classList.add('arrive');
    this.h.sound('arrive');
    await wait(700 * k);
    el.className = 'hidden';
  }

  /**
   * Leaving a bonus: the moonlit graveyard seen back through the doorway zooms out of a
   * flash and fades onto the base game. `onSwitch` runs while the screen is covered.
   */
  async exitDoor(fast: boolean, onSwitch: () => void): Promise<void> {
    const world = bgSrc('portal_exit');
    if (document.body.classList.contains('reduced') || !world) {
      onSwitch();
      return;
    }
    const el = $('#portal');
    const k = this.portalSpeed(fast);
    el.style.setProperty('--k', String(k));
    el.querySelector<HTMLElement>('.portal-dest')!.style.backgroundImage = cssUrl(world);
    el.querySelector<HTMLImageElement>('.portal-flash')!.src = panelSrc('portal_flash') ?? '';
    el.className = '';
    void el.offsetWidth;
    el.classList.add('exit');
    this.h.sound('whoosh');
    await wait(450 * k);
    onSwitch();
    el.classList.add('exit-out');
    await wait(900 * k);
    el.className = 'hidden';
  }

  private portalSpeed(fast: boolean): number {
    // development builds can slow the transitions down for inspection (window.__doorSlow = 6)
    const slow = import.meta.env.DEV ? Number((window as unknown as { __doorSlow?: number }).__doorSlow ?? 1) : 1;
    return (fast ? 0.5 : 1) * slow;
  }

  /** Sizes the hallway like background-size: cover and puts the door leaves in its doorway. */
  private layoutPortal(): void {
    const stage = $('#portal .portal-stage');
    const img = stage.querySelector<HTMLImageElement>('.portal-wall')!;
    const iw = img.naturalWidth || 1672;
    const ih = img.naturalHeight || 941;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const k = Math.max(vw / iw, vh / ih);
    const w = iw * k;
    const h = ih * k;
    Object.assign(stage.style, { width: `${w}px`, height: `${h}px`, left: `${(vw - w) / 2}px`, top: `${(vh - h) / 2}px` });
    const [x0, y0, x1, y1] = portalHole!;
    const pad = 0.03;
    const leaves = stage.querySelector<HTMLElement>('.portal-leaves')!;
    Object.assign(leaves.style, {
      left: `${(x0 - (x1 - x0) * pad) * 100}%`, top: `${(y0 - (y1 - y0) * pad) * 100}%`,
      width: `${(x1 - x0) * (1 + 2 * pad) * 100}%`, height: `${(y1 - y0) * (1 + pad) * 100}%`,
    });
    // fly through the middle of the doorway
    stage.style.transformOrigin = `${((x0 + x1) / 2) * 100}% ${((y0 + y1) / 2) * 100}%`;
  }

  /**
   * Loot Box: the player opens one of the boxes. The prize is fixed by the book; the box
   * picked only decides where it is shown. Autoplay and replay pick automatically.
   */
  async lootBox(count: number, prize: { title: string; art: string | null; mult: string; amount: string }, auto: boolean, fast: boolean, onOpen: () => void): Promise<void> {
    const overlay = $('#loot');
    const row = $('#loot-boxes');
    row.innerHTML = '';
    $('#loot-prize').classList.add('hidden');
    $('#loot-sub').textContent = t('Pick a box');
    const boxes: HTMLButtonElement[] = [];
    for (let i = 0; i < count; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'loot-box';
      const art = panelSrc(`loot_box_${i + 1}`);
      b.style.setProperty('--hue', art ? '0deg' : `${i * 55}deg`);
      b.style.animationDelay = `${i * 0.08}s`;
      b.setAttribute('aria-label', t(`Loot Box ${i + 1}`));
      const img = document.createElement('img');
      img.src = art ?? 'assets/loot_box.svg';
      img.alt = '';
      b.appendChild(img);
      row.appendChild(b);
      boxes.push(b);
    }
    this.splashOpen = true;
    overlay.classList.remove('hidden');
    const chosen = await new Promise<number>((resolve) => {
      const timer = window.setTimeout(() => resolve(Math.floor(Math.random() * count)), auto ? 700 : 15000);
      boxes.forEach((b, i) => (b.onclick = () => { clearTimeout(timer); resolve(i); }));
    });
    boxes.forEach((b, i) => {
      b.onclick = null;
      b.disabled = true;
      if (i !== chosen) b.classList.add('dim');
    });
    const box = boxes[chosen];
    box.classList.add('opening');
    onOpen();
    await wait(fast ? 450 : 900);
    // the painted burst-open box replaces the closed one
    const open = panelSrc('loot_open');
    if (open) {
      box.querySelector('img')!.src = open;
      box.classList.add('burst');
    }
    box.classList.add('opened');
    if (open) await wait(fast ? 300 : 650);
    const reveal = $('#loot-prize');
    const pedestal = panelSrc('loot_pedestal');
    $('#loot-pedestal').classList.toggle('hidden', !pedestal);
    if (pedestal) $<HTMLImageElement>('#loot-pedestal').src = pedestal;
    const art = $<HTMLImageElement>('#loot-art');
    art.classList.toggle('hidden', !prize.art);
    if (prize.art) art.src = prize.art;
    $('#loot-title').textContent = t(prize.title);
    $('#loot-title').classList.toggle('hidden', !!prize.art);
    $('#loot-mult').textContent = prize.mult;
    $('#loot-amount').textContent = prize.amount;
    $('#loot-sub').textContent = '';
    reveal.classList.remove('hidden');
    await wait(fast ? 1300 : 2600);
    overlay.classList.add('hidden');
    this.splashOpen = false;
  }

  /** Candy and gold coins launched up from the bottom centre, arcing out under gravity. */
  private fountain(host: HTMLElement): () => void {
    const layer = document.createElement('div');
    layer.className = 'candy-rain';
    host.insertBefore(layer, host.children[1] ?? null);
    const ids = ['BH', 'WP', 'SL', 'GM', 'PA', 'EY', 'PU', 'BT', 'CC', 'SC', 'JK'] as const;
    type P = { el: HTMLElement; x: number; y: number; vx: number; vy: number; r: number; vr: number };
    const parts: P[] = [];
    let raf = 0;
    let last = performance.now();
    let spawn = 0;
    const W = () => host.clientWidth;
    const H = () => host.clientHeight;
    const add = () => {
      const coin = Math.random() < 0.45;
      const el = document.createElement(coin ? 'div' : 'img');
      if (coin) el.className = 'coin';
      else {
        (el as HTMLImageElement).src = symbolSrc(ids[Math.floor(Math.random() * ids.length)]);
        (el as HTMLImageElement).alt = '';
      }
      layer.appendChild(el);
      const h = H();
      parts.push({ el, x: W() / 2 + (Math.random() - 0.5) * 80, y: h + 40, vx: (Math.random() - 0.5) * W() * 0.9, vy: -(h * (1.0 + Math.random() * 0.6)), r: Math.random() * 360, vr: (Math.random() - 0.5) * 720 });
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spawn += dt;
      while (spawn > 0.035 && parts.length < 90) {
        spawn -= 0.035;
        add();
      }
      const g = H() * 1.6;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.r}deg)`;
        if (p.y > H() + 80 && p.vy > 0) {
          p.el.remove();
          parts.splice(i, 1);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      layer.remove();
    };
  }

  /**
   * Trick or Treat. The prizes are fixed by the book; the door the player knocks on only
   * decides where each prize is shown. In autoplay or replay the doors open by themselves.
   */
  async trickOrTreat(knocks: KnockEvent[], fmt: (centi: number) => string, auto: boolean, fast: boolean, onReveal: (k: KnockEvent) => void | Promise<void>): Promise<void> {
    const overlay = $('#tot');
    const doors = $('#tot-doors');
    doors.innerHTML = '';
    let total = 0;
    $('#tot-total').textContent = `${t('Treats')}: ${fmt(0)}`;
    const buttons: HTMLButtonElement[] = [];
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'door';
      b.style.backgroundImage = cssUrl(panelSrc('door') ?? 'assets/door.svg');
      b.setAttribute('aria-label', t(`Door ${i + 1}`));
      doors.appendChild(b);
      buttons.push(b);
    }
    this.splashOpen = true;
    overlay.classList.remove('hidden');
    $('#tot-sub').textContent = t('Knock on 3 doors');
    for (const k of knocks) {
      const chosen = await new Promise<number>((resolve) => {
        const open = buttons.map((b, i) => [b, i] as const).filter(([b]) => !b.disabled);
        const timer = window.setTimeout(() => resolve(open.some(([, i]) => i === k.index) ? k.index : open[0][1]), auto ? 450 : 12000);
        for (const [b, i] of open) {
          b.onclick = () => {
            clearTimeout(timer);
            resolve(i);
          };
        }
      });
      buttons.forEach((b) => (b.onclick = null));
      const door = buttons[chosen];
      door.disabled = true;
      door.classList.add('knocked');
      await wait(fast ? 150 : 350);
      const prize = document.createElement('div');
      const art = panelSrc(`door_${k.prize}`);
      const label = k.prize === 'treat' ? fmt(k.amount) : k.prize === 'trick' ? t('BOO!') : t('Free Spins!');
      if (k.prize === 'treat') total += k.amount;
      if (art) {
        // painted reveal: the door swings open on its prize, with the amount on a ribbon
        door.style.backgroundImage = cssUrl(art);
        prize.className = `prize ${k.prize} over-art`;
        prize.innerHTML = `<span></span>`;
        prize.querySelector('span')!.textContent = label;
      } else {
        const icon = k.prize === 'treat' ? symbolSrc('PU') : k.prize === 'trick' ? 'assets/ghost.svg' : symbolSrc('SC');
        prize.className = `prize ${k.prize}`;
        prize.innerHTML = `<img class="icon" src="${icon}" alt=""><span></span>`;
        prize.querySelector('span')!.textContent = label;
      }
      door.appendChild(prize);
      $('#tot-total').textContent = `${t('Treats')}: ${fmt(total)}`;
      // each Treat gets its own win splash over the doorstep before the next knock
      await onReveal(k);
      await wait(fast ? 450 : 900);
    }
    buttons.forEach((b) => { if (!b.disabled) { b.disabled = true; b.classList.add('dim'); } });
    await wait(fast ? 500 : 1300);
    overlay.classList.add('hidden');
    this.splashOpen = false;
  }

  // ---------------------------------------------------------------- dialogs
  open(sel: string): void {
    $(sel).classList.remove('hidden');
    ($(sel).querySelector('button.cta, button') as HTMLElement | null)?.focus();
  }

  close(sel: string): void {
    $(sel).classList.add('hidden');
  }

  anyModalOpen(): boolean {
    return document.querySelector('.modal:not(.hidden)') !== null;
  }

  private openAuto(): void {
    $('#auto-summary').textContent = this.autoCount ? this.h.autoplaySummary(this.autoCount) : t('Choose the number of rounds.');
    this.open('#modal-auto');
  }

  private openBuy(): void {
    this.toggleMenu(false);
    this.renderBuy();
    this.open('#modal-buy');
  }

  /** Bonus Games sheet: one card per bonus buy (art, volatility, price, buy button). */
  private renderBuy(): void {
    const box = $('#buy-options');
    const options = this.h.buyOptions();
    // the cards are built once; a bet change only updates prices, so nothing reloads or re-animates
    const cards = [...box.querySelectorAll<HTMLElement>('.buy-card')];
    if (cards.length === options.length && options.every((o, i) => cards[i].dataset.mode === o.mode)) {
      options.forEach((o, i) => {
        const price = cards[i].querySelector('.bc-price')!;
        if (price.textContent !== o.price) price.textContent = o.price;
        cards[i].querySelector('button')!.disabled = !o.affordable;
      });
      return;
    }
    box.innerHTML = '';
    for (const o of options) {
      const card = document.createElement('div');
      card.dataset.mode = o.mode;
      card.className = 'buy-card buy-option';
      card.innerHTML = '<h3></h3><div class="bc-art"><img alt=""></div><p class="bc-desc"></p><div class="bc-vol"><span></span><i></i></div><div class="bc-price"></div><button type="button" class="bc-buy"></button>';
      card.querySelector('h3')!.textContent = t(o.label);
      card.querySelector('img')!.src = o.art;
      card.querySelector('.bc-desc')!.textContent = t(o.desc);
      card.querySelector('.bc-vol span')!.textContent = t('Volatility');
      card.querySelector<HTMLElement>('.bc-vol i')!.style.setProperty('--v', String(o.vol));
      card.querySelector('.bc-price')!.textContent = o.price;
      const b = card.querySelector('button')!;
      b.textContent = t('Buy');
      b.disabled = !o.affordable;
      b.addEventListener('click', async () => {
        this.close('#modal-buy');
        if (await this.confirm(this.h.buyText(o.mode))) this.h.buy(o.mode);
      });
      box.appendChild(card);
    }
  }

  confirm(text: string): Promise<boolean> {
    $('#confirm-text').textContent = text;
    this.open('#modal-confirm');
    return new Promise((resolve) => {
      const done = (v: boolean) => {
        $('#confirm-yes').removeEventListener('click', yes);
        $('#confirm-no').removeEventListener('click', no);
        this.close('#modal-confirm');
        resolve(v);
      };
      const yes = () => done(true);
      const no = () => done(false);
      $('#confirm-yes').addEventListener('click', yes);
      $('#confirm-no').addEventListener('click', no);
    });
  }
}
