// Video clips made with Remotion (videos/sugar-scream-clips, `npm run render:game`): the slot
// intro, the bonus entries, the Big-and-above win screens and the jumpscares. Each comes as a
// landscape (1280x720) and a portrait (540x960) cut; the one matching the screen plays full
// screen. Every clip is optional: if a clip cannot play (no codec, network, autoplay policy) the
// caller falls back to its CSS / canvas animation.

export type ClipName =
  | 'intro'
  | 'entry-cauldron' | 'entry-fullmoon' | 'entry-tot' | 'entry-loot'
  | 'win-big' | 'win-mega' | 'win-monster' | 'win-sugar' | 'win-max'
  | 'scare-ghost' | 'scare-witch' | 'scare-pumpkin' | 'scare-skull';

export interface PlayOptions {
  /** Playback speed (turbo, slam stop and autoplay play faster). */
  rate?: number;
  /** Callbacks at clip times in seconds; any not yet reached run when the clip is skipped or ends. */
  cues?: [number, () => void][];
  /** A tap jumps to this time (seconds) if the clip has not reached it yet; otherwise it ends the clip. */
  skipTo?: number;
}

/** Milliseconds a clip may take to start before the caller falls back (it may play next time). */
const START_TIMEOUT = 4000;

export class Clips {
  private layer = document.getElementById('clip') as HTMLElement;
  private video = this.layer.querySelector('video') as HTMLVideoElement;
  private supported = !!this.video.canPlayType?.('video/mp4; codecs="avc1.640028, mp4a.40.2"');
  private broken = new Set<string>();
  playing = false;
  /** Set by the game: whether clips may play (reduced motion turns them off). */
  enabled = () => true;
  /** Set by the game: the volume for clip audio, 0..1 (follows mute and the volume sliders). */
  volume = () => 1;
  /** Set by the game: called when a clip starts and stops (the game ducks its own music). */
  onPlaying: (on: boolean) => void = () => {};

  available(): boolean {
    return this.supported && this.enabled();
  }

  private src(name: ClipName): string {
    return `assets/clips/${name}-${innerHeight > innerWidth ? 'p' : 'l'}.mp4`;
  }

  /** Must run in a user gesture once, so later clips may play with sound (iOS). */
  unlock(): void {
    if (this.video.dataset.unlocked || !this.supported) return;
    this.video.dataset.unlocked = '1';
    this.video.muted = true;
    this.video.play().then(() => this.video.pause()).catch(() => {}).finally(() => (this.video.muted = false));
  }

  /** Warms the HTTP cache for clips that are about to be needed, one at a time. */
  async prefetch(names: ClipName[]): Promise<void> {
    if (!this.supported) return;
    for (const name of names) {
      try {
        const res = await fetch(this.src(name), { priority: 'low' } as RequestInit);
        if (res.ok) await res.blob();
      } catch {
        /* offline or blocked: the clip loads (or falls back) when played */
      }
    }
  }

  /**
   * Plays a clip full screen. Resolves true when it has played (to the end or skipped), false if
   * it could not start, in which case nothing was shown and no cue has run.
   */
  play(name: ClipName, opts: PlayOptions = {}): Promise<boolean> {
    const src = this.src(name);
    if (!this.available() || this.playing || this.broken.has(src)) return Promise.resolve(false);
    const v = this.video;
    const cues = [...(opts.cues ?? [])].sort((a, b) => a[0] - b[0]);
    this.playing = true;
    return new Promise((resolve) => {
      let started = false;
      let done = false;
      let raf = 0;
      const runCues = (upTo: number) => {
        while (cues.length && cues[0][0] <= upTo) cues.shift()![1]();
      };
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        v.removeEventListener('ended', onEnded);
        v.removeEventListener('error', onError);
        this.layer.removeEventListener('pointerdown', onTap);
        if (ok) runCues(Infinity);
        v.pause();
        this.layer.classList.add('hidden');
        this.layer.classList.remove('on');
        this.playing = false;
        this.onPlaying(false);
        resolve(ok);
      };
      const onEnded = () => finish(true);
      const onError = () => {
        this.broken.add(src);
        finish(started);
      };
      const onTap = (e: Event) => {
        e.stopPropagation();
        if (!started) return;
        if (opts.skipTo !== undefined && v.currentTime < opts.skipTo - 0.05) {
          runCues(opts.skipTo);
          v.currentTime = opts.skipTo;
        } else finish(true);
      };
      const tick = () => {
        v.volume = Math.max(0, Math.min(1, this.volume()));
        runCues(v.currentTime);
        raf = requestAnimationFrame(tick);
      };
      // slow to start (network, a busy device): fall back this time only; an error marks it broken
      const timer = window.setTimeout(() => {
        if (!started) finish(false);
      }, START_TIMEOUT);
      v.addEventListener('ended', onEnded);
      v.addEventListener('error', onError);
      this.layer.addEventListener('pointerdown', onTap);
      v.src = src;
      // a new source resets playbackRate to the default rate, so set both
      v.defaultPlaybackRate = opts.rate ?? 1;
      v.playbackRate = opts.rate ?? 1;
      v.volume = Math.max(0, Math.min(1, this.volume()));
      v.muted = false;
      const begin = () => {
        if (done) return;
        started = true;
        this.layer.classList.remove('hidden');
        void this.layer.offsetWidth;
        this.layer.classList.add('on');
        this.onPlaying(true);
        tick();
      };
      v.play().then(begin).catch((e: DOMException) => {
        // autoplay with sound refused: play the pictures silently rather than not at all
        if (e?.name === 'NotAllowedError' && !done) {
          v.muted = true;
          v.play().then(begin).catch(() => finish(false));
        } else finish(false);
      });
    });
  }
}
