// Music: one Halloween track cut into phrase-length loops (art/source/audio/), one per
// game area, cross-faded on the music bus, plus short stings that duck the loop.
// The procedural music-box loop is the fallback if the files can't load.
// Effects are procedural (Web Audio synthesis). Music and effects have independent
// switches, plus the master mute that Stake Engine requires.

export type Sfx =
  | 'click' | 'drop' | 'land' | 'pop' | 'win' | 'bigWin' | 'spell' | 'scatter' | 'knock' | 'treat' | 'boo'
  | 'lollipop' | 'bonus' | 'mult' | 'cauldron' | 'retrigger' | 'end';

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
    this.music.gain.setTargetAtTime(this.musicOn ? 0.5 * this.musicVol : 0, t, 0.2);
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

  private noise(at: number, dur: number, vol: number, freq: number): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.sfx!);
    src.start(at);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfx) return;
    const t = this.ctx.currentTime;
    const out = this.sfx;
    const arp = (notes: number[], step: number, type: OscillatorType = 'square', vol = 0.12, dur = 0.18) =>
      notes.forEach((n, i) => this.tone(440 * 2 ** (n / 12), t + i * step, dur, type, vol, out));
    switch (name) {
      case 'click': this.tone(900, t, 0.05, 'square', 0.08, out); break;
      case 'drop': this.noise(t, 0.25, 0.25, 500); break;
      case 'land': this.tone(180, t, 0.12, 'sine', 0.3, out, 0, 90); break;
      case 'pop': this.tone(600 + Math.random() * 300, t, 0.12, 'sine', 0.25, out, 0, 1400); this.noise(t, 0.08, 0.15, 3000); break;
      case 'win': arp([0, 4, 7, 12], 0.07, 'triangle', 0.18); break;
      case 'bigWin': arp([0, 4, 7, 12, 16, 19, 24], 0.09, 'square', 0.12, 0.3); break;
      case 'spell': arp([12, 15, 19, 22, 27, 31], 0.05, 'sine', 0.15, 0.4); this.noise(t, 1.0, 0.12, 6000); break;
      case 'scatter': this.tone(660, t, 0.4, 'triangle', 0.2, out, 0, 990); break;
      case 'knock': this.noise(t, 0.06, 0.6, 250); this.noise(t + 0.14, 0.06, 0.6, 250); break;
      case 'treat': arp([7, 12, 16], 0.06, 'triangle', 0.18); break;
      case 'boo': this.tone(320, t, 0.7, 'sawtooth', 0.15, out, 0, 110); break;
      case 'lollipop': arp([0, 7, 12, 19, 24, 31], 0.08, 'triangle', 0.2, 0.4); break;
      case 'bonus': arp([-12, -5, 0, 3, 7, 12, 15, 19], 0.11, 'square', 0.12, 0.35); break;
      case 'mult': this.tone(300, t, 0.35, 'square', 0.14, out, 0, 1200); break;
      case 'cauldron': this.noise(t, 0.5, 0.3, 800); this.tone(140, t, 0.5, 'sine', 0.25, out, 0, 70); break;
      case 'retrigger': arp([0, 12, 7, 19, 12, 24], 0.07, 'square', 0.12); break;
      case 'end': arp([12, 7, 3, 0], 0.12, 'triangle', 0.18, 0.4); break;
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
