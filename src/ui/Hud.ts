import Phaser from "phaser";
import { FONT_UI } from "../config/theme";
import { GAME_WIDTH, gameConfig } from "../config/gameConfig";

export const BAR_X = 20;
export const BAR_Y = 20;
export const BAR_W = GAME_WIDTH - 40;
export const BAR_H = 58;

/**
 * In-game heads-up display: HP bar (dynamic, drawn with Graphics) + numeric HP
 * and the running survival timer (the score per GAME-01).
 */
export class Hud {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  /** Trailing "melting" value shown after a drop. */
  private ghost = -1;
  private ghostHoldUntil = 0;
  /** Rolling number shown in the label. */
  private shown = -1;
  private lastHp = -1;
  private lastTime = 0;
  private gainFlash = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.bg = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.bar = scene.add.graphics().setScrollFactor(0).setDepth(101);

    this.hpText = scene.add
      .text(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, "", {
        fontFamily: FONT_UI,
        fontSize: "30px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#0b1020",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(102);

    this.timeText = scene.add
      .text(GAME_WIDTH / 2, BAR_Y + BAR_H + 30, "", {
        fontFamily: FONT_UI,
        fontSize: "30px",
        color: "#e8f0ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(102);
  }

  setTimerVisible(v: boolean): void {
    this.timeText.setVisible(v);
  }

  update(hp: number, elapsedSeconds: number): void {
    const ratio = Phaser.Math.Clamp(hp / gameConfig.maxHp, 0, 1);
    const now = this.scene.time.now;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    // Drops leave a light "melting" segment that drains after a short hold;
    // gains flash the bar.
    if (this.ghost < 0 || hp >= this.ghost) this.ghost = hp;
    if (this.lastHp >= 0 && hp < this.lastHp - 1) {
      this.ghostHoldUntil = now + 380;
      this.scene.tweens.add({ targets: this.hpText, scale: { from: 1.18, to: 1 }, duration: 220, ease: "Quad.easeOut" });
    } else if (this.lastHp >= 0 && hp > this.lastHp + 1) {
      this.gainFlash = 1;
    }
    if (now > this.ghostHoldUntil && this.ghost > hp) {
      this.ghost = Math.max(hp, this.ghost - gameConfig.maxHp * 0.8 * dt);
    }
    this.lastHp = hp;
    this.gainFlash = Math.max(0, this.gainFlash - dt * 3);
    this.shown = this.shown < 0 ? hp : Phaser.Math.Linear(this.shown, hp, Math.min(1, dt * 12 + 0.05));
    if (Math.abs(this.shown - hp) < 1) this.shown = hp;
    const ghostRatio = Phaser.Math.Clamp(this.ghost / gameConfig.maxHp, 0, 1);

    this.bg.clear();
    this.bg.fillStyle(0x000000, 0.45);
    this.bg.fillRoundedRect(BAR_X - 5, BAR_Y - 5, BAR_W + 10, BAR_H + 10, 16);

    let color = 0x4caf50;
    if (ratio < 0.25) color = 0xe53935;
    else if (ratio < 0.5) color = 0xffb300;

    this.bar.clear();
    this.bar.fillStyle(0x10131c, 1);
    this.bar.fillRoundedRect(BAR_X, BAR_Y, BAR_W, BAR_H, 12);
    if (ghostRatio > ratio) {
      this.bar.fillStyle(0xffe0b2, 0.9);
      this.bar.fillRoundedRect(BAR_X, BAR_Y, Math.max(24, BAR_W * ghostRatio), BAR_H, 12);
    }
    if (ratio > 0) {
      this.bar.fillStyle(color, 1);
      this.bar.fillRoundedRect(BAR_X, BAR_Y, Math.max(24, BAR_W * ratio), BAR_H, 12);
      // subtle top shine
      this.bar.fillStyle(0xffffff, 0.16);
      this.bar.fillRoundedRect(BAR_X + 6, BAR_Y + 6, Math.max(12, BAR_W * ratio - 12), BAR_H * 0.28, 8);
      if (this.gainFlash > 0) {
        this.bar.fillStyle(0xffffff, 0.45 * this.gainFlash);
        this.bar.fillRoundedRect(BAR_X, BAR_Y, Math.max(24, BAR_W * ratio), BAR_H, 12);
      }
    }

    this.hpText.setText(`Batas Kalori: ${Math.ceil(this.shown)} / ${gameConfig.maxHp}`);
    this.timeText.setText(`${elapsedSeconds.toFixed(1)} dtk`);
  }
}
