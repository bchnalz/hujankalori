import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND } from "../config/assetManifest";
import { PLAYER_BASES } from "../config/playerConfig";
import type { GameUser } from "../data/types";
import { makeButton } from "../ui/Button";
import { addFullscreenToggle } from "../ui/FullscreenToggle";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create(): void {
    const user = this.registry.get("user") as GameUser;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    this.add
      .text(GAME_WIDTH / 2, 300, "CALORIE\nCATCHER", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "84px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);

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
