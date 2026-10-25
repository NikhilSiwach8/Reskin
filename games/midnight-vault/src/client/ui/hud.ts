// DOM user interface: control bar, feature panel, banners, modals.
// All game text is rendered here (or as Pixi text), never baked into artwork.
import type { LedgerState } from '../../engine/types.ts';
import { localizeTree, t } from './text.ts';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;

export interface HudHandlers {
  spin: () => void;
  betStep: (dir: -1 | 1) => void;
  autoplay: (count: number, stopOnFeature: boolean) => void;
  stopAutoplay: () => void;
  turbo: (on: boolean) => void;
  mute: () => void;
  buy: () => void;
  settings: (s: Settings) => void;
  replayPlay: () => void;
  openRules: () => void;
  autoplaySummary: (count: number) => string;
  buyText: () => string;
}

export interface Settings {
  music: boolean;
  sfx: boolean;
  reduced: boolean;
  turbo: boolean;
  scares: boolean;
  intro: boolean;
}

export interface BonusSplash {
  theme: string;
  background: string;
  art: string;
  kicker: string;
  title: string;
  value: string;
  desc: string;
  button: string;
  /** Continues automatically after this many ms. */
  autoMs: number;
  /** Optional per-frame update of the value text (count-up), p goes 0..1. */
  countUp?: (p: number) => string;
}

export type SpinButtonState = 'idle' | 'spinning' | 'skip' | 'disabled';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

export class Hud {
  private h: HudHandlers;
  private toastTimer = 0;
  private autoCount = 25;
  spinState: SpinButtonState = 'idle';

  constructor(handlers: HudHandlers) {
    this.h = handlers;
    this.translateStatic();
    $('#btn-spin').addEventListener('click', () => this.h.spin());
    $('#btn-bet-down').addEventListener('click', () => this.h.betStep(-1));
    $('#btn-bet-up').addEventListener('click', () => this.h.betStep(1));
    $('#btn-sound').addEventListener('click', () => this.h.mute());
    $('#btn-turbo').addEventListener('click', () => this.h.turbo($('#btn-turbo').getAttribute('aria-pressed') !== 'true'));
    $('#btn-info').addEventListener('click', () => this.h.openRules());
    $('#btn-menu').addEventListener('click', () => this.open('#modal-settings'));
    $('#btn-buy').addEventListener('click', () => {
      $('#buy-text').textContent = this.h.buyText();
      this.open('#modal-buy');
    });
    $('#buy-confirm').addEventListener('click', () => {
      this.close('#modal-buy');
      this.h.buy();
    });
    $('#btn-auto').addEventListener('click', () => {
      if ($('#btn-auto').classList.contains('running')) {
        this.h.stopAutoplay();
        return;
      }
      this.renderAutoSummary();
      this.open('#modal-auto');
    });
    document.querySelectorAll<HTMLButtonElement>('#auto-counts button').forEach((b) =>
      b.addEventListener('click', () => {
        this.autoCount = Number(b.dataset.count);
        this.renderAutoSummary();
      }),
    );
    $('#auto-confirm').addEventListener('click', () => {
      this.close('#modal-auto');
      this.h.autoplay(this.autoCount, ($('#auto-stop-feature') as HTMLInputElement).checked);
    });
    for (const id of ['#set-music', '#set-sfx', '#set-reduced', '#set-turbo', '#set-scares', '#set-intro']) $(id).addEventListener('change', () => this.emitSettings());
    document.querySelectorAll<HTMLElement>('[data-close]').forEach((el) =>
      el.addEventListener('click', () => this.close(`#${el.closest('.modal')!.id}`)),
    );
    document.querySelectorAll<HTMLElement>('.modal').forEach((m) => m.addEventListener('click', (e) => e.target === m && this.close(`#${m.id}`)));
    $('#btn-replay-play').addEventListener('click', () => this.h.replayPlay());
    // Publish the real control-bar height (it wraps onto two rows on narrow portrait screens).
    new ResizeObserver(() => document.documentElement.style.setProperty('--bar-actual', `${$('#controls').offsetHeight}px`)).observe($('#controls'));
  }

