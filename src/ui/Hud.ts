import Phaser from "phaser";
import { GAME_WIDTH, gameConfig } from "../config/gameConfig";

const BAR_X = 24;
const BAR_Y = 28;
const BAR_W = GAME_WIDTH - 48;
const BAR_H = 34;

/**
 * In-game heads-up display: HP bar (dynamic, drawn with Graphics) + numeric HP
 * and the running survival timer (the score per GAME-01).
 */
export class Hud {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(101);

    this.hpText = scene.add
      .text(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(102);

    this.timeText = scene.add
      .text(GAME_WIDTH / 2, BAR_Y + BAR_H + 28, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "30px",
        color: "#e8f0ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(102);
  }

  update(hp: number, elapsedSeconds: number): void {
    const ratio = Phaser.Math.Clamp(hp / gameConfig.maxHp, 0, 1);

    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.45);
    this.bg.fillRoundedRect(BAR_X - 4, BAR_Y - 4, BAR_W + 8, BAR_H + 8, 10);

    let color = 0x4caf50;
    if (ratio < 0.25) color = 0xe53935;
    else if (ratio < 0.5) color = 0xffb300;

    this.bar.clear();
    this.bar.fillStyle(0x10131c, 1);
    this.bar.fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, 8);
    if (ratio > 0) {
      this.bar.fillStyle(color, 1);
      this.bar.fillRoundedRect(BAR_X, BAR_Y, Math.max(8, BAR_W * ratio), BAR_H, 8);
    }

    this.hpText.setText(`Batas Kalori: ${Math.ceil(hp)} / ${gameConfig.maxHp}`);
    this.timeText.setText(`${elapsedSeconds.toFixed(1)} dtk`);
  }
}
