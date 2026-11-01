import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND } from "../config/assetManifest";
import { fetchTop } from "../data/leaderboard";
import { makeButton } from "../ui/Button";
import { addMuteToggle } from "../ui/MuteToggle";
import { renderLeaderboard } from "../ui/LeaderboardPanel";
import { WeatherFx } from "../ui/WeatherFx";
import { Sfx } from "../audio/Sfx";

/** Public Top-15 board, opened from the menu. */
export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super("Leaderboard");
  }

  create(): void {
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-2);
    new WeatherFx(this, {
      rainDepth: -1,
      flashDepth: 145,
      flashMaxAlpha: 0.3,
      lightningMinMs: 5000,
      lightningMaxMs: 10000,
      thunderVolume: 0.6,
      rainVolume: 0.05,
    });
    Sfx.playMusic("menu");
    this.add.graphics().fillStyle(0x000000, 0.45).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    addMuteToggle(this, 56, 56);

    this.add
      .text(GAME_WIDTH / 2, 130, "PERINGKAT", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "68px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 196, "Waktu bertahan terlama", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5);

    const loading = this.add
      .text(GAME_WIDTH / 2, 560, "Memuat…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 100, "KEMBALI", () => this.scene.start("Menu"), {
      color: 0x37406b,
    });

    void fetchTop(15).then((data) => {
      if (!this.scene.isActive()) return;
      loading.destroy();
      const panel = renderLeaderboard(this, GAME_WIDTH / 2, 250, data.entries, { rowHeight: 54 });
      panel.setAlpha(0);
      this.tweens.add({ targets: panel, alpha: 1, duration: 250 });
      if (!data.online) {
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - 164, "Offline — menampilkan skor di perangkat ini", {
            fontFamily: "system-ui, sans-serif",
            fontSize: "20px",
            color: "#6b7aa0",
          })
          .setOrigin(0.5);
      }
    });
  }
}
