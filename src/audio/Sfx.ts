/**
 * Procedural sound effects + music via the Web Audio API — no audio files to
 * download, so it stays tiny and instant on mobile.
 *
 * Browsers only allow audio after a user gesture, so `unlock()` must be called
 * from a tap/click handler (the Start screen does this). Before that, every
 * play call is a silent no-op.
 */

const MUTE_KEY = "hk_muted";

type Wave = OscillatorType;

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;

  private rainNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNextTime = 0;
  private musicTempo = 1;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      this.muted = false;
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Create/resume the AudioContext. Call from inside a user-gesture handler. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.8;
      this.sfxBus.connect(comp);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.22;
      this.musicBus.connect(comp);

      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.03);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ---------------------------------------------------------------- primitives

  private ready(): boolean {
    return !!(this.ctx && this.sfxBus && this.ctx.state === "running");
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    opts: { type?: Wave; vol?: number; to?: number; attack?: number; bus?: AudioNode } = {},
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "square";
    osc.frequency.setValueAtTime(freq, start);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
    const vol = opts.vol ?? 0.2;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(opts.bus ?? this.sfxBus!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(
    start: number,
    dur: number,
    opts: { vol?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number; attack?: number } = {},
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter ?? "lowpass";
    f.frequency.setValueAtTime(opts.freq ?? 1200, start);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, start + dur);
    f.Q.value = opts.q ?? 0.7;
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(this.sfxBus!);
    src.start(start, Math.random() * 1.5);
    src.stop(start + dur + 0.05);
  }

  // ------------------------------------------------------------------- effects

  click(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(880, t, 0.06, { type: "square", vol: 0.12, to: 1320 });
  }

  /** Activity / healthy item. `combo` raises the pitch for streaks. */
  catchGood(combo = 0): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const step = Math.min(combo, 12);
    const base = 660 * Math.pow(2, step / 12);
    this.tone(base, t, 0.09, { type: "square", vol: 0.13 });
    this.tone(base * 1.5, t + 0.06, 0.16, { type: "triangle", vol: 0.16 });
    this.tone(base * 3, t + 0.06, 0.12, { type: "sine", vol: 0.05 });
  }

  /** Neutral item (e.g. water). */
  catchNeutral(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(520, t, 0.12, { type: "sine", vol: 0.18, to: 780 });
    this.noise(t, 0.08, { filter: "bandpass", freq: 2400, vol: 0.06 });
  }

  /** Heavy food — calorie hit. */
  catchBad(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(220, t, 0.22, { type: "sawtooth", vol: 0.2, to: 70 });
    this.tone(110, t, 0.25, { type: "square", vol: 0.12, to: 55 });
    this.noise(t, 0.1, { filter: "lowpass", freq: 900, vol: 0.18 });
  }

  countdownTick(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(440, t, 0.14, { type: "square", vol: 0.16 });
  }

  go(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.055, 0.18, { type: "square", vol: 0.14 }));
  }

  /** Hunger timer running out. */
  warn(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(988, t, 0.09, { type: "square", vol: 0.12 });
    this.tone(988, t + 0.14, 0.09, { type: "square", vol: 0.12 });
  }

  /** Thunder. `intensity` 0..1: low = distant rumble, 1 = close crack. */
  thunder(intensity = 1): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const k = Math.max(0.15, Math.min(1, intensity));
    if (k > 0.6) {
      this.noise(t, 0.35, { filter: "highpass", freq: 1800, vol: 0.35 * k, attack: 0.002 });
    }
    this.noise(t + 0.02, 1.6 + k, { filter: "lowpass", freq: 700, freqTo: 90, vol: 0.55 * k, attack: 0.02 });
    this.noise(t + 0.25, 1.2 + k, { filter: "lowpass", freq: 260, freqTo: 60, vol: 0.4 * k, attack: 0.15 });
    this.tone(55, t, 1.4, { type: "sine", vol: 0.3 * k, to: 35, attack: 0.03 });
  }

  newRecord(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, t + i * 0.09, 0.22, { type: "square", vol: 0.13 }));
  }

  gameOver(starved: boolean): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const notes = starved ? [440, 415, 392, 330] : [392, 370, 349, 262];
    notes.forEach((f, i) =>
      this.tone(f, t + i * 0.22, i === notes.length - 1 ? 0.7 : 0.22, { type: "square", vol: 0.14 }),
    );
    this.tone(notes[3] / 2, t + 0.66, 0.8, { type: "triangle", vol: 0.18 });
  }

  type(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(1200 + Math.random() * 200, t, 0.04, { type: "square", vol: 0.08 });
  }

  submit(): void {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(660, t, 0.08, { type: "square", vol: 0.13 });
    this.tone(990, t + 0.08, 0.18, { type: "square", vol: 0.13 });
  }

  // --------------------------------------------------------------- ambience

  /** Continuous soft rain hiss (idempotent). */
  startRain(level = 0.08): void {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    if (!this.rainNode) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 6500;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(hp).connect(lp).connect(g).connect(this.sfxBus!);
      src.start();
      this.rainNode = src;
      this.rainGain = g;
    }
    this.rainGain!.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
  }

  // ------------------------------------------------------------------- music

  /** Light chiptune loop for gameplay. `tempo` 1 = normal; rises with difficulty. */
  startMusic(): void {
    if (!this.ready() || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.musicTempo = 1;
    this.musicNextTime = this.ctx!.currentTime + 0.1;
    this.musicBus!.gain.cancelScheduledValues(this.ctx!.currentTime);
    this.musicBus!.gain.setTargetAtTime(0.22, this.ctx!.currentTime, 0.2);
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  setMusicTempo(t: number): void {
    this.musicTempo = Math.max(1, Math.min(1.5, t));
  }

  stopMusic(fade = 0.4): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fade / 3);
    }
  }

  private scheduleMusic(): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    // Am – F – C – G, 8th notes.
    const chords = [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ];
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    const stepDur = 0.15 / this.musicTempo;
    const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

    while (this.musicNextTime < this.ctx.currentTime + 0.25) {
      const t = this.musicNextTime;
      const bar = Math.floor(this.musicStep / 8) % chords.length;
      const s = this.musicStep % 8;
      const chord = chords[bar];

      this.tone(midi(chord[arp[s]] + 12), t, stepDur * 0.9, {
        type: "square",
        vol: 0.09,
        bus: this.musicBus!,
      });
      if (s % 2 === 0) {
        this.tone(midi(chord[0] - 12), t, stepDur * 1.8, {
          type: "triangle",
          vol: 0.22,
          bus: this.musicBus!,
        });
      }
      if (s === 0 || s === 4) {
        // soft kick
        this.tone(120, t, 0.12, { type: "sine", vol: 0.25, to: 45, bus: this.musicBus! });
      } else if (s === 2 || s === 6) {
        // hat
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = 7000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(f).connect(g).connect(this.musicBus!);
        src.start(t, Math.random());
        src.stop(t + 0.06);
      }

      this.musicStep++;
      this.musicNextTime += stepDur;
    }
  }
}

export const Sfx = new SfxEngine();
