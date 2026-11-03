import Phaser from "phaser";
import { addBackdrop } from "../ui/Backdrop";
import { FONT_DISPLAY, FONT_UI } from "../config/theme";
import { fadeInScene, goTo } from "../ui/transition";
import { GAME_HEIGHT, GAME_WIDTH, gameConfig } from "../config/gameConfig";
import { ensureCharacter } from "../objects/CharacterSprite";
import type { GameUser } from "../data/types";
import { Player } from "../objects/Player";
import { Spawner } from "../systems/Spawner";
import { starveWindow } from "../systems/Difficulty";
import { FallingItem } from "../systems/FallingItem";
import { Hud, PANEL_H, PANEL_X, PANEL_Y } from "../ui/Hud";
import { StarveGauge } from "../ui/StarveGauge";
import { WeatherFx } from "../ui/WeatherFx";
import { addMuteToggle, roundButtonBg } from "../ui/MuteToggle";
import type { ItemType } from "../config/itemConfig";
import { Sfx } from "../audio/Sfx";
import { makeButton } from "../ui/Button";
import { endRun, startRun } from "../data/leaderboard";
import { getBackdropChoice, getUniform } from "../data/prefs";
import { runBriefing } from "../ui/Briefing";
import { Fx } from "../ui/Fx";

