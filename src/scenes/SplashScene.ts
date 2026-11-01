import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND, UI } from "../config/assetManifest";
import { ITEMS } from "../config/itemConfig";
import { PLAYER_BASES } from "../config/playerConfig";
import { WeatherFx } from "../ui/WeatherFx";
import { startAmbientItems } from "../ui/ambientItems";

/**
 * Brand/opening splash (~2s): black screen fades in, holds the centered logo
 * over raining food/healthy items + rain & lightning, then fades to the Menu.
 * Game assets are loaded here so there's no separate loading screen.
 */
export class SplashScene extends Phaser.Scene {
  constructor() {
    super("Splash");
  }

  preload(): void {
    this.load.image("natagassa", "assets/ui/natagassa.png");
    for (const base of Object.values(PLAYER_BASES)) {
      this.load.spritesheet(base.key, base.asset, {
        frameWidth: base.frameWidth,
        frameHeight: base.frameHeight,
      });
    }
    for (const item of ITEMS) this.load.image(item.key, item.asset);
    this.load.image(BACKGROUND.key, BACKGROUND.asset);
    this.load.image(UI.logo.key, UI.logo.asset);
    this.load.image(UI.token.key, UI.token.asset);
    this.load.image(UI.point.key, UI.point.asset);
    this.load.image(UI.heart.key, UI.heart.asset);
  }

  create(): void {
    this.buildAnims();
    this.cameras.main.setBackgroundColor("#05070f");

    new WeatherFx(this, {
      rainDepth: 0,
      flashDepth: 20,
      flashMaxAlpha: 0.6,
      lightningMinMs: 800,
      lightningMaxMs: 1400,
      quantity: 3,
      frequency: 35,
      thunderVolume: 0.55,
    });

    startAmbientItems(this, { depth: 5 });

    const logo = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "natagassa").setOrigin(0.5).setDepth(10);
    const scale = Math.min((GAME_WIDTH * 0.7) / logo.width, (GAME_HEIGHT * 0.5) / logo.height, 1);
    logo.setScale(scale);

    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.time.delayedCall(2000, () => this.cameras.main.fadeOut(500, 0, 0, 0));
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("Menu"));
  }

  private buildAnims(): void {
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
  }
}
