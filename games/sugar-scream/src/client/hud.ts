// DOM user interface: meters, buttons, dialogs, banners, win screens and the Trick or Treat doors.
import type { KnockPrize } from '../engine/types.ts';
import { bgSrc, buttonSrc, panelSrc, symbolSrc } from './assets.ts';
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
  intro: boolean;
}

export interface BuyOption {
  mode: string;
  label: string;
  desc: string;
  price: string;
  art: string;
  affordable: boolean;
}

export interface HudHandlers {
  spin: () => void;
  betStep: (dir: -1 | 1) => void;
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
}

export type KnockEvent = { index: number } & KnockPrize;

export class Hud {
  private turboOn = false;
  private autoCount = 0;
  private skipOverlay: (() => void) | null = null;
  splashOpen = false;
  private settings!: Settings;
  private readonly h: HudHandlers;

  constructor(h: HudHandlers) {
    this.h = h;
    $('#btn-spin').addEventListener('click', () => (this.autoActive ? h.stopAutoplay() : h.spin()));
    $('#bet-minus').addEventListener('click', () => h.betStep(-1));
    $('#bet-plus').addEventListener('click', () => h.betStep(1));
    $('#btn-turbo').addEventListener('click', () => h.turbo(!this.turboOn));
    $('#btn-sound').addEventListener('click', () => h.mute());
    $('#btn-menu').addEventListener('click', () => this.open('#modal-menu'));
    $('#btn-rules').addEventListener('click', () => { this.close('#modal-menu'); h.openRules(); });
    $('#btn-info').addEventListener('click', () => h.openRules());
    $('#btn-replay').addEventListener('click', () => h.replayPlay());
    $<HTMLInputElement>('#ante-toggle').addEventListener('change', (e) => h.ante((e.target as HTMLInputElement).checked));
    $('#btn-buy').addEventListener('click', () => this.openBuy());
    $('#btn-auto').addEventListener('click', () => (this.autoActive ? h.stopAutoplay() : this.openAuto()));
    document.querySelectorAll('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) this.close(`#${m.id}`); });
      m.querySelector('.modal-close')?.addEventListener('click', () => this.close(`#${m.id}`));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach((m) => this.close(`#${m.id}`));
    });
    for (const id of ['music', 'sfx', 'reduced', 'intro'] as const) {
      $<HTMLInputElement>(`#set-${id}`).addEventListener('change', (e) => {
        this.settings = { ...this.settings, [id]: (e.target as HTMLInputElement).checked };
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
      ...['fs_cauldron', 'fs_fullmoon', 'feature_end', 'tot'].map(bgSrc),
    ];
    for (const src of later) if (src) new Image().src = src;
    const pot = panelSrc('cauldron_icon');
    if (pot) $<HTMLImageElement>('#cauldron img').src = pot;
    // Full-screen painted backdrops for the loading, intro and Trick or Treat screens.
    for (const [sel, name] of [['#loading', 'loading'], ['#intro', 'intro'], ['#tot', 'tot']] as const) {
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
  }

  setBalance(text: string): void {
    $('#meter-balance .meter-value').textContent = text;
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

  setBet(text: string, canMinus: boolean, canPlus: boolean, locked: boolean): void {
    $('#meter-bet .meter-value').textContent = text;
    $<HTMLButtonElement>('#bet-minus').disabled = locked || !canMinus;
    $<HTMLButtonElement>('#bet-plus').disabled = locked || !canPlus;
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
    $('#btn-buy').classList.toggle('hidden', !opts.buyAvailable);
    $<HTMLButtonElement>('#btn-auto').disabled = (busy && !this.autoActive) || !opts.autoAvailable;
    $('#btn-auto').classList.toggle('hidden', !opts.autoAvailable);
    $('#btn-turbo').classList.toggle('hidden', !opts.turboAvailable);
    $<HTMLInputElement>('#ante-toggle').disabled = busy || this.autoActive;
    $('#ante').classList.toggle('disabled', busy || this.autoActive);
    $('#ante').classList.toggle('on', opts.anteOn);
    // Ante Bet is a feature bet, so it follows the jurisdiction's buy-feature flag.
    $('#ante').classList.toggle('hidden', !opts.buyAvailable);
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
    for (const id of ['music', 'sfx', 'reduced', 'intro'] as const) $<HTMLInputElement>(`#set-${id}`).checked = s[id];
    document.body.classList.toggle('reduced', s.reduced);
  }

  setReplayMode(): void {
    document.querySelectorAll('#hud > div').forEach((e) => e.classList.add('hidden'));
    $('#btn-replay').classList.remove('hidden');
  }

  setReplayButton(text: string, enabled: boolean): void {
    const b = $<HTMLButtonElement>('#btn-replay');
    b.textContent = t(text);
    b.disabled = !enabled;
  }

  // ---------------------------------------------------------------- feature panels
  showFree(title: string, index: number, total: number): void {
    $('#fs-panel').classList.remove('hidden');
    document.body.classList.add('in-free');
    $('#fs-title').textContent = t(title);
    $('#fs-count').textContent = `${index} / ${total}`;
  }

  setCauldron(value: number | null, bump = false): void {
    const el = $('#cauldron');
    el.classList.toggle('hidden', value === null);
    if (value === null) return;
    $('#cauldron-value').textContent = `x${value}`;
    if (bump) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
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

  async banner(title: string, sub: string, ms: number): Promise<void> {
    const el = $('#banner');
    $('#banner-title').textContent = t(title);
    $('#banner-sub').textContent = t(sub);
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
  winScreen(tiers: { title: string; until: number; art?: string | null }[], amount: (p: number) => string, x: string, ms: number): Promise<void> {
    const el = $('#winscreen');
    el.classList.remove('hidden');
    // candy rain made of the game's own symbols
    el.querySelector('.candy-rain')?.remove();
    if (!document.body.classList.contains('reduced')) {
      const rain = document.createElement('div');
      rain.className = 'candy-rain';
      const ids = ['BH', 'WP', 'SL', 'GM', 'PA', 'EY', 'PU', 'BT', 'CC', 'SC', 'JK'] as const;
      for (let i = 0; i < 26; i++) {
        const img = document.createElement('img');
        img.src = symbolSrc(ids[i % ids.length]);
        img.alt = '';
        img.style.left = `${Math.random() * 96}%`;
        img.style.animationDuration = `${2.6 + Math.random() * 2.4}s`;
        img.style.animationDelay = `${-Math.random() * 4}s`;
        img.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 600)}deg`);
        rain.appendChild(img);
      }
      el.insertBefore(rain, el.children[1] ?? null);
    }
    $('#win-x').textContent = x;
    // painted tier lettering when imported, else the text title
    let shown = '';
    const showTier = (tier: { title: string; art?: string | null }) => {
      if (shown === tier.title) return;
      shown = tier.title;
      const img = $<HTMLImageElement>('#win-art');
      img.classList.toggle('hidden', !tier.art);
      $('#win-title').classList.toggle('hidden', !!tier.art);
      if (tier.art) {
        img.src = tier.art;
        img.alt = t(tier.title);
        img.style.animation = 'none';
        void img.offsetWidth;
        img.style.animation = '';
      }
      $('#win-title').textContent = t(tier.title);
    };
    return new Promise((resolve) => {
      const start = performance.now();
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        $('#win-amount').textContent = amount(1);
        showTier(tiers[tiers.length - 1]);
        this.skipOverlay = () => close();
        setTimeout(close, 1100);
      };
      const close = () => {
        this.skipOverlay = null;
        el.classList.add('hidden');
        resolve();
      };
      this.skipOverlay = finish;
      const frame = () => {
        if (finished) return;
        const p = Math.min(1, (performance.now() - start) / ms);
        $('#win-amount').textContent = amount(p);
        showTier(tiers.find((tier) => p <= tier.until) ?? tiers[tiers.length - 1]);
        if (p >= 1) finish();
        else requestAnimationFrame(frame);
      };
      frame();
    });
  }

  /**
   * Trick or Treat. The prizes are fixed by the book; the door the player knocks on only
   * decides where each prize is shown. In autoplay, turbo or replay the doors open by themselves.
   */
  async trickOrTreat(knocks: KnockEvent[], fmt: (centi: number) => string, auto: boolean, onReveal: (k: KnockEvent) => void): Promise<void> {
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
      await wait(auto ? 150 : 350);
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
      onReveal(k);
      $('#tot-total').textContent = `${t('Treats')}: ${fmt(total)}`;
      await wait(auto ? 450 : 900);
    }
    buttons.forEach((b) => { if (!b.disabled) { b.disabled = true; b.classList.add('dim'); } });
    await wait(auto ? 500 : 1300);
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
    const box = $('#buy-options');
    box.innerHTML = '';
    for (const o of this.h.buyOptions()) {
      const row = document.createElement('div');
      row.className = 'buy-option';
      row.innerHTML = `<img src="${o.art}" alt=""><div><h3></h3><p></p></div><button type="button"></button>`;
      row.querySelector('h3')!.textContent = t(o.label);
      row.querySelector('p')!.textContent = t(o.desc);
      const b = row.querySelector('button')!;
      b.textContent = o.price;
      b.disabled = !o.affordable;
      b.addEventListener('click', async () => {
        this.close('#modal-buy');
        if (await this.confirm(this.h.buyText(o.mode))) this.h.buy(o.mode);
      });
      box.appendChild(row);
    }
    this.open('#modal-buy');
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