/** HUD buttons sit inside the left end of the glass panel. */
const HUD_BTN_X = PANEL_X + 38;
const HUD_BTN_Y1 = PANEL_Y + 33;
const HUD_BTN_Y2 = PANEL_Y + PANEL_H - 33;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private items!: Phaser.Physics.Arcade.Group;
  private spawner!: Spawner;
  private hud!: Hud;
  private starve!: StarveGauge;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private hp: number = gameConfig.startHp;
  private starveTimer = 0;
  private starveTotal = 0;
  /** Survival time, accumulated from frame deltas — never wall-clock time. */
  private elapsed = 0;
  private ended = false;
  private paused = false;
  private pauseUi?: Phaser.GameObjects.Container;
  private runSid: Promise<string | null> = Promise.resolve(null);

  private intro = true;
  private introElapsed = 0;
  private countdownText!: Phaser.GameObjects.Text;

  private dragging = false;
  private dragPointerStartX = 0;
  private dragPlayerStartX = 0;
  private hungerWarned = false;
  private warnBorder!: Phaser.GameObjects.Graphics;
  private weather!: WeatherFx;
  private combo = 0;
  /** What was caught this run (for the admin statistics). */
  private caught: Record<string, number> = {};
  private kcalIn = 0;
  private kcalOut = 0;
  private nextWarnBeep = 0;
  /** Pre-round popup is open (nothing moves). */
  private briefing = false;
  private fx!: Fx;
  private showBriefing = true;
  private comboText?: Phaser.GameObjects.Text;
  private comboBadge!: Phaser.GameObjects.Text;
  private feed: Phaser.GameObjects.Container[] = [];
  private floats: Array<{ obj: Phaser.GameObjects.Text; at: number }> = [];

  constructor() {
    super("Game");
  }

  init(data: { retry?: boolean }): void {
    // Quick retries from Game Over skip the briefing popup.
    this.showBriefing = !data?.retry;
  }

  create(): void {
    fadeInScene(this);
    this.cameras.main.removeBounds().setZoom(1).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.hp = gameConfig.startHp;
    this.starveTotal = starveWindow(0);
    this.starveTimer = this.starveTotal;
    this.ended = false;
    this.intro = true;
    this.introElapsed = 0;
    this.elapsed = 0;
    this.paused = false;
    this.pauseUi = undefined;
    this.time.paused = false; // the clock persists across restarts (e.g. quit from pause)
    this.tweens.resumeAll();
    this.runSid = Promise.resolve(null);
    this.caught = {};
    this.kcalIn = 0;
    this.kcalOut = 0;
    this.combo = 0;
    this.nextWarnBeep = 0;
    this.feed = [];
    this.floats = [];
    this.briefing = false; // never carry an open popup into a new round
    this.comboText = undefined;

    const user = this.registry.get("user") as GameUser;
    const baseKey = ensureCharacter(this, user.gender, getUniform());

    addBackdrop(this, { horizon: gameConfig.footer.top, groundDepth: 1, dim: 0.25 });

    this.weather = new WeatherFx(this, {
      rainDepth: -1,
      flashDepth: 145,
      flashMaxAlpha: 0.32,
      lightningMinMs: 9000,
      lightningMaxMs: 15000,
      quantity: 2,
      frequency: 52,
      thunderVolume: 0.75,
      rainVolume: 0.02,
      boltChance: 0.8,
      boltDepth: -8.5,
      boltTargetY: [520, 960],
    });
    Sfx.stopMusic(0.5);

    const footerTop = gameConfig.footer.top;
    // soft shade on the street so the catch feed stays readable
    this.add.rectangle(GAME_WIDTH / 2, footerTop + 6 + (GAME_HEIGHT - footerTop) / 2, GAME_WIDTH, GAME_HEIGHT - footerTop - 6, 0x050814, 0.35).setDepth(1.05);

    this.player = new Player(this, baseKey);
    this.fx = new Fx(this);
    this.items = this.physics.add.group();
    this.spawner = new Spawner(this, this.items);
    this.hud = new Hud(this);
    this.starve = new StarveGauge(this);
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragPointerStartX = p.worldX;
      this.dragPlayerStartX = this.player.x;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.player.moveTo(this.dragPlayerStartX + (p.worldX - this.dragPointerStartX));
    });
    this.input.on("pointerup", () => {
      this.dragging = false;
    });
    this.input.on("pointerupoutside", () => {
      this.dragging = false;
    });

    this.physics.add.overlap(
      this.player,
      this.items,
      (_player, item) => this.handleCatch(item as FallingItem),
      undefined,
      this,
    );

    this.warnBorder = this.add.graphics().setDepth(150).setVisible(false);
    this.warnBorder.lineStyle(26, 0xe53935, 1);
    this.warnBorder.strokeRect(13, 13, GAME_WIDTH - 26, GAME_HEIGHT - 26);

    this.countdownText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.42, "", {
        fontFamily: FONT_DISPLAY,
        fontSize: "180px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(200);

    this.hud.update(0, 0, false);
    this.starve.update(this.starveTimer, this.starveTotal);

    this.comboBadge = this.add
      .text(GAME_WIDTH / 2, 262, "", {
        fontFamily: FONT_UI,
        fontSize: "28px",
        color: "#FFD54F",
        fontStyle: "bold",
        stroke: "#0b1020",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(102)
      .setVisible(false);

    if (this.showBriefing) {
      this.briefing = true;
      this.countdownText.setVisible(false);
      runBriefing(this, this.hud, this.starve, () => {
        this.briefing = false;
        this.countdownText.setVisible(true);
      });
    }

    addMuteToggle(this, HUD_BTN_X, HUD_BTN_Y1, { size: 50, round: true });
    this.addPauseButton(HUD_BTN_X, HUD_BTN_Y2);

    // Leaving the app/tab pauses the run so no time is gained while away.
    const onHidden = (): void => this.pauseGame();
    const onVis = (): void => {
      if (document.hidden) this.pauseGame();
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    document.addEventListener("visibilitychange", onVis);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Sfx.stopMusic(0.2);
      this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden);
      document.removeEventListener("visibilitychange", onVis);
    });
  }

  private handleCatch(item: FallingItem): void {
    if (this.ended || item.getData("collected")) return;

    const def = item.def;
    const delta = def.type === "activity" ? def.value : -def.value;
    this.caught[def.key] = (this.caught[def.key] ?? 0) + 1;
    if (def.type === "activity") this.kcalOut += def.value;
    else this.kcalIn += def.value;

    this.applyHp(delta);
    if (def.type === "food") {
      Sfx.catchBad();
      this.cameras.main.shake(140, 0.006);
      this.player.react("shock", 700, 0.2);
      this.fx.catchJunk(item.x, item.y);
      this.player.art.flash(0xff4d4d);
      this.breakCombo();
    } else {
      // Activities and healthy food both build the combo.
      if (def.type === "activity") {
        Sfx.catchGood(this.combo);
        this.player.react("happy", 650, 0.12);
        this.fx.catchActivity(item.x, item.y);
      } else {
        Sfx.catchNeutral();
        this.player.react("chew", 750, 0.1);
        this.fx.catchHealthy(item.x, item.y);
      }
      this.combo++;
      if (this.combo >= 2) this.showCombo(this.combo);
    }
    if (def.type !== "activity") {
      this.starveTotal = starveWindow(this.elapsed);
      this.starveTimer = this.starveTotal;
      this.hungerWarned = false;
    }
    this.showFloatingText(item.x, item.y, delta);
    this.showCatchPopup(def.key, def.label, delta, def.type);
    item.collect();
  }

  /**
   * Footer "what did I just eat/do" feed: a rounded card with a big glowing
   * icon badge, the item name and type, and the calorie change, all coloured
   * by item type. The newest row is on top; the previous one slides down,
   * shrinks and dims; older rows leave — so quick catches never overlap.
   */
  private showCatchPopup(textureKey: string, label: string, delta: number, type: ItemType): void {
    const ROW1 = gameConfig.footer.top + 96;
    const ROW_GAP = 112;
    const TYPE: Record<ItemType, { tag: string; col: number; css: string }> = {
      activity: { tag: "AKTIVITAS", col: 0x2bff74, css: "#2bff74" },
      healthy: { tag: "MAKANAN SEHAT", col: 0xffc22e, css: "#ffc22e" },
      food: { tag: "MAKANAN BERAT", col: 0xff5a3a, css: "#ff5a3a" },
    };
    const t = TYPE[type];
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";

    const ICON_R = 60;
    const CARD_H = 96;
    const name = this.add
      .text(0, -14, label, { fontFamily: FONT_UI, fontSize: "32px", color: "#ffffff", fontStyle: "bold" })
      .setOrigin(0, 0.5);
    const tag = this.add
      .text(0, 22, t.tag, { fontFamily: FONT_UI, fontSize: "18px", color: t.css, fontStyle: "bold" })
      .setOrigin(0, 0.5);
    tag.setLetterSpacing?.(1);
    const kcal = this.add
      .text(0, 0, `${sign}${Math.abs(Math.round(delta))}`, {
        fontFamily: FONT_DISPLAY,
        fontSize: "50px",
        color: t.css,
        stroke: "#0b1020",
        strokeThickness: 6,
      })
      .setOrigin(0, 0.5);
    const unit = this.add
      .text(0, 8, "kkal", {
        fontFamily: FONT_UI,
        fontSize: "22px",
        color: t.css,
        fontStyle: "bold",
        stroke: "#0b1020",
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    const textW = Math.max(name.width, tag.width);
    const cardX = ICON_R - 4; // card starts under the badge
    const cardW = ICON_R + 18 + textW + 24 + kcal.width + 6 + unit.width + 34;
    const total = cardX + cardW;
    const left = -total / 2;
    name.x = left + cardX + ICON_R + 18;
    tag.x = name.x;
    kcal.x = name.x + textW + 24;
    unit.x = kcal.x + kcal.width + 6;

    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.35).fillRoundedRect(left + cardX, -CARD_H / 2 + 8, cardW, CARD_H, CARD_H / 2);
    card.lineStyle(12, t.col, 0.16).strokeRoundedRect(left + cardX, -CARD_H / 2, cardW, CARD_H, CARD_H / 2);
    card.fillStyle(0x0e1630, 0.9).fillRoundedRect(left + cardX, -CARD_H / 2, cardW, CARD_H, CARD_H / 2);
    card.lineStyle(3, t.col, 1).strokeRoundedRect(left + cardX, -CARD_H / 2, cardW, CARD_H, CARD_H / 2);
    // icon badge
    const bx = left + ICON_R;
    card.lineStyle(12, t.col, 0.22).strokeCircle(bx, 0, ICON_R);
    card.fillStyle(0x16223f, 1).fillCircle(bx, 0, ICON_R);
    card.fillStyle(0xffffff, 0.06).fillCircle(bx, -12, ICON_R * 0.7);
    card.lineStyle(4, t.col, 1).strokeCircle(bx, 0, ICON_R);
    const icon = this.add.image(bx, 0, textureKey).setDisplaySize(92, 92);

    const row = this.add.container(GAME_WIDTH / 2, ROW1, [card, icon, name, tag, kcal, unit]).setDepth(120);

    // push older rows down
    this.feed = this.feed.filter((r) => r.active);
    this.feed.forEach((r, k) => {
      this.tweens.killTweensOf(r);
      if (k >= 1) {
        this.tweens.add({ targets: r, alpha: 0, duration: 120, onComplete: () => r.destroy() });
      } else {
        this.tweens.add({ targets: r, y: ROW1 + ROW_GAP - 6, alpha: 0.5, scale: 0.7, duration: 170, ease: "Quad.easeOut" });
        this.tweens.add({ targets: r, alpha: 0, delay: 900, duration: 250, onComplete: () => r.destroy() });
      }
    });
    this.feed = [row, ...this.feed.slice(0, 1)];

    row.setAlpha(0).setScale(0.8);
    icon.setScale(icon.scaleX * 1.4);
    this.tweens.add({ targets: row, alpha: 1, scale: 1, duration: 200, ease: "Back.easeOut" });
    this.tweens.add({ targets: icon, scale: icon.scaleX / 1.4, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: row, alpha: 0, delay: 1500, duration: 300, onComplete: () => row.destroy() });
  }

  private showCombo(n: number): void {
    Sfx.combo(n);
    const size = Math.min(44 + n * 3, 76);
    this.comboText?.destroy();
    const t = (this.comboText = this.add
      .text(this.player.x, this.player.y - 130, `COMBO x${n}`, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${size}px`,
        color: n >= 5 ? "#FFD54F" : "#7CFC8A",
        fontStyle: "bold",
        stroke: "#0b1020",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(130));
    t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 24, GAME_WIDTH - t.width / 2 - 24);
    t.setScale(1.8);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: t, y: t.y - 70, alpha: 0, delay: 500, duration: 450, onComplete: () => t.destroy() });

    // expanding ring around the player
    const ring = this.add.circle(this.player.x, this.player.y, 40).setStrokeStyle(6, n >= 5 ? 0xffd54f : 0x7cfc8a, 1).setDepth(89);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 420, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });

    this.comboBadge.setText(`COMBO x${n}`).setVisible(true);
    this.comboBadge.setScale(1.3);
    this.tweens.add({ targets: this.comboBadge, scale: 1, duration: 200, ease: "Back.easeOut" });

    if (n % 5 === 0) {
      const words = ["NTAP!", "AURA FARMING!", "LET HIM COOK!", "KING!", "MASIH LANJUT?!", "G.O.A.T.!"];
      const big = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.4, words[Math.min(n / 5 - 1, words.length - 1)], {
          fontFamily: FONT_DISPLAY,
          fontSize: "84px",
          color: "#FFD54F",
          fontStyle: "bold",
          stroke: "#0b1020",
          strokeThickness: 10,
        })
        .setOrigin(0.5)
        .setDepth(135)
        .setAlpha(0);
      // Always fit inside the screen (the end pop grows 10%, so keep room for it).
      const fit = Math.min(1, (GAME_WIDTH - 80) / (big.width * 1.1));
      big.setScale(fit * 0.3);
      this.tweens.add({ targets: big, scale: fit, alpha: 1, duration: 300, ease: "Back.easeOut" });
      this.tweens.add({ targets: big, alpha: 0, scale: fit * 1.1, delay: 750, duration: 350, onComplete: () => big.destroy() });
      this.cameras.main.flash(160, 255, 230, 140);
    }
  }

  private breakCombo(): void {
    if (this.combo >= 3) {
      Sfx.comboBreak();
      const t = this.add
        .text(this.player.x, this.player.y - 130, "Combo putus!", {
          fontFamily: FONT_DISPLAY,
          fontSize: "40px",
          color: "#cfd8e6",
          fontStyle: "bold",
          stroke: "#0b1020",
          strokeThickness: 7,
        })
        .setOrigin(0.5)
        .setDepth(130);
      t.x = Phaser.Math.Clamp(t.x, t.width / 2 + 24, GAME_WIDTH - t.width / 2 - 24);
      this.tweens.add({ targets: t, y: t.y + 40, alpha: 0, delay: 350, duration: 450, onComplete: () => t.destroy() });
    }
    this.combo = 0;
    this.comboBadge.setVisible(false);
  }

  private applyHp(delta: number): void {
    this.hp += delta;
    if (!gameConfig.allowOverheal) this.hp = Math.min(this.hp, gameConfig.maxHp);
    if (this.hp < 0) this.hp = 0;
  }

  private showFloatingText(x: number, y: number, delta: number): void {
    let color = "#ff6b6b";
    let sign = "";
    if (delta > 0) {
      color = "#7CFC8A";
      sign = "+";
    } else if (delta === 0) {
      color = "#cfd8e6";
    }

    // Stack above recent nearby floats so two quick catches don't overlap.
    const now = this.time.now;
    this.floats = this.floats.filter((f) => f.obj.active && now - f.at < 600);
    const nearby = this.floats.filter((f) => Math.abs(f.obj.x - x) < 200).length;
    const y0 = y - nearby * 52;

    const txt = this.add
      .text(x, y0, `${sign}${Math.round(delta)} kkal`, {
        fontFamily: FONT_UI,
        fontSize: "40px",
        color,
        fontStyle: "bold",
        stroke: "#0b1020",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(90);
    this.floats.push({ obj: txt, at: now });

    this.tweens.add({
      targets: txt,
      y: y0 - 90,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  update(time: number, rawDelta: number): void {
    if (this.ended || this.paused || this.briefing) return;

    // Clamp so a long frame (e.g. returning from background) can't add time.
    const delta = Math.min(rawDelta, 100);

    if (this.intro) {
      this.updateIntro(delta);
      return;
    }

    this.elapsed += delta / 1000;
    const elapsed = this.elapsed;

    if (this.cursors.left?.isDown) this.player.nudge(-12);
    if (this.cursors.right?.isDown) this.player.nudge(12);

    this.spawner.update(delta, elapsed);

    if (gameConfig.passiveHpDrainPerSec > 0) {
      this.applyHp(-(gameConfig.passiveHpDrainPerSec * delta) / 1000);
    }

    const cullY = gameConfig.footer.top;
    for (const child of [...this.items.getChildren()]) {
      const item = child as FallingItem;
      if (item.y > cullY) {
        if (!item.getData("collected")) this.fx.splash(item.x, cullY + 10);
        item.destroy();
      }
    }

    if (gameConfig.starvation.enabled) {
      this.starveTimer -= delta / 1000;
      this.starve.update(Math.max(this.starveTimer, 0), this.starveTotal);
    }

    const lowHunger =
      gameConfig.starvation.enabled &&
      this.starveTimer > 0 &&
      this.starveTimer <= gameConfig.starvation.warnSeconds;
    this.warnBorder.setVisible(lowHunger);
    this.player.art.setBaseExpression(lowHunger ? "panic" : "normal");
    if (lowHunger) {
      this.warnBorder.setAlpha(0.3 + 0.4 * Math.abs(Math.sin(time / 110)));
      if (time >= this.nextWarnBeep) {
        Sfx.warn();
        this.nextWarnBeep = time + 500;
      }
      if (!this.hungerWarned) {
        this.hungerWarned = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(140);
      }
    }

    this.hud.update(this.hp, elapsed);
    Sfx.setMusicTempo(1 + elapsed / 240);
    this.weather.setRate(1 + elapsed / 90);

    if (this.hp <= 0) {
      this.endGame(elapsed, "hp");
    } else if (gameConfig.starvation.enabled && this.starveTimer <= 0) {
      this.endGame(elapsed, "starve");
    }
  }

  private updateIntro(delta: number): void {
    this.introElapsed += delta;
    const cfg = gameConfig.intro;

    if (this.showBriefing) {
      this.hud.update(gameConfig.maxHp, 0, false); // already filled in the briefing
    } else {
      const fillT = Phaser.Math.Clamp(this.introElapsed / cfg.countMs, 0, 1);
      const eased = Phaser.Math.Easing.Cubic.Out(fillT);
      this.hud.update(eased * gameConfig.maxHp, 0, false);
    }

    const countdown = Math.max(1, Math.ceil((cfg.countMs - this.introElapsed) / 1000));
    const label = this.introElapsed < cfg.countMs ? `${countdown}` : "MULAI!";
    if (label !== this.countdownText.text) {
      this.countdownText.setText(label);
      this.countdownText.setColor(label === "MULAI!" ? "#7CFC8A" : "#ffffff");
      this.countdownText.setScale(1.8);
      if (label === "MULAI!") {
        Sfx.go();
        this.weather.bigStrike({ x: this.player.x, targetY: gameConfig.player.y - 40, depth: 190 });
      } else {
        Sfx.countdownTick();
      }
      this.tweens.add({ targets: this.countdownText, scale: 1, duration: 280, ease: "Back.easeOut" });
    }

    if (this.introElapsed >= cfg.countMs + cfg.goMs) this.startPlay();
  }

  private startPlay(): void {
    this.intro = false;
    this.dragging = false;
    this.hungerWarned = false;
    this.elapsed = 0;
    // Server-side run session: the board rejects scores longer than real time.
    this.runSid = startRun();
    this.hp = gameConfig.startHp;
    this.starveTotal = starveWindow(0);
    this.starveTimer = this.starveTotal;
    this.hud.update(this.hp, 0, false);
    this.warnBorder.setVisible(false);
    this.countdownText.destroy();
    Sfx.playMusic("game");
  }

  private addPauseButton(x: number, y: number): void {
    const S = 50;
    const bg = this.add.graphics();
    roundButtonBg(bg, S);
    bg.fillStyle(0xffffff, 1).fillRoundedRect(-10, -12, 7, 24, 2).fillRoundedRect(3, -12, 7, 24, 2);
    const btn = this.add.container(x, y, [bg]).setSize(S, S).setDepth(300);
    btn.setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setScale(1.08));
    btn.on("pointerout", () => btn.setScale(1));
    btn.on("pointerup", () => {
      Sfx.click();
      this.pauseGame();
    });
  }

  private pauseGame(): void {
    if (this.paused || this.ended) return;
    this.paused = true;
    this.dragging = false;
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    Sfx.stopMusic(0.1);

    const shade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.62);
    shade.setInteractive(); // swallow taps behind the overlay
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.36, "JEDA", {
        fontFamily: FONT_DISPLAY,
        fontSize: "96px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const note = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT * 0.36 + 86, "Waktu berhenti saat game dijeda.", {
        fontFamily: FONT_UI,
        fontSize: "26px",
        color: "#cfd8e6",
      })
      .setOrigin(0.5);
    const resume = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.55, "LANJUT", () => this.resumeGame(), {
      width: 340,
    });
    const quit = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT * 0.55 + 130, "MENU", () => goTo(this, "Menu"), {
      width: 340,
      color: 0x37406b,
    });
    this.pauseUi = this.add.container(0, 0, [shade, title, note, resume, quit]).setDepth(500);
  }

  private resumeGame(): void {
    if (!this.paused) return;
    this.pauseUi?.destroy();
    this.pauseUi = undefined;
    this.paused = false;
    this.time.paused = false;
    this.tweens.resumeAll();
    this.physics.resume();
    if (!this.intro) Sfx.playMusic("game");
  }

  private endGame(elapsed: number, reason: "hp" | "starve"): void {
    this.ended = true;
    this.physics.pause();
    // Record the run for the admin statistics; the score submit waits for it.
    const user = this.registry.get("user") as GameUser;
    const report = {
      sec: Math.round(elapsed * 10) / 10,
      why: reason,
      loc: (this.registry.get("__bd_variant") as string | undefined) ?? "hospital",
      ch: getBackdropChoice() === "auto" ? ("auto" as const) : ("pilih" as const),
      g: user?.gender ?? "male",
      u: getUniform(),
      kin: this.kcalIn,
      kout: this.kcalOut,
      items: { ...this.caught },
    };
    const ended = this.runSid.then(async (sid) => {
      if (sid) await endRun(sid, report);
      return sid;
    });
    Sfx.stopMusic(0.3);
    this.warnBorder.setVisible(false);
    // dramatic beat: flash, punch-in zoom on the player, defeated face
    this.player.art.setExpression(reason === "starve" ? "dizzy" : "full");
    this.player.art.squash(0.22);
    // HUD and feed step aside so the shot is just the character and the scene
    this.children.list.forEach((o) => {
      const d = (o as unknown as { depth: number }).depth;
      if (d >= 100 && d < 500) this.tweens.add({ targets: o, alpha: 0, duration: 220 });
    });
    const cam = this.cameras.main;
    // Keep the view inside the scene so zooming on a player at the screen edge
    // never shows empty space beside it.
    cam.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    cam.flash(180, 255, 255, 255);
    cam.shake(200, 0.004);
    cam.zoomTo(2, 650, "Cubic.easeOut");
    cam.pan(this.player.x, this.player.y - 60, 650, "Cubic.easeOut");
    this.time.delayedCall(1400, () => {
      goTo(this, "GameOver", { survivalSeconds: elapsed, reason, sid: ended });
    });
  }

}
