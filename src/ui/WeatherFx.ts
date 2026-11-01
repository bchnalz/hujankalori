import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { Sfx } from "../audio/Sfx";

const RAIN_TEX = "__rain_drop";

export interface WeatherOpts {
  rainDepth?: number;
  flashDepth?: number;
  flashMaxAlpha?: number;
  lightningMinMs?: number;
  lightningMaxMs?: number;
  frequency?: number;
  quantity?: number;
  /** Peak thunder loudness for ambient strikes (each strike varies below it). */
  thunderVolume?: number;
  /** Rain bed level (Sfx.setRainLevel). Omit to leave the current level. */
  rainVolume?: number;
  /** 0..1 chance that an ambient strike shows a visible bolt (else flash only). */
  boltChance?: number;
  /** Depth for ambient bolts (e.g. behind falling items during gameplay). */
  boltDepth?: number;
  /** Where ambient bolts end (y range). */
  boltTargetY?: [number, number];
}

interface StrikeOpts {
  x?: number;
  targetY?: number;
  depth?: number;
  /** 0..1 — scales flash, shake, thunder and vibration. */
  power?: number;
}

/**
 * Ambient rain (particle streaks) + lightning. Every strike is paired with
 * thunder: bright/close strikes crack loudly almost at once, dim ones rumble
 * softly after a delay (light travels faster than sound).
 */
export class WeatherFx {
  private readonly scene: Phaser.Scene;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly flashMaxAlpha: number;
  private readonly flashDepth: number;
  private readonly lightningMin: number;
  private readonly lightningMax: number;
  private readonly thunderVolume: number;
  private readonly boltChance: number;
  private readonly boltDepth: number;
  private readonly boltTargetY: [number, number];
  private rate = 1;

  constructor(scene: Phaser.Scene, opts: WeatherOpts = {}) {
    this.scene = scene;
    this.flashMaxAlpha = opts.flashMaxAlpha ?? 0.5;
    this.flashDepth = opts.flashDepth ?? 145;
    this.lightningMin = opts.lightningMinMs ?? 5000;
    this.lightningMax = opts.lightningMaxMs ?? 10000;
    this.thunderVolume = opts.thunderVolume ?? 0.7;
    this.boltChance = opts.boltChance ?? 0;
    this.boltDepth = opts.boltDepth ?? this.flashDepth + 1;
    this.boltTargetY = opts.boltTargetY ?? [GAME_HEIGHT * 0.45, GAME_HEIGHT * 0.75];

    if (!scene.textures.exists(RAIN_TEX)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xcfe0ff, 1);
      g.fillRect(0, 0, 3, 18);
      g.generateTexture(RAIN_TEX, 3, 18);
      g.destroy();
    }

    scene.add
      .particles(0, -24, RAIN_TEX, {
        x: { min: 0, max: GAME_WIDTH },
        y: -24,
        lifespan: 1500,
        speedY: { min: 700, max: 1000 },
        speedX: { min: -60, max: -20 },
        scaleY: { min: 0.7, max: 1.5 },
        alpha: { start: 0.45, end: 0.12 },
        quantity: opts.quantity ?? 2,
        frequency: opts.frequency ?? 45,
      })
      .setDepth(opts.rainDepth ?? -1);

