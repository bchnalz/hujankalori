import Phaser from "phaser";
import { addBackdrop } from "../ui/Backdrop";
import { FONT_UI } from "../config/theme";
import { fadeInScene, goTo } from "../ui/transition";
import { GAME_HEIGHT, GAME_WIDTH, gameConfig } from "../config/gameConfig";
import { ITEMS_BY_TYPE, type ItemDef } from "../config/itemConfig";
import { PLAYER_BASES } from "../config/playerConfig";
import type { GameUser } from "../data/types";
import { markTutorialDone } from "../data/prefs";
import { Sfx } from "../audio/Sfx";
import { Player } from "../objects/Player";
import { FallingItem } from "../systems/FallingItem";
import { Hud } from "../ui/Hud";
import { StarveGauge } from "../ui/StarveGauge";
import { WeatherFx } from "../ui/WeatherFx";
import { makeButton } from "../ui/Button";
import { Fx } from "../ui/Fx";
import { addMuteToggle } from "../ui/MuteToggle";

type Step = "move" | "activity" | "hunger" | "food" | "done";
type Mood = "happy" | "sad" | "wow";

const STEPS: Step[] = ["move", "activity", "hunger", "food", "done"];
const PANEL_Y = 290;
const PANEL_H = 170;
const HUNGER_TOTAL = 12;

interface TutorialData {
  /** true when started from MAIN on first launch (skip/finish → Game). */
  firstTime?: boolean;
}

/**
 * Interactive practice round. A coach walks the player through moving,
 * catching an activity, eating to reset the hunger timer and dodging heavy
 * food. Nothing here can end the game. "Sudah paham? Lewati" skips at any time.
 */
export class TutorialScene extends Phaser.Scene {
  private firstTime = true;
  private step: Step = "move";
  private player!: Player;
  private items!: Phaser.Physics.Arcade.Group;
  private hud!: Hud;
  private fx!: Fx;
  private starve!: StarveGauge;
  private starveObjs: Phaser.GameObjects.GameObject[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  private hp = 1300;
  private hunger = HUNGER_TOTAL;

  private coachText!: Phaser.GameObjects.Text;
  private coachFace!: Phaser.GameObjects.Graphics;
  private dots!: Phaser.GameObjects.Graphics;
  private hint?: Phaser.GameObjects.Container;
  private highlight?: Phaser.GameObjects.Graphics;
  private skipBtn!: Phaser.GameObjects.Container;
  private marker?: Phaser.GameObjects.Text;

  private dragging = false;
  private dragPointerStartX = 0;
  private dragPlayerStartX = 0;
  private moveStartX = 0;
  private movedLeft = false;
  private movedRight = false;
  private busy = false;

  private foodPending = 0;
  private foodDodged = 0;
  private foodRounds = 0;

  constructor() {
    super("Tutorial");
  }

  init(data: TutorialData): void {
    this.firstTime = data?.firstTime ?? true;
  }

  create(): void {
    fadeInScene(this);
    this.step = "move";
    this.hp = 1300;
    this.hunger = HUNGER_TOTAL;
    this.busy = false;
    this.dragging = false;
    this.starveObjs = [];
    Sfx.playMusic("menu");

    const user = this.registry.get("user") as GameUser;

    addBackdrop(this, { horizon: gameConfig.footer.top, groundDepth: 1, dim: 0.25 });
    new WeatherFx(this, {
      rainDepth: -1,
      flashDepth: 145,
      flashMaxAlpha: 0.25,
      lightningMinMs: 9000,
      lightningMaxMs: 15000,
      thunderVolume: 0.5,
      rainVolume: 0.03,
    });

    const footerTop = gameConfig.footer.top;
    this.add.rectangle(GAME_WIDTH / 2, footerTop + 6 + (GAME_HEIGHT - footerTop) / 2, GAME_WIDTH, GAME_HEIGHT - footerTop - 6, 0x050814, 0.35).setDepth(1.05);

    this.player = new Player(this, PLAYER_BASES[user.gender].key);
    this.items = this.physics.add.group();
    this.fx = new Fx(this);
    this.hud = new Hud(this);
    this.hud.update(this.hp, 0);
    this.hud.setTimerVisible(false);

    // Hunger gauge exists from the start but stays hidden until its step.
    const before = this.children.list.length;
    this.starve = new StarveGauge(this);
    this.starveObjs = this.children.list.slice(before);
    this.starve.update(this.hunger, HUNGER_TOTAL);
    this.setStarveVisible(false);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragPointerStartX = p.worldX;
      this.dragPlayerStartX = this.player.x;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.player.moveTo(this.dragPlayerStartX + (p.worldX - this.dragPointerStartX));
    });
    this.input.on("pointerup", () => (this.dragging = false));
    this.input.on("pointerupoutside", () => (this.dragging = false));

