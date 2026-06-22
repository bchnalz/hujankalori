import Phaser from "phaser";
import { GAME_WIDTH, gameConfig } from "../config/gameConfig";
import { ITEMS_BY_TYPE, type ItemDef, type ItemType } from "../config/itemConfig";
import { fallSpeed, spawnIntervalMs, typeWeights } from "./Difficulty";
import { FallingItem } from "./FallingItem";

/**
 * Time-driven spawner. Spawn cadence, fall speed and the food/healthy/activity
 * mix are all derived from elapsed survival time via Difficulty (GAME-02).
 */
export class Spawner {
  private timerMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly group: Phaser.Physics.Arcade.Group,
  ) {}

  update(deltaMs: number, elapsedSeconds: number): void {
    this.timerMs -= deltaMs;
    if (this.timerMs > 0) return;
    this.timerMs = spawnIntervalMs(elapsedSeconds);
    this.spawnOne(elapsedSeconds);
  }

  private spawnOne(elapsedSeconds: number): void {
    const def = this.pickItem(elapsedSeconds);
    const margin = gameConfig.item.size;
    const x = Phaser.Math.Between(margin, GAME_WIDTH - margin);
    const item = new FallingItem(this.scene, x, def);
    this.group.add(item, true);
    item.launch(fallSpeed(elapsedSeconds));
  }

  private pickItem(elapsedSeconds: number): ItemDef {
    const w = typeWeights(elapsedSeconds);
    const total = w.food + w.healthy + w.activity;
    let roll = Math.random() * total;

    let type: ItemType = "food";
    if (roll < w.food) {
      type = "food";
    } else if ((roll -= w.food) < w.healthy) {
      type = "healthy";
    } else {
      type = "activity";
    }

    const pool = ITEMS_BY_TYPE[type];
    return pool[Phaser.Math.Between(0, pool.length - 1)];
  }
}
