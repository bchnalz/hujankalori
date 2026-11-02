import Phaser from "phaser";
import { GAME_WIDTH, gameConfig } from "../config/gameConfig";
import { CharacterArt, type Expression } from "./CharacterArt";

/** Visual size of the character (the hitbox below is unchanged). */
const ART_HEIGHT = 176;
const GROUND_Y = gameConfig.footer.top;

/**
 * Player = an invisible physics zone (the exact catch hitbox the game has
 * always used) + a larger, expressive CharacterArt standing on the street.
 * Separating the two lets the art squash, lean and grow without changing
 * gameplay.
 */
export class Player extends Phaser.GameObjects.Zone {
  readonly art: CharacterArt;
  private targetX: number;
  private leanNow = 0;

  constructor(scene: Phaser.Scene, baseKey: string) {
    const { width, height, y } = gameConfig.player;
    super(scene, GAME_WIDTH / 2, y, width, height);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(gameConfig.player.bodyWidth, gameConfig.player.bodyHeight);
    body.setOffset((width - gameConfig.player.bodyWidth) / 2, gameConfig.player.bodyOffsetY);

    this.targetX = this.x;

    // Feet on the street: the sprite's opaque bottom is 4px above the frame edge.
    const feetY = GROUND_Y + 4 * (ART_HEIGHT / 128);
    this.art = new CharacterArt(scene, this.x, feetY, baseKey, ART_HEIGHT);
  }

  get halfWidth(): number {
    return gameConfig.player.width / 2;
  }

  moveTo(x: number): void {
    this.targetX = Phaser.Math.Clamp(x, this.halfWidth, GAME_WIDTH - this.halfWidth);
  }

  nudge(dx: number): void {
    this.moveTo(this.targetX + dx);
  }

  react(e: Expression, holdMs = 650, squash = 0.14): void {
    this.art.setExpression(e, holdMs);
    if (squash) this.art.squash(squash);
  }

  preUpdate(): void {
    const prev = this.x;
    this.x = Phaser.Math.Linear(this.x, this.targetX, gameConfig.player.followLerp);
    this.art.x = this.x;
    // lean into the movement, ease back when stopping
    const want = Phaser.Math.Clamp((this.x - prev) * 0.012, -0.22, 0.22);
    this.leanNow = Phaser.Math.Linear(this.leanNow, want, 0.25);
    this.art.lean(this.leanNow);
  }
}
