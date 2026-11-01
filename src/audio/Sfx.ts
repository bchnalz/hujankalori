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

export type TrackName = "menu" | "game";

interface Track {
  name: TrackName;
  /** seconds per 8th-note step */
  step: number;
  volume: number;
  /** one chord (MIDI notes, root first) per bar of 8 steps */
  chords: number[][];
  /** MIDI note per step; 0 = hold/rest */
  melody: number[];
  arp: number[];
  leadWave: Wave;
  leadVol: number;
  arpVol: number;
  bassVol: number;
  bassSteps: number[];
  bassOctaveJump: boolean;
  kick: number[];
  snare: number[];
  hat: number[];
}

/* Two original chiptune loops (8 bars each). */
const TRACKS: Record<TrackName, Track> = {
  // "Rintik" — relaxed C-major loop for menus, sits under the rain.
  menu: {
    name: "menu",
    step: 0.21,
    volume: 0.2,
    chords: [
      [48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50],
      [48, 52, 55], [45, 48, 52], [50, 53, 57], [43, 47, 50],
    ],
    // prettier-ignore
    melody: [
      72, 0, 76, 0, 79, 0, 76, 0,
      76, 0, 72, 0, 69, 0, 72, 74,
      77, 0, 76, 0, 72, 0, 69, 0,
      71, 0, 74, 0, 79, 0, 0, 0,
      72, 0, 76, 79, 84, 0, 79, 0,
      81, 0, 79, 0, 76, 0, 72, 0,
      74, 0, 77, 0, 81, 0, 77, 74,
      79, 0, 0, 0, 71, 0, 74, 0,
    ],
    arp: [0, 1, 2, 1, 0, 1, 2, 1],
    leadWave: "triangle",
    leadVol: 0.2,
    arpVol: 0.035,
    bassVol: 0.2,
    bassSteps: [0, 4],
    bassOctaveJump: false,
    kick: [0],
    snare: [],
    hat: [4],
  },
  // "Kejar Kalori" — driving A-minor loop for gameplay.
  game: {
    name: "game",
    step: 0.145,
    volume: 0.22,
    chords: [
      [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62],
      [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59],
    ],
    // prettier-ignore
    melody: [
      81, 0, 79, 81, 84, 0, 81, 0,
      77, 0, 76, 77, 81, 0, 77, 0,
      76, 0, 74, 76, 79, 0, 76, 74,
      74, 0, 71, 0, 67, 0, 71, 74,
      76, 77, 76, 74, 72, 0, 69, 0,
      72, 74, 72, 71, 69, 0, 65, 0,
      67, 71, 74, 79, 77, 0, 74, 0,
      76, 0, 75, 0, 76, 0, 0, 0,
    ],
    arp: [0, 1, 2, 1, 0, 2, 1, 2],
    leadWave: "square",
    leadVol: 0.085,
    arpVol: 0.04,
    bassVol: 0.24,
    bassSteps: [0, 1, 2, 3, 4, 5, 6, 7],
    bassOctaveJump: true,
    kick: [0, 4],
    snare: [2, 6],
    hat: [1, 3, 5, 7],
  },
};

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  private unlockedAt = 0;

  private rainGain: GainNode | null = null;

  private rainLfoDepth: GainNode | null = null;
  private track: Track | null = null;
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
    if (this.ctx.state !== "running") {
      this.unlockedAt = performance.now();
      void this.ctx.resume().then(() => this.flushPending());
    }
  }

  private pendingMusic: TrackName | null = null;
  private pendingRain: number | null = null;

  private flushPending(): void {
    if (this.pendingRain !== null) this.setRainLevel(this.pendingRain);
    if (this.pendingMusic) {
      const t = this.pendingMusic;
      this.pendingMusic = null;
      this.playMusic(t);
    }
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

  /**
   * True when sounds can be scheduled. Right after `unlock()` the context may
   * still be resuming; sounds scheduled then play as soon as it resumes, so we
   * accept "suspended" for a short grace window (fixes the silent first thunder).
   */
  private ready(): boolean {
    if (!this.ctx || !this.sfxBus) return false;
    if (this.ctx.state === "running") return true;
    return this.ctx.state === "suspended" && performance.now() - this.unlockedAt < 1500;
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

  /**
   * Soft rain bed: band-limited noise (no harsh hiss) with a slow random
   * "gust" swell. `level` ~0.05 for menus, ~0.02 under gameplay music.
   */
  setRainLevel(level: number): void {
    if (!this.ready()) {
      this.pendingRain = level;
      return;
    }
    this.pendingRain = null;
    const ctx = this.ctx!;
    if (!this.rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 350;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      lp.Q.value = 0.3;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      src.connect(hp).connect(lp).connect(g).connect(this.sfxBus!);
      src.start();

      // Gusts: a very slow LFO nudges both loudness and brightness.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0;
      lfo.connect(lfoGain).connect(g.gain);
      const lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.045;
      const lfo2Gain = ctx.createGain();
      lfo2Gain.gain.value = 500;
      lfo2.connect(lfo2Gain).connect(lp.frequency);
      lfo.start();
      lfo2.start();

      this.rainGain = g;
      this.rainLfoDepth = lfoGain;
    }
    const t = ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(level, t, 0.6);
    this.rainLfoDepth!.gain.setTargetAtTime(level * 0.45, t, 0.6);
  }

  /** @deprecated kept for older call sites; same as setRainLevel. */
  startRain(level = 0.05): void {
    this.setRainLevel(level);
  }

  // ------------------------------------------------------------------- music

  /** Start a looping 8-bit track (no-op if it's already playing). */
  playMusic(name: TrackName): void {
    if (!this.ready()) {
      this.pendingMusic = name;
      return;
    }
    if (this.musicTimer !== null && this.track?.name === name) return;
    this.stopMusic(0.05);
    const ctx = this.ctx!;
    this.track = TRACKS[name];
    this.musicStep = 0;
    this.musicTempo = 1;
    this.musicNextTime = ctx.currentTime + 0.12;
    this.musicBus!.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus!.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicBus!.gain.setTargetAtTime(this.track.volume, ctx.currentTime + 0.05, 0.25);
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  /** @deprecated use playMusic("game"). */
  startMusic(): void {
    this.playMusic("game");
  }

  setMusicTempo(t: number): void {
    this.musicTempo = Math.max(1, Math.min(1.45, t));
  }

  stopMusic(fade = 0.4): void {
    this.pendingMusic = null;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.track = null;
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, Math.max(0.01, fade / 3));
    }
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    const tr = this.track;
    if (!ctx || !tr || ctx.state !== "running") return;
    const bus = this.musicBus!;
    const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
    const stepDur = tr.step / this.musicTempo;
    const loop = tr.chords.length * 8;

    while (this.musicNextTime < ctx.currentTime + 0.25) {
      const t = this.musicNextTime;
      const i = this.musicStep % loop;
      const bar = Math.floor(i / 8);
      const s = i % 8;
      const chord = tr.chords[bar];

      // lead melody
      const note = tr.melody[i];
      if (note > 0) {
        let len = 1;
        while (len < 4 && tr.melody[(i + len) % loop] === 0) len++;
        this.tone(midi(note), t, stepDur * len * 0.92, {
          type: tr.leadWave,
          vol: tr.leadVol,
          attack: 0.008,
          bus,
        });
      }
      // arpeggio
      if (tr.arpVol > 0) {
        this.tone(midi(chord[tr.arp[s]] + 12), t, stepDur * 0.8, { type: "square", vol: tr.arpVol, bus });
      }
      // bass
      if (tr.bassSteps.includes(s)) {
        const oct = tr.bassOctaveJump && s % 2 === 1 ? 12 : 0;
        this.tone(midi(chord[0] - 12 + oct), t, stepDur * 1.6, { type: "triangle", vol: tr.bassVol, bus });
      }
      // drums
      if (tr.kick.includes(s)) this.tone(130, t, 0.13, { type: "sine", vol: 0.3, to: 42, bus });
      if (tr.snare.includes(s)) this.drumNoise(t, 0.11, 1800, 0.12, "bandpass");
      if (tr.hat.includes(s)) this.drumNoise(t, 0.04, 7500, 0.05, "highpass");

      this.musicStep++;
      this.musicNextTime += stepDur;
    }
  }

  private drumNoise(t: number, dur: number, freq: number, vol: number, type: BiquadFilterType): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.musicBus!);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }
}

export const Sfx = new SfxEngine();
