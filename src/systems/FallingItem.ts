import Phaser from "phaser";
import type { ItemDef } from "../config/itemConfig";
import { gameConfig } from "../config/gameConfig";

const FLOAT = gameConfig.item.floaty;

export class FallingItem extends Phaser.Physics.Arcade.Sprite {
  public readonly def: ItemDef;
  private readonly floaty: boolean;
  private bubble?: Phaser.GameObjects.Arc;
  private swayPhase = 0;

  constructor(scene: Phaser.Scene, x: number, def: ItemDef) {
    super(scene, x, -gameConfig.item.size, def.key);
    this.def = def;
    this.floaty = (FLOAT.types as readonly string[]).includes(def.type);
    this.setData("collected", false);
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

    if (this.floaty) {
      body.setVelocityY(speed * FLOAT.speedFactor);
      this.swayPhase = Math.random() * Math.PI * 2;
      this.setDepth(2);

      const radius = (displaySize / 2) * FLOAT.bubble.scale;
      this.bubble = this.scene.add
        .circle(this.x, this.y, radius, FLOAT.bubble.color, FLOAT.bubble.alpha)
        .setStrokeStyle(FLOAT.bubble.strokeWidth, FLOAT.bubble.strokeColor, FLOAT.bubble.strokeAlpha)
        .setDepth(1);
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
    if (this.bubble) {
      this.bubble.destroy();
      this.bubble = undefined;
    }
    super.destroy(fromScene);
  }
}
