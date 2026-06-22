import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND, UI } from "../config/assetManifest";
import { PLAYER_BASES } from "../config/playerConfig";
import type { GameUser } from "../data/types";
import { makeButton } from "../ui/Button";
import { addFullscreenToggle } from "../ui/FullscreenToggle";
import { WeatherFx } from "../ui/WeatherFx";
import { startAmbientItems } from "../ui/ambientItems";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create(): void {
    this.cameras.main.fadeIn(400, 0, 0, 0);

    const user = this.registry.get("user") as GameUser;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-2);

    new WeatherFx(this, {
      rainDepth: -1,
      flashDepth: 145,
      flashMaxAlpha: 0.4,
      lightningMinMs: 4000,
      lightningMaxMs: 9000,
      quantity: 2,
      frequency: 48,
    });

    startAmbientItems(this, { depth: -0.5, alpha: 0.85, delay: 320 });

    const logo = this.add.image(GAME_WIDTH / 2, 300, UI.logo.key).setOrigin(0.5);
    logo.setScale(Math.min((GAME_WIDTH * 0.82) / logo.width, 300 / logo.height));

    this.add
      .image(GAME_WIDTH / 2, 600, PLAYER_BASES[user.gender].key, 0)
      .setDisplaySize(180, 180);

    this.add
      .text(GAME_WIDTH / 2, 740, `Halo, ${user.username}!`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color: "#e8f0ff",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 800, "Tangkap olahraga, hindari kalori berlebih.", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, 960, "MAIN", () => this.scene.start("HowToPlay"));

    addFullscreenToggle(this, GAME_WIDTH - 56, 56);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 60, "Mode demo \u2014 data & token belum terhubung", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#6b7aa0",
      })
      .setOrigin(0.5);
  }
}
