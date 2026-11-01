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
  /** Thunder loudness for the random ambient strikes (0 = silent). */
  thunderVolume?: number;
  /** Soft rain hiss level (0 = off). */
  rainVolume?: number;
}

/**
 * Ambient rain (particle streaks) + occasional lightning (a brief full-screen
 * white double-flash with thunder). `bigStrike()` draws a visible forked bolt
 * with camera shake for dramatic moments. Cleaned up on scene shutdown.
 */
export class WeatherFx {
  private readonly scene: Phaser.Scene;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly flashMaxAlpha: number;
  private readonly flashDepth: number;
  private readonly lightningMin: number;
  private readonly lightningMax: number;
  private readonly thunderVolume: number;

  constructor(scene: Phaser.Scene, opts: WeatherOpts = {}) {
    this.scene = scene;
    this.flashMaxAlpha = opts.flashMaxAlpha ?? 0.5;
    this.flashDepth = opts.flashDepth ?? 145;
    this.lightningMin = opts.lightningMinMs ?? 5000;
    this.lightningMax = opts.lightningMaxMs ?? 10000;
    this.thunderVolume = opts.thunderVolume ?? 0.5;

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

    Sfx.startRain(opts.rainVolume ?? 0.07);
    this.scheduleLightning();
  }

  private scheduleLightning(): void {
    const delay = Phaser.Math.Between(this.lightningMin, this.lightningMax);
    this.scene.time.delayedCall(delay, () => {
      this.strike();
      this.scheduleLightning();
    });
  }

  strike(thunder = this.thunderVolume): void {
    this.flash.setAlpha(0);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: this.flashMaxAlpha,
      duration: 55,
      yoyo: true,
      repeat: 1,
      ease: "Quad.easeOut",
    });
    if (thunder > 0) {
      const v = thunder * Phaser.Math.FloatBetween(0.7, 1);
      this.scene.time.delayedCall(Phaser.Math.Between(80, 400), () => Sfx.thunder(v));
    }
  }

  /**
   * Dramatic close strike: a forked bolt from the sky to `targetY`, a bright
   * flash, camera shake and a loud thunder crack.
   */
  bigStrike(opts: { x?: number; targetY?: number; depth?: number } = {}): void {
    const s = this.scene;
    const x0 = opts.x ?? Phaser.Math.Between(GAME_WIDTH * 0.3, GAME_WIDTH * 0.7);
    const targetY = opts.targetY ?? GAME_HEIGHT * 0.62;
    const depth = opts.depth ?? this.flashDepth + 1;

    const pts = this.boltPath(x0, -20, targetY, 70);
    const forks: Phaser.Math.Vector2[][] = [];
    for (let i = 0; i < 3; i++) {
      const at = pts[Phaser.Math.Between(3, pts.length - 4)];
      forks.push(this.boltPath(at.x, at.y, at.y + Phaser.Math.Between(120, 260), 40, Phaser.Math.Between(-1, 1) || 1));
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
      alpha: Math.min(1, this.flashMaxAlpha * 2.4),
      duration: 40,
      yoyo: true,
      repeat: 2,
      ease: "Quad.easeOut",
    });
    s.cameras.main.shake(380, 0.012);
    Sfx.thunder(1);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([60, 40, 90]);
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