  private translateStatic(): void {
    document.querySelectorAll<HTMLElement>('.meter-label, .fp-label, .pill-btn, .replay-label, h2, #controls [aria-label], .modal-body p, .modal-body label').forEach((el) => {
      if (el.children.length === 0 && el.textContent) el.textContent = t(el.textContent);
      const label = el.getAttribute('aria-label');
      if (label) el.setAttribute('aria-label', t(label));
    });
  }

  private renderAutoSummary(): void {
    document.querySelectorAll<HTMLButtonElement>('#auto-counts button').forEach((b) => b.classList.toggle('selected', Number(b.dataset.count) === this.autoCount));
    $('.auto-summary').textContent = this.h.autoplaySummary(this.autoCount);
  }

  private emitSettings(): void {
    const v = (id: string) => ($(id) as HTMLInputElement).checked;
    this.h.settings({ music: v('#set-music'), sfx: v('#set-sfx'), reduced: v('#set-reduced'), turbo: v('#set-turbo'), scares: v('#set-scares'), intro: v('#set-intro') });
  }

  /** Mirrors stored settings into the settings dialog. */
  showSettings(st: Settings): void {
    const set = (id: string, on: boolean) => (($(id) as HTMLInputElement).checked = on);
    set('#set-music', st.music);
    set('#set-sfx', st.sfx);
    set('#set-reduced', st.reduced);
    set('#set-turbo', st.turbo);
    set('#set-scares', st.scares);
    set('#set-intro', st.intro);
  }

  // ---------------------------------------------------------------- splash screens
  splashOpen = false;

