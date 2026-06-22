import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND } from "../config/assetManifest";
import { ITEMS_BY_TYPE } from "../config/itemConfig";
import { PLAYER_BASES } from "../config/playerConfig";
import type { GameUser } from "../data/types";
import { makeButton } from "../ui/Button";
import { addFullscreenToggle } from "../ui/FullscreenToggle";

type Mood = "happy" | "sad" | "wow";

/**
 * Pre-game tutorial: explains the mechanics with item sprites + simple cartoon
 * faces and playful Indonesian captions. Shown from the Menu; quick retries from
 * Game Over skip it.
 */
export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super("HowToPlay");
  }

  create(): void {
    const user = this.registry.get("user") as GameUser;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.graphics().fillStyle(0x000000, 0.5).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add
      .text(GAME_WIDTH / 2, 110, "CARA MAIN", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const food = ITEMS_BY_TYPE.food[0];
    const healthy = ITEMS_BY_TYPE.healthy.find((i) => i.value > 0) ?? ITEMS_BY_TYPE.healthy[0];
    const water = ITEMS_BY_TYPE.healthy.find((i) => i.key === "healthy_air_mineral");
    const activity = ITEMS_BY_TYPE.activity[0];

    let y = 250;
    const step = 150;

    this.row(
      y,
      (cx, cy) => this.add.image(cx, cy, PLAYER_BASES[user.gender].key, 0).setDisplaySize(110, 110),
      "Geser jagoan ke kanan-kiri untuk menangkap apa aja yang jatuh dari atas. Tangkap yang sehat, hindari yang berat-berat!",
      "happy",
    );
    y += step;

    this.row(
      y,
      (cx, cy) => this.add.image(cx, cy, food.key).setDisplaySize(100, 100),
      "Makanan berat = sisa kalori drop. Jangan kalap ya! Sisa kalori = 0, jagoan kekenyangan = game over.",
      "sad",
    );
    y += step;

    this.row(
      y,
      (cx, cy) => {
        this.add.image(cx - 26, cy, healthy.key).setDisplaySize(82, 82);
        if (water) this.add.image(cx + 30, cy, water.key).setDisplaySize(82, 82);
      },
      "Makanan sehat = sisa kalori turun dikit, air mineral 0 kalori. Keduanya bikin kenyang (reset timer lapar).",
      "happy",
    );
    y += step;

    this.row(
      y,
      (cx, cy) => {
        this.add.circle(cx, cy, 62, 0x9fd8ff, 0.25).setStrokeStyle(4, 0xffffff, 0.55);
        this.add.image(cx, cy, activity.key).setDisplaySize(100, 100);
      },
      "Gelembung OLAHRAGA = sisa kalori bertambah! Tangkap biar bisa tahan lebih lama!",
      "wow",
    );
    y += step;

    this.row(
      y,
      (cx, cy) => this.drawMiniPie(cx, cy, 54),
      "Timer lapar: jangan sampai kelaparan. Diet sehat, gabole sampai pingsan!",
      "wow",
    );
    y += step;

    this.add
      .text(GAME_WIDTH / 2, y + 4, "Dua cara kalah: kekenyangan (sisa kalori habis)\natau kelaparan (lupa makan).", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#cfd8e6",
        align: "center",
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 100, "MULAI!", () => this.scene.start("Game"));

    addFullscreenToggle(this, GAME_WIDTH - 56, 56);
  }

  private row(y: number, drawIcon: (cx: number, cy: number) => void, caption: string, mood: Mood): void {
    const iconX = 128;
    drawIcon(iconX, y);
    this.drawFace(iconX + 80, y - 46, 20, mood);
    this.add
      .text(232, y, caption, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "23px",
        color: "#ffffff",
        lineSpacing: 5,
        wordWrap: { width: GAME_WIDTH - 268 },
      })
      .setOrigin(0, 0.5);
  }

  private drawFace(x: number, y: number, r: number, mood: Mood): void {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0xffd54f, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(0x222222, 1);
    g.fillCircle(x - r * 0.35, y - r * 0.18, r * 0.14);
    g.fillCircle(x + r * 0.35, y - r * 0.18, r * 0.14);
    g.lineStyle(Math.max(3, r * 0.16), 0x222222, 1);
    if (mood === "happy") {
      g.beginPath();
      g.arc(x, y + r * 0.05, r * 0.5, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
      g.strokePath();
    } else if (mood === "sad") {
      g.beginPath();
      g.arc(x, y + r * 0.7, r * 0.5, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
      g.strokePath();
    } else {
      g.strokeCircle(x, y + r * 0.22, r * 0.22);
    }
  }

  private drawMiniPie(cx: number, cy: number, r: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x10131c, 1);
    g.fillCircle(cx, cy, r);
    g.fillStyle(0x4caf50, 1);
    g.beginPath();
    g.slice(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.62, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x10131c, 1);
    g.fillCircle(cx, cy, r * 0.5);
  }
}
