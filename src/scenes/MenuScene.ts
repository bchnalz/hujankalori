import Phaser from "phaser";
import { addBackdrop, resolveBackdrop } from "../ui/Backdrop";
import { BACKDROP_CHOICES, BACKDROP_LABEL, backdropForNow, FONT_UI, type BackdropChoice } from "../config/theme";
import { fadeInScene, goTo } from "../ui/transition";
import { GAME_WIDTH } from "../config/gameConfig";
import { UI } from "../config/assetManifest";
import { PLAYER_BASES } from "../config/playerConfig";
import type { GameUser, Gender } from "../data/types";
import { getBackdropChoice, isTutorialDone, saveBackdropChoice, saveGender } from "../data/prefs";
import { Sfx } from "../audio/Sfx";
import { makeButton } from "../ui/Button";
import { addFullscreenToggle } from "../ui/FullscreenToggle";
import { addMuteToggle } from "../ui/MuteToggle";
import { WeatherFx } from "../ui/WeatherFx";
import { startAmbientItems } from "../ui/ambientItems";

const CARD_W = 220;
const CARD_H = 250;
const CARD_Y = 640;

export class MenuScene extends Phaser.Scene {
  private cards: Partial<Record<Gender, { box: Phaser.GameObjects.Graphics; sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; x: number }>> = {};

  constructor() {
    super("Menu");
  }

