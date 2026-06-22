import Phaser from "phaser";
import { GAME_WIDTH, gameConfig } from "../config/gameConfig";

/**
 * Player avatar. Moves horizontally, smoothly easing toward a target X set by
 * touch/drag (or keyboard on desktop). Catch zone is the physics body.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private targetX: number;

  constructor(scene: Phaser.Scene, baseKey: string) {
    super(scene, GAME_WIDTH / 2, gameConfig.player.y, baseKey, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDisplaySize(gameConfig.player.width, gameConfig.player.height);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(gameConfig.player.bodyWidth, gameConfig.player.bodyHeight);
    body.setOffset(
      (gameConfig.player.width - gameConfig.player.bodyWidth) / 2,
      gameConfig.player.bodyOffsetY,
    );

    this.targetX = this.x;

    const idleKey = `${baseKey}_idle`;
    if (scene.anims.exists(idleKey)) {
      this.play(idleKey);
    }
  }

  get halfWidth(): number {
    return this.displayWidth / 2;
  }

  moveTo(x: number): void {
    this.targetX = Phaser.Math.Clamp(x, this.halfWidth, GAME_WIDTH - this.halfWidth);
  }

  nudge(dx: number): void {
    this.moveTo(this.targetX + dx);
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.x = Phaser.Math.Linear(this.x, this.targetX, gameConfig.player.followLerp);
  }
}