    this.physics.add.overlap(this.player, this.items, (_p, it) => this.onCatch(it as FallingItem), undefined, this);

    this.buildCoach();
    addMuteToggle(this, 60, 172);

    this.skipBtn = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, "Sudah paham? Lewati ›", () => this.finish(), {
      width: 420,
      height: 76,
      color: 0x37406b,
      fontSize: 28,
    }).setDepth(160);

    this.enterStep("move");
  }

  // ------------------------------------------------------------------ coach

  private buildCoach(): void {
    const panel = this.add.graphics().setDepth(150);
    panel.fillStyle(0x0b1020, 0.88).fillRoundedRect(36, PANEL_Y, GAME_WIDTH - 72, PANEL_H, 24);
    panel.lineStyle(3, 0x7cfc8a, 0.8).strokeRoundedRect(36, PANEL_Y, GAME_WIDTH - 72, PANEL_H, 24);

    this.coachFace = this.add.graphics().setDepth(151);
    this.coachText = this.add
      .text(150, PANEL_Y + PANEL_H / 2 + 6, "", {
        fontFamily: FONT_UI,
        fontSize: "27px",
        color: "#ffffff",
        lineSpacing: 6,
        wordWrap: { width: GAME_WIDTH - 220 },
      })
      .setOrigin(0, 0.5)
      .setDepth(151);
    this.dots = this.add.graphics().setDepth(151);
  }

  private say(text: string, mood: Mood = "happy"): void {
    this.coachText.setText(text);
    this.coachText.setAlpha(0);
    this.tweens.add({ targets: this.coachText, alpha: 1, duration: 200 });
    this.drawFace(98, PANEL_Y + PANEL_H / 2, 34, mood);
  }

  private drawDots(): void {
    const idx = STEPS.indexOf(this.step);
    const n = STEPS.length - 1;
    const gap = 26;
    const x0 = GAME_WIDTH / 2 - ((n - 1) * gap) / 2;
    this.dots.clear();
    for (let i = 0; i < n; i++) {
      const on = i <= idx;
      this.dots.fillStyle(on ? 0x7cfc8a : 0x37406b, 1).fillCircle(x0 + i * gap, PANEL_Y + 20, i === idx ? 8 : 6);
    }
  }

  private drawFace(x: number, y: number, r: number, mood: Mood): void {
    const g = this.coachFace;
    g.clear();
    g.fillStyle(0xffd54f, 1).fillCircle(x, y, r);
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

  /** Pulsing outline around a screen area to draw attention to it. */
  private highlightRect(x: number, y: number, w: number, h: number, radius = 14): void {
    this.highlight?.destroy();
    const g = (this.highlight = this.add.graphics().setDepth(149));
    g.lineStyle(6, 0xffd54f, 1).strokeRoundedRect(x, y, w, h, radius);
    this.tweens.add({ targets: g, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
  }

  private clearHighlight(): void {
    this.highlight?.destroy();
    this.highlight = undefined;
  }

  private setStarveVisible(v: boolean): void {
    for (const o of this.starveObjs) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(v);
  }

  // ------------------------------------------------------------------ steps

  private enterStep(step: Step): void {
    this.step = step;
    this.busy = false;
    this.drawDots();
    this.hint?.destroy();
    this.hint = undefined;
    this.clearHighlight();

    switch (step) {
      case "move":
        this.moveStartX = this.player.x;
        this.movedLeft = false;
        this.movedRight = false;
        this.say("Geser jarimu ke kiri dan kanan untuk menggerakkan jagoanmu.", "happy");
        this.showSwipeHint();
        break;
      case "activity":
        this.say("Tangkap OLAHRAGA (yang bergelembung). Batas kalorimu bertambah!", "wow");
        this.highlightRect(12, 12, GAME_WIDTH - 24, 74, 18);
        this.spawn(this.pick("activity"), 420);
        break;
      case "hunger":
        this.hunger = HUNGER_TOTAL;
        this.setStarveVisible(true);
        this.say("Ini timer LAPAR. Kalau habis, kamu pingsan! Makan yang sehat untuk mengisinya.", "wow");
        this.highlightRect(GAME_WIDTH - 172, 106, 152, 172, 76);
        this.spawn(this.pick("healthy"), 230);
        break;
      case "food":
        this.foodRounds = 0;
        this.say("Makanan berat kalorinya BESAR. Geser dan hindari ya!", "sad");
        this.startFoodRound();
        break;
      case "done":
        this.showDone();
        break;
    }
  }

  private completeStep(message: string): void {
    if (this.busy) return;
    this.busy = true;
    this.hint?.destroy();
    this.hint = undefined;
    this.clearHighlight();
    this.say(message, "happy");
    Sfx.go();
    this.burst(this.player.x, this.player.y - 60);
    const next = STEPS[STEPS.indexOf(this.step) + 1];
    this.time.delayedCall(1400, () => this.enterStep(next));
  }

  private showSwipeHint(): void {
    const y = gameConfig.player.y - 150;
    const finger = this.add.circle(0, 0, 26, 0xffffff, 0.85);
    const ring = this.add.circle(0, 0, 38).setStrokeStyle(4, 0xffffff, 0.6);
    const left = this.add.text(-150, 0, "◀", { fontSize: "44px", color: "#ffffff" }).setOrigin(0.5).setAlpha(0.8);
    const right = this.add.text(150, 0, "▶", { fontSize: "44px", color: "#ffffff" }).setOrigin(0.5).setAlpha(0.8);
    const fingerGroup = this.add.container(0, 0, [ring, finger]);
    this.hint = this.add.container(GAME_WIDTH / 2, y, [left, right, fingerGroup]).setDepth(140);
    this.tweens.add({ targets: fingerGroup, x: { from: -100, to: 100 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  private startFoodRound(): void {
    this.foodRounds++;
    this.foodPending = 3;
    this.foodDodged = 0;
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(300 + i * 1100, () => {
        if (this.step !== "food") return;
        // Aim at the player so they actually have to dodge.
        const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-50, 50), 90, GAME_WIDTH - 90);
        this.spawn(this.pick("food"), 300, x);
      });
    }
  }

  private onFoodResolved(caught: boolean): void {
    if (caught) {
      this.say("Aduh! Kalorinya berkurang banyak. Hindari yang berat ya!", "sad");
    } else {
      this.foodDodged++;
      Sfx.catchGood(this.foodDodged);
      this.floatText(this.player.x, this.player.y - 110, "Menghindar!", "#7CFC8A");
    }
    this.foodPending--;
    if (this.foodPending > 0) return;
    if (this.foodDodged >= 2 || this.foodRounds >= 3) {
      this.completeStep("Hebat! Kamu jago menghindar.");
    } else {
      this.time.delayedCall(900, () => {
        if (this.step !== "food") return;
        this.say("Coba lagi: geser menjauh saat makanan berat jatuh.", "wow");
        this.startFoodRound();
      });
    }
  }

  private showDone(): void {
    this.setStarveVisible(true);
    this.say("Siap! Tangkap olahraga, makan yang sehat, hindari yang berat. Bertahan selama mungkin!", "happy");
    this.skipBtn.destroy();
    const play = makeButton(this, GAME_WIDTH / 2, 640, "MAIN SEKARANG!", () => this.finish(true), { width: 460 }).setDepth(160);
    play.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: play, scale: 1, alpha: 1, duration: 320, ease: "Back.easeOut" });
    if (!this.firstTime) {
      makeButton(this, GAME_WIDTH / 2, 780, "MENU", () => goTo(this, "Menu"), {
        width: 300,
        color: 0x37406b,
      }).setDepth(160);
    }
  }

  private finish(play = false): void {
    markTutorialDone();
    goTo(this, this.firstTime || play ? "Game" : "Menu");
  }

  // ------------------------------------------------------------------ items

  private pick(type: "activity" | "healthy" | "food"): ItemDef {
    const pool = ITEMS_BY_TYPE[type].filter((i) => i.value > 0);
    return pool[Phaser.Math.Between(0, pool.length - 1)];
  }

  private spawn(def: ItemDef, speed: number, x?: number): void {
    let sx = x;
    if (sx === undefined) {
      // Somewhere away from the player so they have to move.
      const side = this.player.x > GAME_WIDTH / 2 ? -1 : 1;
      sx = Phaser.Math.Clamp(this.player.x + side * Phaser.Math.Between(200, 300), 100, GAME_WIDTH - 100);
    }
    const item = new FallingItem(this, sx, def);
    this.items.add(item, true);
    item.launch(speed);

    if (def.type !== "food") {
      this.marker?.destroy();
      this.marker = this.add
        .text(sx, 0, "▼", { fontSize: "40px", color: "#ffd54f" })
        .setOrigin(0.5)
        .setDepth(141);
      this.tweens.add({ targets: this.marker, scale: 1.3, duration: 300, yoyo: true, repeat: -1 });
      item.setData("marked", true);
    }
  }

  private onCatch(item: FallingItem): void {
    if (item.getData("collected")) return;
    const def = item.def;
    if (item.getData("marked")) this.clearMarker();

    if (def.type === "activity") {
      this.hp = Math.min(gameConfig.maxHp, this.hp + def.value);
      Sfx.catchGood(3);
      this.player.react("happy");
      this.fx.catchActivity(item.x, item.y);
      this.floatText(item.x, item.y, `+${def.value} kkal`, "#7CFC8A");
      item.collect();
      if (this.step === "activity") this.completeStep("Mantap! Lihat, batas kalorimu bertambah.");
    } else if (def.type === "healthy") {
      this.hp = Math.max(200, this.hp - def.value);
      this.hunger = HUNGER_TOTAL;
      Sfx.catchNeutral();
      this.player.react("chew", 750, 0.1);
      this.fx.catchHealthy(item.x, item.y);
      this.floatText(item.x, item.y, `-${def.value} kkal`, "#ffd54f");
      item.collect();
      if (this.step === "hunger") this.completeStep("Kenyang! Timer lapar penuh lagi, kalorinya pun kecil.");
    } else {
      this.hp = Math.max(200, this.hp - def.value);
      this.hunger = HUNGER_TOTAL;
      Sfx.catchBad();
      this.player.react("shock", 700, 0.2);
      this.player.art.flash(0xff4d4d);
      this.fx.catchJunk(item.x, item.y);
      this.cameras.main.shake(140, 0.006);
      this.floatText(item.x, item.y, `-${def.value} kkal`, "#ff6b6b");
      item.collect();
      if (this.step === "food") this.onFoodResolved(true);
    }
  }

  private onMissed(item: FallingItem): void {
    if (item.getData("marked")) this.clearMarker();
    if (this.step === "food" && item.def.type === "food") {
      this.onFoodResolved(false);
    } else if (this.step === "activity" && item.def.type === "activity" && !this.busy) {
      this.say("Ups, terlewat! Coba lagi, kejar yang bergelembung.", "wow");
      this.time.delayedCall(500, () => this.step === "activity" && this.spawn(this.pick("activity"), 420));
    } else if (this.step === "hunger" && item.def.type === "healthy" && !this.busy) {
      this.say("Terlewat! Tangkap makanan sehatnya ya.", "wow");
      this.time.delayedCall(500, () => this.step === "hunger" && this.spawn(this.pick("healthy"), 230));
    }
  }

  private clearMarker(): void {
    this.marker?.destroy();
    this.marker = undefined;
  }

  // ------------------------------------------------------------------- fx

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: FONT_UI, fontSize: "34px", color, fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(90);
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, duration: 800, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number): void {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14;
      const c = this.add.circle(x, y, 7, i % 2 ? 0x7cfc8a : 0xffd54f).setDepth(95);
      this.tweens.add({
        targets: c,
        x: x + Math.cos(a) * 120,
        y: y + Math.sin(a) * 120,
        alpha: 0,
        scale: 0.3,
        duration: 600,
        ease: "Cubic.easeOut",
        onComplete: () => c.destroy(),
      });
    }
  }

  // ----------------------------------------------------------------- update

  update(_time: number, delta: number): void {
    if (this.cursors?.left?.isDown) this.player.nudge(-12);
    if (this.cursors?.right?.isDown) this.player.nudge(12);

    if (this.step === "move" && !this.busy) {
      if (this.player.x < this.moveStartX - 110) this.movedLeft = true;
      if (this.player.x > this.moveStartX + 110) this.movedRight = true;
      if (this.movedLeft && this.movedRight) this.completeStep("Bagus! Sekarang ayo tangkap sesuatu.");
    }

    // Hunger counts down only in the hunger step and never actually runs out.
    if (this.step === "hunger" && !this.busy) {
      this.hunger = Math.max(3, this.hunger - delta / 1000);
    }
    this.starve.update(this.hunger, HUNGER_TOTAL);
    this.hud.update(this.hp, 0);

    const cullY = gameConfig.footer.top;
    for (const child of [...this.items.getChildren()]) {
      const item = child as FallingItem;
      if (this.marker && item.getData("marked")) this.marker.setPosition(item.x, item.y - 90);
      if (item.y > cullY) {
        this.fx.splash(item.x, cullY + 10);
        this.onMissed(item);
        item.destroy();
      }
    }
  }
}
