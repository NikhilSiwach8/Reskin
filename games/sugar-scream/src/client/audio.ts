// Music: one Halloween track cut into phrase-length loops (art/source/audio/), one per
// game area, cross-faded on the music bus, plus short stings that duck the loop.
// The procedural music-box loop is the fallback if the files can't load.
// Effects are spooky and synthesized (Web Audio, no samples): tolling bells, a pipe organ,
// creaking doors, ghosts, a witch's cackle, thunder, wind and bubbling brew. Music and
// effects have independent switches, plus the master mute that Stake Engine requires.

export type Sfx =
  | 'click' | 'drop' | 'land' | 'pop' | 'win' | 'nice' | 'bigWin' | 'spell' | 'scatter' | 'knock' | 'treat' | 'boo'
  | 'lollipop' | 'bonus' | 'mult' | 'cauldron' | 'retrigger' | 'end'
  // bonus door transition
  | 'portal' | 'creak' | 'whoosh' | 'arrive'
  // tumble chains and heavy hits
  | 'combo' | 'hit';

export type MusicArea = 'base' | 'feature' | 'free' | 'fullMoon';
export type Sting = 'bigwin' | 'end';

/** Loop lengths are exact phrase lengths (8 bars at ~90 BPM), downbeat to downbeat. */
const TRACKS: Record<MusicArea | Sting, { file: string; loop?: number }> = {
  base: { file: 'music_base', loop: 42.71 }, // intro + build, the calm half of the track
  feature: { file: 'music_feature', loop: 21.37 }, // the build: Trick or Treat, Loot Box
  free: { file: 'music_free', loop: 21.29 }, // the drop: Haunted Cauldron
  fullMoon: { file: 'music_fullmoon', loop: 21.32 }, // the peak: Full Moon
  bigwin: { file: 'sting_bigwin' }, // the drop's first two bars
  end: { file: 'sting_end' }, // the track's ending
};

