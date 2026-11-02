import Phaser from "phaser";
import { FONT_DISPLAY, FONT_UI } from "../config/theme";
import { gameConfig } from "../config/gameConfig";
import { PANEL_H, PANEL_W, PANEL_X, PANEL_Y } from "./Hud";

export const STARVE_R = 56;
export const STARVE_CX = PANEL_X + PANEL_W - STARVE_R - 14;
export const STARVE_CY = PANEL_Y + PANEL_H / 2 - 2;
const CX = STARVE_CX;
const CY = STARVE_CY;
const R = STARVE_R;
const RING = 13;

/**
 * Hunger countdown as a neon ring at the right end of the HUD panel: drains
 * clockwise, green → amber → red; when it's low it glows and pulses and the
 * tag switches from LAPAR to MAKAN!.
 */
export class StarveGauge {
  private readonly scene: Phaser.Scene;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly num: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.g = scene.add.graphics().setDepth(101);
    this.num = scene.add
      .text(CX, CY, "", {
        fontFamily: FONT_DISPLAY,
        fontSize: "50px",
        color: "#ffffff",
        stroke: "#0b1020",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(102);
    this.label = scene.add
      .text(CX, CY + R + 4, "LAPAR", {
        fontFamily: FONT_UI,
        fontSize: "15px",
        fontStyle: "bold",
        color: "#0b1020",
        backgroundColor: "#7cfc8a",
        padding: { x: 10, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(102);
  }

  setAlpha(a: number): void {
    this.g.setAlpha(a);
    this.num.setAlpha(a);
    this.label.setAlpha(a);
  }

  update(remaining: number, total: number): void {
    const ratio = Phaser.Math.Clamp(remaining / total, 0, 1);
    const low = remaining <= gameConfig.starvation.warnSeconds;
    const now = this.scene.time.now;

    let color = 0x7cfc8a;
    let css = "#7cfc8a";
    if (low) {
      color = 0xff4526;
      css = "#ff6a45";
    } else if (ratio < 0.5) {
      color = 0xffc22e;
      css = "#ffc22e";
    }

    const g = this.g;
    g.clear();
    g.fillStyle(0x070b16, 0.95).fillCircle(CX, CY, R);
    // track + progress ring
    g.lineStyle(RING, 0x1a2340, 1).strokeCircle(CX, CY, R - RING / 2);
    if (ratio > 0) {
      const start = -Math.PI / 2;
      g.lineStyle(RING, color, 1);
      g.beginPath();
      g.arc(CX, CY, R - RING / 2, start, start + Math.PI * 2 * ratio, false);
      g.strokePath();
    }
    // outer neon halo (pulses when low)
    const glow = low ? 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(now / 110)) : 0.35;
    g.lineStyle(3, color, glow).strokeCircle(CX, CY, R + 5);
    if (low) g.lineStyle(8, color, glow * 0.3).strokeCircle(CX, CY, R + 8);

    this.num.setText(`${Math.ceil(remaining)}`).setColor(low ? "#ff8a70" : "#ffffff");
    this.num.setScale(low ? 1 + 0.12 * Math.sin(now / 90) : 1);
    this.label.setText(low ? "MAKAN!" : "LAPAR").setBackgroundColor(css);
  }
}
