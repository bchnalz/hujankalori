import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND } from "../config/assetManifest";
import type { SessionResult } from "../data/types";
import { makeButton } from "../ui/Button";

export class GameOverScene extends Phaser.Scene {
  private result: SessionResult = { survivalSeconds: 0 };

  constructor() {
    super("GameOver");
  }

  init(data: SessionResult): void {
    this.result = data ?? { survivalSeconds: 0 };
  }

  create(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.55).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const starved = this.result.reason === "starve";

    this.add
      .text(GAME_WIDTH / 2, 348, starved ? "KELAPARAN!" : "GAME OVER", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "76px",
        color: starved ? "#ffb300" : "#ffffff",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 432, starved ? "Kamu lupa makan!" : "Kalori berlebih \u2014 batas tercapai!", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#cfd8e6",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 520, "Waktu Bertahan", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "32px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 600, `${this.result.survivalSeconds.toFixed(1)} dtk`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "92px",
        color: "#7CFC8A",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, 820, "MAIN LAGI", () => this.scene.start("Game"));
    makeButton(this, GAME_WIDTH / 2, 960, "MENU", () => this.scene.start("Menu"), {
      color: 0x37406b,
    });
  }
}
