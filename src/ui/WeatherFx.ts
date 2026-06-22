import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";

const RAIN_TEX = "__rain_drop";

export interface WeatherOpts {
  rainDepth?: number;
  flashDepth?: number;
  flashMaxAlpha?: number;
  lightningMinMs?: number;
  lightningMaxMs?: number;
  frequency?: number;
  quantity?: number;
}

/**
 * Ambient rain (particle streaks) + occasional lightning (a brief full-screen
 * white double-flash). Self-managing; cleaned up automatically on scene shutdown.
 */
export class WeatherFx {
  private readonly scene: Phaser.Scene;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly flashMaxAlpha: number;
  private readonly lightningMin: number;
  private readonly lightningMax: number;

  constructor(scene: Phaser.Scene, opts: WeatherOpts = {}) {
    this.scene = scene;
    this.flashMaxAlpha = opts.flashMaxAlpha ?? 0.5;
    this.lightningMin = opts.lightningMinMs ?? 5000;
    this.lightningMax = opts.lightningMaxMs ?? 10000;

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
      .setDepth(opts.flashDepth ?? 145);

    this.scheduleLightning();
  }

  private scheduleLightning(): void {
    const delay = Phaser.Math.Between(this.lightningMin, this.lightningMax);
    this.scene.time.delayedCall(delay, () => {
      this.strike();
      this.scheduleLightning();
    });
  }

  strike(): void {
    this.flash.setAlpha(0);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: this.flashMaxAlpha,
      duration: 55,
      yoyo: true,
      repeat: 1,
      ease: "Quad.easeOut",
    });
  }
}
