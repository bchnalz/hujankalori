import Phaser from "phaser";
import { GAME_WIDTH, gameConfig } from "../config/gameConfig";

const CX = GAME_WIDTH - 96;
const CY = 156;
const R = 60;

/**
 * Pie/radial countdown for the starvation timer (GAME mechanic: eat within N
 * seconds or starve). Depletes clockwise; turns red and pulses when low.
 */
export class StarveGauge {
  private readonly scene: Phaser.Scene;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly num: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(100);
    this.num = scene.add
      .text(CX, CY, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "40px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(102);
    this.label = scene.add
      .text(CX, CY + R + 16, "LAPAR", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#cfd8e6",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(102);
  }

  update(remaining: number, total: number): void {
    const ratio = Phaser.Math.Clamp(remaining / total, 0, 1);
    const low = remaining <= gameConfig.starvation.warnSeconds;

    let color = 0x4caf50;
    if (low) color = 0xe53935;
    else if (ratio < 0.5) color = 0xffb300;

    this.g.clear();
    this.g.fillStyle(0x000000, 0.45);
    this.g.fillCircle(CX, CY, R + 7);
    this.g.fillStyle(0x10131c, 1);
    this.g.fillCircle(CX, CY, R);

    if (ratio > 0) {
      const start = -Math.PI / 2;
      const end = start + Math.PI * 2 * ratio;
      this.g.fillStyle(color, 1);
      this.g.beginPath();
      this.g.slice(CX, CY, R, start, end, false);
      this.g.closePath();
      this.g.fillPath();
    }

    this.g.fillStyle(0x10131c, 1);
    this.g.fillCircle(CX, CY, R * 0.55);

    this.num.setText(`${Math.ceil(remaining)}`).setColor(low ? "#ff6b6b" : "#ffffff");

    if (low) {
      this.num.setScale(1 + 0.12 * Math.sin(this.scene.time.now / 90));
      this.label.setText("MAKAN!").setColor("#ff6b6b");
    } else {
      this.num.setScale(1);
      this.label.setText("LAPAR").setColor("#cfd8e6");
    }
  }
}
