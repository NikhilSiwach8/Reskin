// Original procedural sound design (WebAudio synthesis, no third-party samples).
// Music (ambient haunted-bank bed) and effects have independent volume controls,
// plus a master mute required by Stake Engine.

type Sfx =
  | 'click' | 'spin' | 'reelStop' | 'land' | 'relic' | 'expand' | 'win' | 'bigWin' | 'door' | 'chain'
  | 'phantom' | 'transform' | 'tick' | 'strike' | 'bonusEnter' | 'bonusEnd' | 'retrigger' | 'keys' | 'surge';

export class Audio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private sfx?: GainNode;
  private ambience?: { stop: () => void };
  muted = false;
  musicOn = true;
  sfxOn = true;

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
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.apply();
    this.startAmbience();
  }

  apply(): void {
    if (!this.ctx || !this.master || !this.music || !this.sfx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, t, 0.05);
    this.music.gain.setTargetAtTime(this.musicOn ? 0.22 : 0, t, 0.2);
    this.sfx.gain.setTargetAtTime(this.sfxOn ? 0.7 : 0, t, 0.05);
  }

  private startAmbience(): void {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0.5;
    out.connect(this.music!);
    const nodes: AudioScheduledSourceNode[] = [];
    // Low drone in D minor with a slow filter sweep.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.connect(out);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    nodes.push(lfo);
    for (const [f, type, g] of [[73.4, 'sawtooth', 0.08], [110, 'triangle', 0.1], [146.8, 'sine', 0.06], [174.6, 'sine', 0.04]] as const) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      gn.gain.value = g;
      o.connect(gn).connect(filter);
      o.start();
      nodes.push(o);
    }
    // Occasional celesta-like notes for a spooky music-box feel.
    const scale = [293.7, 349.2, 440, 523.3, 587.3, 698.5];
    const timer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      this.tone(scale[Math.floor(Math.random() * scale.length)], 2.2, 'sine', 0.05, out, 0.4);
    }, 2600);
    this.ambience = { stop: () => { nodes.forEach((n) => n.stop()); clearInterval(timer); } };
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, dest?: AudioNode, attack = 0.005, slideTo?: number, delay = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfx!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, gain: number, freq: number, q = 1, delay = 0, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.sfx!);
    src.start(t);
  }

  play(name: Sfx): void {
    if (!this.ctx || this.muted || !this.sfxOn) return;
    switch (name) {
      case 'click': this.tone(880, 0.06, 'square', 0.05); break;
      case 'spin': this.noise(0.35, 0.25, 900, 0.7); this.tone(220, 0.3, 'triangle', 0.08, undefined, 0.01, 440); break;
      case 'reelStop': this.tone(120, 0.12, 'sine', 0.3, undefined, 0.002, 60); this.noise(0.06, 0.2, 2400, 2); break;
      case 'land': this.tone(660, 0.25, 'triangle', 0.15); this.tone(990, 0.3, 'sine', 0.08, undefined, 0.01, undefined, 0.05); break;
      case 'relic': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.1, undefined, 0.005, undefined, i * 0.05)); break;
      case 'expand': this.noise(0.5, 0.3, 500, 0.6, 0, 'lowpass'); this.tone(196, 0.6, 'sawtooth', 0.08, undefined, 0.02, 784); break;
      case 'surge': this.tone(98, 0.9, 'sawtooth', 0.12, undefined, 0.02, 392); this.noise(0.8, 0.3, 300, 0.5, 0, 'lowpass'); break;
      case 'win': [523, 659, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.12, undefined, 0.005, undefined, i * 0.07)); break;
      case 'bigWin': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.14, undefined, 0.005, undefined, i * 0.09)); break;
      case 'door': this.tone(55, 1.1, 'sawtooth', 0.2, undefined, 0.05, 40); this.noise(0.9, 0.35, 180, 0.8, 0, 'lowpass'); break;
      case 'chain': for (let i = 0; i < 5; i++) this.noise(0.05, 0.25, 3000 + i * 300, 4, i * 0.04); break;
      case 'phantom': this.tone(880, 0.8, 'sine', 0.08, undefined, 0.2, 220); this.noise(0.7, 0.12, 1200, 0.5); break;
      case 'transform': this.tone(1200, 0.18, 'sine', 0.08, undefined, 0.005, 2400); break;
      case 'tick': this.noise(0.03, 0.4, 4000, 6); this.tone(1760, 0.05, 'square', 0.03); break;
      case 'strike': [110, 220, 330].forEach((f) => this.tone(f, 2.2, 'sine', 0.18, undefined, 0.002)); break;
      case 'bonusEnter': [294, 349, 440, 587, 698, 880].forEach((f, i) => this.tone(f, 0.7, 'sawtooth', 0.06, undefined, 0.02, undefined, i * 0.1)); break;
      case 'bonusEnd': [880, 698, 587, 440].forEach((f, i) => this.tone(f, 0.8, 'triangle', 0.1, undefined, 0.01, undefined, i * 0.12)); break;
      case 'retrigger': [659, 880, 1047].forEach((f, i) => this.tone(f, 0.4, 'square', 0.06, undefined, 0.005, undefined, i * 0.06)); break;
      case 'keys': [1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.12, undefined, 0.005, undefined, i * 0.12)); break;
    }
  }

  dispose(): void {
    this.ambience?.stop();
    void this.ctx?.close();
  }
}
