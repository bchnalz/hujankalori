import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { ITEMS_BY_TYPE } from "../config/itemConfig";

export interface AmbientItemsOpts {
  depth?: number;
  delay?: number;
  size?: number;
  alpha?: number;
}

/**
 * Ambient decorative rain of food/healthy item sprites (activity excluded) that
 * drift down and rotate. Used on the splash and main menu for flavour.
 */
export function startAmbientItems(scene: Phaser.Scene, opts: AmbientItemsOpts = {}): void {
  const depth = opts.depth ?? 5;
  const size = opts.size ?? 74;
  const alpha = opts.alpha ?? 0.92;
  const pool = [...ITEMS_BY_TYPE.food, ...ITEMS_BY_TYPE.healthy];

  const drop = (): void => {
    const def = pool[Phaser.Math.Between(0, pool.length - 1)];
    const img = scene.add
      .image(Phaser.Math.Between(50, GAME_WIDTH - 50), -60, def.key)
      .setDisplaySize(size, size)
      .setDepth(depth)
      .setAlpha(alpha);
    scene.tweens.add({
      targets: img,
      y: GAME_HEIGHT + 80,
      angle: Phaser.Math.Between(-50, 50),
      duration: Phaser.Math.Between(2200, 3400),
      ease: "Sine.easeIn",
      onComplete: () => img.destroy(),
    });
  };

  scene.time.addEvent({ delay: opts.delay ?? 260, loop: true, callback: drop });
}