  create(): void {
    fadeInScene(this, 400);
    this.cards = {};
    Sfx.playMusic("menu");

    const user = this.registry.get("user") as GameUser;

    resolveBackdrop(this);
    addBackdrop(this, { horizon: 1160, dim: 0.5 });

    new WeatherFx(this, {
      rainDepth: -1,
      flashDepth: 145,
      flashMaxAlpha: 0.4,
      lightningMinMs: 5000,
      lightningMaxMs: 10000,
      quantity: 2,
      frequency: 48,
      rainVolume: 0.05,
      thunderVolume: 0.7,
      boltChance: 0.45,
      boltDepth: -8.5,
      boltTargetY: [360, 560],
    });

    startAmbientItems(this, { depth: -0.5, alpha: 0.85, delay: 320 });

    const logo = this.add.image(GAME_WIDTH / 2, 270, UI.logo.key).setOrigin(0.5);
    logo.setScale(Math.min((GAME_WIDTH * 0.8) / logo.width, 280 / logo.height));

    this.add
      .text(GAME_WIDTH / 2, 470, "Pilih jagoanmu", {
        fontFamily: FONT_UI,
        fontSize: "32px",
        color: "#e8f0ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.makeCard("male", GAME_WIDTH / 2 - 135, "Laki-laki");
    this.makeCard("female", GAME_WIDTH / 2 + 135, "Perempuan");
    this.select(user.gender, false);

    this.add
      .text(GAME_WIDTH / 2, 806, "Tangkap olahraga, hindari kalori berlebih.", {
        fontFamily: FONT_UI,
        fontSize: "24px",
        color: "#c9d4ec",
        stroke: "#070b18",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, 940, "MAIN", () => {
      goTo(this, isTutorialDone() ? "Game" : "Tutorial", { firstTime: true });
    }, { width: 360 });
    makeButton(this, GAME_WIDTH / 2 - 150, 1080, "PERINGKAT", () => goTo(this, "Leaderboard"), {
      width: 280,
      height: 90,
      color: 0x37406b,
    });
    makeButton(this, GAME_WIDTH / 2 + 150, 1080, "CARA MAIN", () => goTo(this, "Tutorial", { firstTime: false }), {
      width: 280,
      height: 90,
      color: 0x37406b,
    });

    this.makeBackdropPicker(1212);

    addFullscreenToggle(this, GAME_WIDTH - 56, 56);
    addMuteToggle(this, 56, 56);
  }

  /** Row of chips to pick the scenery: Otomatis (by WIB clock) / IGD / GPT / Taman (versi 2015). */
  private makeBackdropPicker(y: number): void {
    const current = getBackdropChoice();
    const auto = BACKDROP_LABEL[backdropForNow() as BackdropChoice];
    this.add
      .text(GAME_WIDTH / 2, y - 50, current === "auto" ? `Latar: otomatis sesuai jam (${auto})` : "Latar", {
        fontFamily: FONT_UI,
        fontSize: "20px",
        color: "#c9d4ec",
        fontStyle: "bold",
        stroke: "#070b18",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const H = 50;
    const gap = 12;
    // chip width follows its label
    const widths = BACKDROP_CHOICES.map((c) => {
      const t = this.add.text(0, 0, BACKDROP_LABEL[c], { fontFamily: FONT_UI, fontSize: "22px", fontStyle: "bold" });
      const w = Math.ceil(t.width) + 40;
      t.destroy();
      return w;
    });
    let x = GAME_WIDTH / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)) / 2;
    BACKDROP_CHOICES.forEach((c, i) => {
      const W = widths[i];
      x += W / 2;
      const on = c === current;
      const g = this.add.graphics();
      g.fillStyle(on ? 0x1b3a2a : 0x0b1020, on ? 0.92 : 0.7);
      g.fillRoundedRect(x - W / 2, y - H / 2, W, H, 25);
      g.lineStyle(on ? 4 : 2, on ? 0x7cfc8a : 0x2a3450, 1);
      g.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 25);
      this.add
        .text(x, y, BACKDROP_LABEL[c], {
          fontFamily: FONT_UI,
          fontSize: "22px",
          color: on ? "#7CFC8A" : "#c9d4ec",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      const hit = this.add.zone(x, y, W, H + 16).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        if (c === getBackdropChoice()) return;
        Sfx.click();
        saveBackdropChoice(c);
        this.cameras.main.fadeOut(160, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
      });
      x += W / 2 + gap;
    });
  }

  private makeCard(gender: Gender, x: number, label: string): void {
    const box = this.add.graphics();
    const base = PLAYER_BASES[gender];
    const sprite = this.add.sprite(x, CARD_Y - 18, base.key, 0).setDisplaySize(170, 170);
    const idle = `${base.key}_idle`;
    if (this.anims.exists(idle)) sprite.play(idle);
    const text = this.add
      .text(x, CARD_Y + CARD_H / 2 - 32, label, {
        fontFamily: FONT_UI,
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const hit = this.add.zone(x, CARD_Y, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.select(gender, true));

    this.cards[gender] = { box, sprite, label: text, x };
  }

  private select(gender: Gender, byUser: boolean): void {
    const user = this.registry.get("user") as GameUser;
    if (byUser) {
      if (user.gender !== gender) Sfx.catchGood(2);
      else Sfx.click();
      saveGender(gender);
    }
    this.registry.set("user", { ...user, gender });

    for (const g of ["male", "female"] as Gender[]) {
      const c = this.cards[g];
      if (!c) continue;
      const on = g === gender;
      c.box.clear();
      c.box.fillStyle(on ? 0x1b3a2a : 0x0b1020, on ? 0.9 : 0.6);
      c.box.fillRoundedRect(c.x - CARD_W / 2, CARD_Y - CARD_H / 2, CARD_W, CARD_H, 22);
      c.box.lineStyle(on ? 6 : 3, on ? 0x7cfc8a : 0x2a3450, 1);
      c.box.strokeRoundedRect(c.x - CARD_W / 2, CARD_Y - CARD_H / 2, CARD_W, CARD_H, 22);
      c.sprite.setAlpha(on ? 1 : 0.45);
      c.label.setColor(on ? "#7CFC8A" : "#9fb0d0");
      if (on) {
        if (c.sprite.anims.currentAnim) c.sprite.anims.resume();
        if (byUser) {
          this.tweens.killTweensOf(c.sprite);
          c.sprite.setDisplaySize(170, 170);
          const sx = c.sprite.scaleX;
          const sy = c.sprite.scaleY;
          this.tweens.add({ targets: c.sprite, scaleX: sx * 1.15, scaleY: sy * 1.15, duration: 120, yoyo: true });
        }
      } else if (c.sprite.anims.currentAnim) {
        c.sprite.anims.pause();
      }
    }
  }
}