export class Audio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private sfx?: GainNode;
  /** Loops go through this, so stings can duck them. */
  private duck?: GainNode;
  private buffers = new Map<MusicArea | Sting, { buf: AudioBuffer; offset: number }>();
  private area: MusicArea = 'base';
  private loop?: { area: MusicArea; src: AudioBufferSourceNode; gain: GainNode };
  private duckTimer = 0;
  /** A video clip with its own soundtrack is playing: the game's music steps aside. */
  private clipPlaying = false;
  muted = false;
  musicOn = true;
  sfxOn = true;
  /** Volumes 0..1 (menu sliders). */
  musicVol = 0.7;
  sfxVol = 0.8;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.duck = this.ctx.createGain();
    this.duck.connect(this.music);
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.apply();
    void this.loadMusic();
  }

  private async loadMusic(): Promise<void> {
    const load = async (name: MusicArea | Sting) => {
      const res = await fetch(`assets/audio/${TRACKS[name].file}.mp3`);
      if (!res.ok) throw new Error(`${res.status}`);
      const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
      this.buffers.set(name, { buf, offset: leadIn(buf) });
    };
    try {
      await load('base');
    } catch {
      this.startMusic();
      return;
    }
    this.setMusic(this.area);
    for (const name of ['free', 'feature', 'fullMoon', 'bigwin', 'end'] as const) {
      await load(name).catch(() => {});
      if (name === this.area) this.setMusic(name);
    }
  }

  /** Cross-fades to the loop for a game area; starts once its file has loaded. */
  setMusic(area: MusicArea): void {
    this.area = area;
    const ctx = this.ctx;
    const track = this.buffers.get(area);
    if (!ctx || !track || this.loop?.area === area) return;
    const t = ctx.currentTime;
    if (this.loop) {
      const old = this.loop;
      old.gain.gain.setTargetAtTime(0, t, 0.25);
      old.src.stop(t + 1.5);
    }
    const src = ctx.createBufferSource();
    src.buffer = track.buf;
    src.loop = true;
    src.loopStart = track.offset;
    src.loopEnd = track.offset + TRACKS[area].loop!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.6);
    src.connect(gain).connect(this.duck!);
    src.start(t, track.offset);
    this.loop = { area, src, gain };
  }

  /** Mutes the game's music while a video clip plays its own soundtrack. */
  setClipPlaying(on: boolean): void {
    this.clipPlaying = on;
    this.apply();
  }

  /** Volume for a clip's soundtrack (mostly effects): follows mute and the volume sliders. */
  clipVolume(): number {
    if (this.muted) return 0;
    if (this.sfxOn) return 0.9 * this.sfxVol;
    return this.musicOn ? 0.6 * this.musicVol : 0;
  }

  /** A one-shot music sting; the loop dips under it and comes back after. */
  sting(name: Sting): void {
    const ctx = this.ctx;
    const track = this.buffers.get(name);
    if (!ctx || !track || !this.duck || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = track.buf;
    src.connect(this.music!);
    src.start(t, track.offset);
    const len = track.buf.duration - track.offset;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(0.12, t, 0.08);
    window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      const now = this.ctx!.currentTime;
      this.duck!.gain.cancelScheduledValues(now);
      this.duck!.gain.setTargetAtTime(1, now, 0.4);
    }, (len - 1.2) * 1000);
  }

  apply(): void {
    if (!this.ctx || !this.master || !this.music || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, t, 0.05);
    this.music.gain.setTargetAtTime(this.musicOn && !this.clipPlaying ? 0.5 * this.musicVol : 0, t, 0.2);
    this.sfx.gain.setTargetAtTime(this.sfxOn ? 0.75 * this.sfxVol : 0, t, 0.05);
  }

  /** A detuned music box playing a minor-key waltz with a low pad underneath. */
  private startMusic(): void {
    const ctx = this.ctx!;
    const pad = ctx.createGain();
    pad.gain.value = 0.25;
    pad.connect(this.music!);
    for (const f of [110, 164.8, 220]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 14;
      o.connect(pad);
      o.start();
    }
    // A-minor waltz: [semitones above A4, beats]
    const tune: [number, number][] = [
      [0, 1], [3, 1], [7, 1], [12, 2], [10, 1], [7, 1], [8, 1], [7, 1], [3, 2], [5, 1],
      [2, 1], [5, 1], [8, 1], [7, 2], [3, 1], [0, 1], [-2, 1], [-1, 1], [0, 3],
    ];
    const beat = 0.42;
    let next = ctx.currentTime + 0.5;
    let i = 0;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < ctx.currentTime + 1.2) {
        const [n, len] = tune[i++ % tune.length];
        this.tone(440 * 2 ** (n / 12), next, beat * len * 1.6, 'sine', 0.09, this.music!, 6);
        this.tone(880 * 2 ** (n / 12), next, beat * len, 'sine', 0.025, this.music!, 9);
        next += beat * len;
      }
    };
    window.setInterval(schedule, 300);
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, detune = 0, glideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  private noiseBuf?: AudioBuffer;

  /** Exponential attack / decay envelope on a fresh gain node. */
  private env(at: number, attack: number, dur: number, vol: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    return g;
  }

  /** Filtered noise with a frequency sweep: wind, whooshes, thuds, splats, thunder. */
  private noise(at: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1, attack = 0.005): void {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    src.connect(f).connect(this.env(at, attack, dur, vol)).connect(this.sfx!);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  }

  /** A tolling bell: inharmonic partials, the high ones dying first. */
  private bell(freq: number, at: number, vol: number, dur = 2.4): void {
    [[1, 1], [2, 0.55], [2.76, 0.4], [5.4, 0.22], [8.93, 0.1]].forEach(([r, v], i) =>
      this.tone(freq * r, at, dur / (1 + i * 0.7), 'sine', vol * v, this.sfx!, (Math.random() - 0.5) * 6));
  }

  /** Music-box / celesta note: a sine with a quick metallic overtone. */
  private celesta(freq: number, at: number, vol: number): void {
    this.tone(freq, at, 0.9, 'sine', vol, this.sfx!, 4);
    this.tone(freq * 4, at, 0.18, 'sine', vol * 0.25, this.sfx!);
  }

  /** Pipe organ: detuned saws an octave apart through a dark low-pass, slow swell. */
  private organ(freqs: number[], at: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.09);
    g.gain.setValueAtTime(vol, at + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    lp.connect(g).connect(this.sfx!);
    for (const f of freqs) {
      for (const [mul, det] of [[1, -6], [1, 6], [0.5, 0]]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * mul;
        o.detune.value = det;
        o.connect(lp);
        o.start(at);
        o.stop(at + dur + 0.05);
      }
    }
  }

  /** A ghost's "wooo": a wavering triangle that swells up and sighs down, with breath. */
  private ghost(at: number, dur: number, f0: number, peak: number, f1: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(peak, at + dur * 0.35);
    o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.value = peak * 0.03;
    lfo.connect(depth).connect(o.frequency);
    o.connect(this.env(at, dur * 0.3, dur, vol)).connect(this.sfx!);
    o.start(at);
    lfo.start(at);
    o.stop(at + dur + 0.05);
    lfo.stop(at + dur + 0.05);
    this.noise(at, dur, vol * 0.25, 'bandpass', peak * 2, f1 * 2, 6, dur * 0.3);
  }

  /** A creaking door: a sawtooth whose pitch stutters (stick-slip) through wooden resonances. */
  private creak(at: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const steps = 40;
    const curve = new Float32Array(steps);
    let f = 70;
    for (let i = 0; i < steps; i++) {
      f = Math.min(130, Math.max(28, f + (Math.random() - 0.45) * 30));
      curve[i] = f;
    }
    o.frequency.setValueCurveAtTime(curve, at, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 750;
    bp.Q.value = 3;
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 1900;
    pk.gain.value = 9;
    o.connect(bp).connect(pk).connect(this.env(at, 0.08, dur, vol)).connect(this.sfx!);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** The witch's cackle: falling "ha-ha-ha" syllables through two vowel formants. */
  private cackle(at: number, vol: number, count = 7): void {
    const ctx = this.ctx!;
    for (let i = 0; i < count; i++) {
      const s = at + i * 0.12;
      const pitch = 560 * 0.96 ** i;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(pitch * 1.08, s);
      o.frequency.exponentialRampToValueAtTime(pitch * 0.85, s + 0.08);
      const g = this.env(s, 0.012, 0.09, 3 * vol * (1 - i * 0.07)); // the narrow formants eat most of the level
      for (const [ff, q] of [[850, 7], [1350, 9]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = ff;
        bp.Q.value = q;
        o.connect(bp).connect(g);
      }
      g.connect(this.sfx!);
      o.start(s);
      o.stop(s + 0.12);
    }
  }

  /** Thunder: a crack, then a long low rumble. */
  private thunder(at: number, vol: number): void {
    this.noise(at, 0.25, vol * 0.7, 'bandpass', 1400, 500, 1.5);
    this.noise(at + 0.05, 2.2, vol, 'lowpass', 260, 50, 1, 0.06);
  }

  /** Brew bubbles: little sine blips that rise as they burst. */
  private bubbles(at: number, count: number, vol: number): void {
    for (let i = 0; i < count; i++) {
      const s = at + Math.random() * 0.7;
      const f = 220 + Math.random() * 380;
      this.tone(f, s, 0.07, 'sine', vol * (0.6 + Math.random() * 0.4), this.sfx!, 0, f * 2.2);
    }
  }

  /** Phone vibration for big moments (Android; iOS has no vibration API). */
  hapticsOn = true;
  haptic(pattern: number | number[]): void {
    if (!this.hapticsOn || this.muted) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* not allowed in this frame */
    }
  }

  /** `level` lifts a tumble chain: each step of the chain plays higher and fuller. */
  play(name: Sfx, level = 0): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfx) return;
    const t = this.ctx.currentTime;
    const A = 220; // everything sits in A minor with the music
    const n = (semi: number, base = A) => base * 2 ** (semi / 12);
    switch (name) {
      case 'click': // a bone tick
        this.noise(t, 0.035, 0.7, 'bandpass', 2600, 2600, 4);
        this.tone(1250, t, 0.03, 'sine', 0.05, this.sfx);
        break;
      case 'drop': // the old board is swept away by a ghostly gust
        this.noise(t, 0.5, 0.9, 'bandpass', 1900, 280, 2.5, 0.04);
        break;
      case 'land': // coffin-lid thud
        this.tone(105, t, 0.24, 'sine', 0.38, this.sfx, 0, 42);
        this.noise(t, 0.12, 0.18, 'lowpass', 500, 120);
        break;
      case 'pop': { // candies shatter: a wet splat and a tiny ghost squeak
        this.noise(t, 0.16, 0.6, 'bandpass', 1300, 260, 1.4);
        const f = 700 + Math.random() * 400;
        this.tone(f, t + 0.02, 0.1, 'triangle', 0.07, this.sfx, 0, f * 1.7);
        break;
      }
      case 'win': { // a haunted music box: a minor arpeggio, climbing with the tumble chain
        const root = level > 0 ? [0, 3, 5, 7, 10, 12][Math.min(5, level)] : [0, 5, 7, -2][Math.floor(Math.random() * 4)];
        [12, 15, 19, 24].forEach((s, i) => this.celesta(n(root + s), t + i * 0.09, 0.13 + Math.min(0.08, level * 0.015)));
        if (level >= 2) this.bell(n(root + 24), t + 0.3, 0.05 + Math.min(0.08, level * 0.015), 1.2);
        break;
      }
      case 'combo': { // a tumble chain grows: a rising gust and a bell, higher every step
        const lift = Math.min(12, level * 2);
        this.noise(t, 0.45, 0.5, 'bandpass', 400 * 2 ** (lift / 12), 2400 * 2 ** (lift / 12), 3, 0.12);
        this.bell(n(lift), t + 0.12, 0.12, 1.6);
        if (level >= 4) this.cackle(t + 0.25, 0.25, 3);
        break;
      }
      case 'hit': // a heavy cluster lands: sub thump and a crack
        this.tone(95, t, 0.32, 'sine', 0.5, this.sfx, 0, 38);
        this.noise(t, 0.12, 0.45, 'bandpass', 1800, 600, 1.2);
        break;
      case 'nice': // small win splash: a ghostly choir and a high bell
        [0, 3, 7].forEach((s) => this.ghost(t, 1.1, n(s + 12) * 0.98, n(s + 12), n(s + 12) * 0.97, 0.06));
        this.bell(n(24), t + 0.05, 0.08, 1.4);
        break;
      case 'bigWin': // the organ thunders, the bell tolls, the witch laughs
        this.organ([n(-12), n(-5), n(0), n(3), n(7)], t, 2.4, 0.07);
        this.thunder(t, 0.35);
        this.bell(n(0), t + 0.1, 0.16);
        this.cackle(t + 0.7, 0.4);
        break;
      case 'spell': // the witch flies over: a gust, a cackle, falling sparkles
        this.noise(t, 0.8, 0.6, 'bandpass', 500, 2600, 3, 0.2);
        this.cackle(t + 0.15, 0.5);
        [31, 27, 24, 22, 19, 15].forEach((s, i) => this.celesta(n(s), t + 0.3 + i * 0.07, 0.06));
        break;
      case 'scatter': // a Skull Lollipop lands: a church bell tolls
        this.bell(n(-12), t, 0.22, 2.8);
        this.noise(t, 0.6, 0.06, 'bandpass', 3000, 6000, 8, 0.1);
        break;
      case 'knock': // knuckles on old wood, twice
        for (const d of [0, 0.17]) {
          this.tone(150, t + d, 0.09, 'sine', 0.42, this.sfx, 0, 95);
          this.noise(t + d, 0.06, 0.45, 'bandpass', 650, 400, 2);
        }
        break;
      case 'treat': // a creepy chime climbing up
        [0, 3, 7, 12, 15].forEach((s, i) => this.celesta(n(s + 12), t + i * 0.06, 0.11));
        this.bell(n(24), t + 0.3, 0.06, 1.2);
        break;
      case 'boo': // a ghost jumps out
        this.ghost(t, 1.0, 260, 540, 190, 0.22);
        this.noise(t, 0.3, 0.15, 'bandpass', 900, 300, 1.5);
        break;
      case 'lollipop': // the Golden Lollipop: bells cascade over a choir
        [24, 19, 15, 12, 7].forEach((s, i) => this.bell(n(s), t + i * 0.1, 0.07, 1.6));
        [0, 3, 7].forEach((s) => this.ghost(t + 0.2, 1.4, n(s + 12) * 0.97, n(s + 12), n(s + 12), 0.05));
        this.organ([n(-12), n(0), n(3), n(7)], t + 0.2, 1.4, 0.05);
        break;
      case 'bonus': // a bonus is coming: thunder clap, organ stab, a tolling bell
        this.thunder(t, 0.4);
        this.organ([n(-12), n(-9), n(-6), n(0)], t + 0.05, 1.3, 0.08); // diminished: dread
        this.bell(n(-12), t + 0.1, 0.18, 3);
        break;
      case 'portal': // the hallway: wind howls through the dark
        this.noise(t, 1.5, 1.8, 'bandpass', 380, 1100, 9, 0.5);
        this.noise(t + 0.4, 1.2, 1.0, 'bandpass', 700, 420, 12, 0.4);
        this.ghost(t + 0.3, 1.3, 180, 260, 150, 0.1);
        break;
      case 'creak': // the old doors swing open
        this.creak(t, 1.2, 0.9);
        this.noise(t, 1.2, 0.12, 'lowpass', 300, 120, 1, 0.2);
        break;
      case 'whoosh': // through the doorway
        this.noise(t, 0.7, 1.1, 'bandpass', 260, 2400, 2, 0.25);
        break;
      case 'arrive': // the bonus world: a swelling organ chord and a bell
        this.organ([n(-12), n(-5), n(0), n(3)], t, 1.6, 0.06);
        this.bell(n(12), t + 0.1, 0.09, 2);
        break;
      case 'mult': // a Jack-o'-Lantern bursts into flame and its value flies off
        this.noise(t, 0.45, 0.55, 'lowpass', 3200, 500, 1, 0.02);
        this.ghost(t + 0.05, 0.45, 380, 1150, 1150, 0.08);
        break;
      case 'cauldron': // the brew bubbles up
        this.bubbles(t, 12, 0.12);
        this.tone(68, t, 0.6, 'sine', 0.25, this.sfx, 0, 55);
        break;
      case 'retrigger': // more spins: double toll and a cackle
        this.bell(n(-12), t, 0.18, 2.2);
        this.bell(n(-5), t + 0.35, 0.14, 2.2);
        this.cackle(t + 0.5, 0.4, 5);
        break;
      case 'end': // the bonus closes: an organ cadence and a last bell
        this.organ([n(-7), n(-2), n(2), n(5)], t, 0.8, 0.06); // D minor
        this.organ([n(-12), n(-5), n(0), n(3)], t + 0.75, 1.5, 0.07); // A minor
        this.bell(n(0), t + 0.75, 0.12, 2.4);
        break;
    }
  }
}

/** Seconds of decoder padding before the first sound (some browsers keep the MP3 encoder delay). */
function leadIn(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  const max = Math.min(d.length, Math.floor(buf.sampleRate * 0.1));
  for (let i = 0; i < max; i++) if (Math.abs(d[i]) > 0.001) return i / buf.sampleRate;
  return 0;
}
