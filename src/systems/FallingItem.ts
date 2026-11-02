import Phaser from "phaser";
import type { ItemDef } from "../config/itemConfig";
import { gameConfig } from "../config/gameConfig";
import { GLOW_TUNING, ensureGlowTexture, ensureTrailTexture, sparkEmitter } from "./ItemGlow";

const FLOAT = gameConfig.item.floaty;

export class FallingItem extends Phaser.Physics.Arcade.Sprite {
  public readonly def: ItemDef;
  private readonly floaty: boolean;
  private bubble?: Phaser.GameObjects.Arc;
  private swayPhase = 0;
  private glow?: Phaser.GameObjects.Image;
  private trail?: Phaser.GameObjects.Image;
  private sparkClock = 0;

  constructor(scene: Phaser.Scene, x: number, def: ItemDef) {
    super(scene, x, -gameConfig.item.size, def.key);
    this.def = def;
    this.floaty = (FLOAT.types as readonly string[]).includes(def.type);
    this.setData("collected", false);

    // neon outline + light trail, colour-coded by item type
    this.glow = scene.add
      .image(x, this.y, ensureGlowTexture(scene, def.key, def.type))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(1);
    this.trail = scene.add
      .image(x, this.y, ensureTrailTexture(scene, def.type))
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(GLOW_TUNING.trailAlpha);
    scene.tweens.add({
      targets: this.glow,
      alpha: GLOW_TUNING.pulseMin,
      duration: GLOW_TUNING.pulseMs,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: Math.random() * GLOW_TUNING.pulseMs,
    });
    this.sparkClock = Math.random() * GLOW_TUNING.sparkEveryMs;
    // Sync after Arcade physics has moved the sprite (postupdate), so the glow
    // never lags behind the item even when a frame is slow.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
  }

  private onPostUpdate(_time: number, delta: number): void {
    if (this.active) this.syncGlow(delta);
  }

  private syncGlow(delta: number): void {
    const d = this.depth;
    if (this.bubble) this.bubble.setPosition(this.x, this.y);
    if (this.glow) {
      this.glow.setPosition(this.x, this.y).setRotation(this.rotation).setScale(this.scaleX, this.scaleY).setDepth(d - 0.05);
    }
    if (this.trail) {
      this.trail
        .setPosition(this.x, this.y - this.displayHeight * 0.3)
        .setScale(Math.max(0.6, this.displayWidth / 96), 1)
        .setDepth(d - 0.06);
    }
    // a few light sparks around the item
    this.sparkClock -= delta;
    if (this.sparkClock <= 0) {
      this.sparkClock += GLOW_TUNING.sparkEveryMs;
      const r = this.displayWidth * 0.45;
      sparkEmitter(this.scene, this.def.type).emitParticleAt(
        this.x + Phaser.Math.Between(-r, r),
        this.y + Phaser.Math.Between(-r, r),
        1,
      );
    }
  }

  /**
   * Must be called AFTER the item is added to the physics group (the group
   * overwrites the body with its defaults on add, so velocity is set here).
   *
   * Floaty items (activity) descend slowly, sway side-to-side like a falling
   * tissue, are wrapped in a bubble, and are drawn a little larger.
   */
  launch(speed: number): void {
    const typeBonus = (gameConfig.item.sizeBonusByType as Record<string, number>)[this.def.type] ?? 0;
    const displaySize = gameConfig.item.size + (this.floaty ? FLOAT.sizeBonus : 0) + typeBonus;
    this.setDisplaySize(displaySize, displaySize);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    const srcW = this.width;
    const srcH = this.height;
    const r = Math.min(srcW, srcH) * 0.42;
    body.setCircle(r, srcW / 2 - r, srcH / 2 - r);

    // pop in as it appears
    const sx = this.scaleX;
    const sy = this.scaleY;
    this.setScale(sx * 0.25, sy * 0.25);
    this.scene.tweens.add({ targets: this, scaleX: sx, scaleY: sy, duration: 240, ease: "Back.easeOut" });

    if (this.floaty) {
      body.setVelocityY(speed * FLOAT.speedFactor);
      this.swayPhase = Math.random() * Math.PI * 2;
      this.setDepth(2);

      const radius = (displaySize / 2) * FLOAT.bubble.scale;
      this.bubble = this.scene.add
        .circle(this.x, this.y, radius, FLOAT.bubble.color, FLOAT.bubble.alpha)
        .setStrokeStyle(FLOAT.bubble.strokeWidth, FLOAT.bubble.strokeColor, FLOAT.bubble.strokeAlpha)
        .setDepth(1)
        .setScale(0.25);
      this.scene.tweens.add({ targets: this.bubble, scale: 1, duration: 240, ease: "Back.easeOut" });
    } else {
      body.setVelocityY(speed);
    }
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.floaty) return;

    const t = time / 1000;
    const phase = t * FLOAT.swayFrequency + this.swayPhase;

    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.setVelocityX(Math.cos(phase) * FLOAT.swayAmplitude);

    this.rotation = Math.sin(phase) * FLOAT.rotationSway;

    if (this.bubble) this.bubble.setPosition(this.x, this.y);
  }

  collect(): void {
    this.setData("collected", true);
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.destroy();
  }

  destroy(fromScene?: boolean): void {
    this.scene?.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.glow?.destroy();
    this.glow = undefined;
    this.trail?.destroy();
    this.trail = undefined;
    if (this.bubble) {
      this.bubble.destroy();
      this.bubble = undefined;
    }
    super.destroy(fromScene);
  }
}