    this.flash = scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 1)
      .setAlpha(0)
      .setDepth(this.flashDepth);

    if (opts.rainVolume !== undefined) Sfx.setRainLevel(opts.rainVolume);
    this.scheduleLightning();
  }

  /** >1 = more frequent ambient lightning (e.g. as gameplay gets harder). */
  setRate(rate: number): void {
    this.rate = Math.max(0.5, rate);
  }

  private scheduleLightning(): void {
    const delay = Phaser.Math.Between(this.lightningMin, this.lightningMax) / this.rate;
    this.scene.time.delayedCall(delay, () => {
      if (Math.random() < this.boltChance) {
        const [y0, y1] = this.boltTargetY;
        this.bigStrike({
          depth: this.boltDepth,
          targetY: Phaser.Math.Between(y0, y1),
          power: Phaser.Math.FloatBetween(0.45, 0.8),
        });
      } else {
        this.strike();
      }
      this.scheduleLightning();
    });
  }

  /** Sky flash (no visible bolt) + thunder scaled to its brightness. */
  strike(power = Phaser.Math.FloatBetween(0.35, 1)): void {
    this.flash.setAlpha(0);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: this.flashMaxAlpha * (0.5 + power * 0.5),
      duration: 55,
      yoyo: true,
      repeat: 1,
      ease: "Quad.easeOut",
    });
    this.thunderAfterFlash(power);
  }

  private thunderAfterFlash(power: number): void {
    if (this.thunderVolume <= 0) return;
    // Far strikes: quieter and later. Close strikes: loud, almost instant.
    const delay = Phaser.Math.Linear(700, 60, power) + Phaser.Math.Between(0, 120);
    const vol = this.thunderVolume * Phaser.Math.Linear(0.35, 1, power);
    this.scene.time.delayedCall(delay, () => Sfx.thunder(vol));
  }

  /**
   * Visible forked bolt from the sky to `targetY` with flash, camera shake,
   * thunder and phone vibration — all scaled by `power` (default 1 = dramatic).
   */
  bigStrike(opts: StrikeOpts = {}): void {
    const s = this.scene;
    const power = Phaser.Math.Clamp(opts.power ?? 1, 0.2, 1);
    const x0 = opts.x ?? Phaser.Math.Between(GAME_WIDTH * 0.15, GAME_WIDTH * 0.85);
    const targetY = opts.targetY ?? GAME_HEIGHT * 0.62;
    const depth = opts.depth ?? this.flashDepth + 1;

    const pts = this.boltPath(x0, -20, targetY, 70);
    const forks: Phaser.Math.Vector2[][] = [];
    for (let i = 0; i < 3; i++) {
      const at = pts[Phaser.Math.Between(3, Math.max(3, pts.length - 4))];
      forks.push(
        this.boltPath(at.x, at.y, at.y + Phaser.Math.Between(120, 260), 40, Phaser.Math.Between(-1, 1) || 1),
      );
    }

    const g = s.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    const drawBolt = (alpha: number): void => {
      g.clear();
      const passes: Array<[number, number, number]> = [
        [26, 0x6fa8ff, 0.18],
        [12, 0xaecbff, 0.45],
        [4, 0xffffff, 1],
      ];
      for (const [w, c, a] of passes) {
        g.lineStyle(w, c, a * alpha);
        g.strokePoints(pts, false);
        for (const f of forks) {
          g.lineStyle(Math.max(2, w * 0.5), c, a * alpha * 0.8);
          g.strokePoints(f, false);
        }
      }
    };
    drawBolt(1);

    const state = { a: 1 };
    s.tweens.add({
      targets: state,
      a: 0,
      duration: 700,
      ease: "Quad.easeIn",
      onUpdate: () => drawBolt(state.a < 0.6 && state.a > 0.45 ? 1 : state.a),
      onComplete: () => g.destroy(),
    });

    this.flash.setAlpha(0);
    s.tweens.add({
      targets: this.flash,
      alpha: Math.min(1, this.flashMaxAlpha * (1 + 1.4 * power)),
      duration: 40,
      yoyo: true,
      repeat: power > 0.7 ? 2 : 1,
      ease: "Quad.easeOut",
    });
    s.cameras.main.shake(Math.round(160 + 220 * power), 0.004 + 0.008 * power);

    if (power >= 0.9) {
      Sfx.thunder(Math.max(this.thunderVolume, 0.9));
    } else {
      this.thunderAfterFlash(power + 0.15);
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(power >= 0.9 ? [60, 40, 90] : Math.round(30 + 40 * power));
    }
  }

  private boltPath(x: number, y0: number, y1: number, jitter: number, drift = 0): Phaser.Math.Vector2[] {
    const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(x, y0)];
    const segs = Math.max(6, Math.round((y1 - y0) / 55));
    let cx = x;
    for (let i = 1; i <= segs; i++) {
      cx += Phaser.Math.Between(-jitter, jitter) + drift * jitter * 0.6;
      if (drift === 0) cx += (x - cx) * 0.35; // main bolt stays aimed at its target x
      cx = Phaser.Math.Clamp(cx, 20, GAME_WIDTH - 20);
      pts.push(new Phaser.Math.Vector2(cx, y0 + ((y1 - y0) * i) / segs));
    }
    return pts;
  }
}
