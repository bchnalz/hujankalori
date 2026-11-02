import Phaser from "phaser";
import { PALETTE } from "../config/theme";

const DOT = "__fx_dot";
const STAR = "__fx_star";
const DROP = "__fx_drop";
const CONF = "__fx_conf";
export const FX_STAR = STAR;

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

function makeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(DOT)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    g.generateTexture(DOT, 16, 16);
    g.destroy();
  }
  if (!scene.textures.exists(STAR)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    const c = 12;
    g.fillPoints(
      [
        { x: c, y: 0 },
        { x: c + 3, y: c - 3 },
        { x: 24, y: c },
        { x: c + 3, y: c + 3 },
        { x: c, y: 24 },
        { x: c - 3, y: c + 3 },
        { x: 0, y: c },
        { x: c - 3, y: c - 3 },
      ],
      true,
    );
    g.generateTexture(STAR, 24, 24);
    g.destroy();
  }
  if (!scene.textures.exists(CONF)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, 12, 7);
    g.generateTexture(CONF, 12, 7);
    g.destroy();
  }
  if (!scene.textures.exists(DROP)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillEllipse(4, 7, 8, 14);
    g.generateTexture(DROP, 8, 14);
    g.destroy();
  }
}

/**
 * Pooled particle bursts for catches and splashes (one emitter per look, so
 * nothing is created per frame).
 */
export class Fx {
  private readonly good: Emitter;
  private readonly healthy: Emitter;
  private readonly junk: Emitter;
  private readonly crumbs: Emitter;
  private readonly splashE: Emitter;

  constructor(private readonly scene: Phaser.Scene, depth = 95) {
    makeTextures(scene);
    const burst = (tex: string, tint: number[], cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}): Emitter =>
      scene.add
        .particles(0, 0, tex, {
          emitting: false,
          speed: { min: 140, max: 320 },
          angle: { min: 0, max: 360 },
          lifespan: { min: 380, max: 620 },
          scale: { start: 1, end: 0 },
          rotate: { min: 0, max: 360 },
          gravityY: 420,
          tint,
          ...cfg,
        })
        .setDepth(depth);

    this.good = burst(STAR, [PALETTE.primary.light, 0xffffff, 0xb9ffbf]);
    this.healthy = burst(STAR, [PALETTE.gold.base, 0xfff3b0, 0xffffff]);
    this.junk = burst(DOT, [PALETTE.danger.light, PALETTE.danger.base, 0xff9e97], { scale: { start: 1.1, end: 0 } });
    this.crumbs = burst(DOT, [0xc58b4e, 0x8d5a2b], { scale: { start: 0.6, end: 0.1 }, gravityY: 900, speed: { min: 80, max: 220 } });
    this.splashE = scene.add
      .particles(0, 0, DROP, {
        emitting: false,
        speedX: { min: -150, max: 150 },
        speedY: { min: -380, max: -180 },
        gravityY: 1100,
        lifespan: { min: 380, max: 560 },
        scale: { start: 0.9, end: 0.3 },
        alpha: { start: 0.9, end: 0 },
        tint: [0xcfe0ff, 0x9fd8ff, 0xffffff],
      })
      .setDepth(depth);
  }

  catchActivity(x: number, y: number): void {
    this.good.explode(16, x, y);
  }

  catchHealthy(x: number, y: number): void {
    this.healthy.explode(14, x, y);
  }

  catchJunk(x: number, y: number): void {
    this.junk.explode(14, x, y);
    this.crumbs.explode(10, x, y);
  }

  /** Confetti shower from the top of the screen. */
  confetti(ms = 1800): void {
    const e = this.scene.add
      .particles(0, -20, CONF, {
        x: { min: 0, max: this.scene.scale.gameSize.width },
        speedY: { min: 220, max: 420 },
        speedX: { min: -80, max: 80 },
        rotate: { start: 0, end: 540 },
        lifespan: 3200,
        quantity: 3,
        frequency: 28,
        scale: { min: 0.8, max: 1.4 },
        tint: [PALETTE.gold.base, PALETTE.primary.light, 0xff6f7d, 0x9fd8ff, 0xffffff],
      })
      .setDepth(400);
    this.scene.time.delayedCall(ms, () => e.stop());
    this.scene.time.delayedCall(ms + 3400, () => e.destroy());
  }

  /** Item hitting the wet street. */
  splash(x: number, y: number): void {
    this.splashE.explode(10, x, y);
    const ring = this.scene.add.ellipse(x, y + 4, 30, 9).setStrokeStyle(3, 0xcfe0ff, 0.8).setDepth(1.1);
    this.scene.tweens.add({ targets: ring, scaleX: 3.2, scaleY: 3.2, alpha: 0, duration: 450, ease: "Quad.easeOut", onComplete: () => ring.destroy() });
  }
}
