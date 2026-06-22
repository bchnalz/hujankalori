import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND, UI } from "../config/assetManifest";
import { ITEMS } from "../config/itemConfig";
import { PLAYER_BASES } from "../config/playerConfig";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    const barW = GAME_WIDTH * 0.6;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT / 2;

    const box = this.add.graphics();
    box.fillStyle(0x1b2238, 1).fillRoundedRect(barX, barY, barW, 26, 8);
    const fill = this.add.graphics();

    this.load.on("progress", (p: number) => {
      fill.clear();
      fill.fillStyle(0x4caf50, 1).fillRoundedRect(barX + 3, barY + 3, (barW - 6) * p, 20, 6);
    });

    for (const base of Object.values(PLAYER_BASES)) {
      this.load.spritesheet(base.key, base.asset, {
        frameWidth: base.frameWidth,
        frameHeight: base.frameHeight,
      });
    }
    for (const item of ITEMS) {
      this.load.image(item.key, item.asset);
    }
    this.load.image(BACKGROUND.key, BACKGROUND.asset);
    this.load.image(UI.token.key, UI.token.asset);
    this.load.image(UI.point.key, UI.point.asset);
    this.load.image(UI.heart.key, UI.heart.asset);
  }

  create(): void {
    for (const base of Object.values(PLAYER_BASES)) {
      const key = `${base.key}_idle`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(base.key, { start: 0, end: base.frames - 1 }),
          frameRate: 5,
          repeat: -1,
        });
      }
    }
    this.scene.start("Menu");
  }
}