  /** Intro splash; resolves when the player continues (click, tap, Enter or Space). */
  introSplash(): Promise<{ skipNextTime: boolean }> {
    const el = $('#splash-intro');
    localizeTree(el);
    el.hidden = false;
    this.splashOpen = true;
    return new Promise((resolve) => {
      const done = (e?: Event) => {
        if (e && (e.target as HTMLElement).closest('.splash-skip')) return;
        el.removeEventListener('click', done);
        window.removeEventListener('keydown', key, true);
        el.hidden = true;
        this.splashOpen = false;
        resolve({ skipNextTime: ($('#splash-intro-skip') as HTMLInputElement).checked });
      };
      const key = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();
          done();
        }
      };
      el.addEventListener('click', done);
      window.addEventListener('keydown', key, true);
    });
  }

  /** Full-screen bonus intro / outro splash. Continues on click or automatically. */
  bonusSplash(o: BonusSplash): Promise<void> {
    const el = $('#splash-bonus');
    el.dataset.theme = o.theme;
    el.querySelector<HTMLElement>('.splash-bg')!.style.backgroundImage = `url('${o.background}')`;
    (el.querySelector('.sb-art') as HTMLImageElement).src = o.art;
    el.querySelector('.sb-kicker')!.textContent = t(o.kicker);
    el.querySelector('.sb-title')!.textContent = t(o.title);
    el.querySelector('.sb-value')!.textContent = o.countUp ? o.countUp(0) : t(o.value);
    el.querySelector('.sb-desc')!.textContent = t(o.desc);
    $('#splash-bonus-go').textContent = t(o.button);
    // restart CSS entrance animations
    el.querySelectorAll<HTMLElement>('.sb-art, .sb-title, .sb-value, .sb-desc').forEach((n) => {
      n.style.animation = 'none';
      void n.offsetWidth;
      n.style.animation = '';
    });
    el.hidden = false;
    this.splashOpen = true;
    return new Promise((resolve) => {
      const start = performance.now();
      let raf = 0;
      const tick = () => {
        const elapsed = performance.now() - start;
        if (o.countUp) el.querySelector('.sb-value')!.textContent = o.countUp(Math.min(1, elapsed / Math.min(2200, o.autoMs * 0.6)));
        const left = Math.ceil((o.autoMs - elapsed) / 1000);
        el.querySelector('.sb-auto')!.textContent = left > 0 ? t(`Continues in ${left}s`) : '';
        if (elapsed >= o.autoMs) return done();
        raf = requestAnimationFrame(tick);
      };
      const done = () => {
        cancelAnimationFrame(raf);
        el.removeEventListener('click', done);
        window.removeEventListener('keydown', key, true);
        if (o.countUp) el.querySelector('.sb-value')!.textContent = o.countUp(1);
        el.hidden = true;
        this.splashOpen = false;
        resolve();
      };
      const key = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();
          done();
        }
      };
      el.addEventListener('click', done);
      window.addEventListener('keydown', key, true);
      raf = requestAnimationFrame(tick);
    });
  }

  open(sel: string): void {
    $(sel).hidden = false;
    $(sel).querySelector<HTMLElement>('.close-btn')?.focus();
  }

  close(sel: string): void {
    $(sel).hidden = true;
  }

  anyModalOpen(): boolean {
    return [...document.querySelectorAll<HTMLElement>('.modal')].some((m) => !m.hidden);
  }

  closeModals(): void {
    document.querySelectorAll<HTMLElement>('.modal').forEach((m) => (m.hidden = true));
  }

  // ---------------------------------------------------------------- meters
  setBalance(text: string): void {
    $('#meter-balance .meter-value').textContent = text;
  }

  setBet(text: string, canDown: boolean, canUp: boolean, locked: boolean): void {
    $('#meter-bet .meter-value').textContent = text;
    ($('#btn-bet-down') as HTMLButtonElement).disabled = locked || !canDown;
    ($('#btn-bet-up') as HTMLButtonElement).disabled = locked || !canUp;
  }

  setWin(text: string): void {
    $('#meter-win .meter-value').textContent = text;
  }

  setSpin(state: SpinButtonState): void {
    this.spinState = state;
    const b = $('#btn-spin') as HTMLButtonElement;
    b.disabled = state === 'disabled';
    b.classList.toggle('spinning', state === 'spinning' || state === 'skip');
    b.setAttribute('aria-label', t(state === 'skip' ? 'Show result' : 'Spin'));
  }

  setControlsLocked(locked: boolean, opts: { buyAvailable: boolean; autoAvailable: boolean; turboAvailable: boolean }): void {
    ($('#btn-buy') as HTMLButtonElement).disabled = locked;
    $('#btn-buy').hidden = !opts.buyAvailable;
    $('#btn-auto').hidden = !opts.autoAvailable;
    $('#btn-turbo').hidden = !opts.turboAvailable;
    ($('#set-turbo') as HTMLInputElement).disabled = !opts.turboAvailable;
  }

  setTurbo(on: boolean): void {
    $('#btn-turbo').setAttribute('aria-pressed', String(on));
    ($('#set-turbo') as HTMLInputElement).checked = on;
  }

  setMuted(muted: boolean): void {
    $('#btn-sound').classList.toggle('muted', muted);
    $('#btn-sound').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  setAutoplay(remaining: number | null): void {
    $('#btn-auto').classList.toggle('running', remaining !== null);
    $('#btn-auto').setAttribute('aria-pressed', String(remaining !== null));
    $('#btn-auto').setAttribute('aria-label', remaining !== null ? 'Stop autoplay' : 'Autoplay');
    $('.auto-count').textContent = remaining !== null ? String(remaining) : '';
  }

  setReducedMotion(on: boolean): void {
    document.body.classList.toggle('reduced-motion', on);
    ($('#set-reduced') as HTMLInputElement).checked = on;
  }

  // ---------------------------------------------------------------- feature panel
  showFeature(title: string): void {
    const p = $('#feature-panel');
    p.hidden = false;
    $('.fp-title').textContent = t(title);
  }

  hideFeature(): void {
    $('#feature-panel').hidden = true;
    $('.ledger').hidden = true;
    $('.fp-respins').hidden = true;
    $('.fp-hour').hidden = true;
    $('.fp-spins').hidden = false;
  }

  setSpins(index: number, total: number, label?: string): void {
    $('.fp-spins').hidden = false;
    $('.fp-spins .fp-label').textContent = t(label ?? 'Free spins');
    $('.fp-spins .fp-value').textContent = `${index} / ${total}`;
  }

  setRespins(left: number | null): void {
    $('.fp-respins').hidden = left === null;
    if (left !== null) $('.fp-respins .fp-value').textContent = String(left);
  }

  setHour(hour: number | null): void {
    $('.fp-hour').hidden = hour === null;
    if (hour !== null) $('.fp-hour .fp-value').textContent = ROMAN[hour] ?? String(hour);
  }

  setBonusWin(text: string): void {
    $('.fp-win .fp-value').textContent = text;
  }

  setLedger(seals: LedgerState, active: (keyof LedgerState)[], clockLabel: (progress: number) => string): void {
    $('.ledger').hidden = false;
    for (const key of ['relic', 'phantom', 'clock'] as const) {
      const s = seals[key];
      const el = $(`.seal[data-seal="${key}"]`);
      const top = s.thresholds[s.thresholds.length - 1];
      el.classList.toggle('active', active.includes(key));
      el.classList.toggle('complete', s.level >= s.thresholds.length);
      el.querySelector<HTMLElement>('.seal-bar i')!.style.width = `${Math.min(100, (s.progress / top) * 100)}%`;
      el.querySelector('.seal-meta')!.textContent =
        key === 'clock' ? clockLabel(s.progress) : `${s.progress} / ${top}${s.level ? ` · level ${s.level}` : ''}`;
    }
  }

  // ---------------------------------------------------------------- banners
  async banner(title: string, sub = '', ms = 1400, big = false): Promise<void> {
    const b = $('#banner');
    $('.banner-title').textContent = t(title);
    $('.banner-sub').textContent = t(sub);
    b.classList.toggle('big', big);
    b.hidden = false;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    await wait(ms);
    b.hidden = true;
  }

  setBannerSub(text: string): void {
    $('.banner-sub').textContent = text;
  }

  showBanner(title: string, sub: string, big: boolean): void {
    const b = $('#banner');
    $('.banner-title').textContent = t(title);
    $('.banner-sub').textContent = sub;
    b.classList.toggle('big', big);
    b.hidden = false;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  hideBanner(): void {
    $('#banner').hidden = true;
  }

  async keysChoice(path: string, turbo: boolean): Promise<void> {
    const el = $('#keys-choice');
    el.hidden = false;
    const figs = [...el.querySelectorAll<HTMLElement>('figure')];
    figs.forEach((f) => f.classList.remove('chosen', 'dimmed'));
    await wait(turbo ? 300 : 900);
    for (const f of figs) {
      if (f.dataset.path === path) f.classList.add('chosen');
      else f.classList.add('dimmed');
    }
    await wait(turbo ? 600 : 1500);
    el.hidden = true;
  }

  toast(message: string, ms = 5000): void {
    const el = $('#toast');
    el.textContent = t(message);
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), ms);
  }

  setLoading(p: number, text?: string): void {
    $('.loading-fill').style.width = `${Math.round(p * 100)}%`;
    if (text) $('.loading-text').textContent = t(text);
  }

  hideLoading(): void {
    $('#loading').hidden = true;
  }

  setReplayMode(): void {
    $('#controls').hidden = true;
    $('#replay-bar').hidden = false;
  }

  setReplayButton(label: string, enabled: boolean): void {
    const b = $('#btn-replay-play') as HTMLButtonElement;
    b.textContent = t(label);
    b.disabled = !enabled;
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
