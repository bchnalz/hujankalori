import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, gameConfig } from "../config/gameConfig";
import { BACKGROUND } from "../config/assetManifest";
import { PLAYER_BASES } from "../config/playerConfig";
import type { GameUser } from "../data/types";
import { Player } from "../objects/Player";
import { Spawner } from "../systems/Spawner";
import { starveWindow } from "../systems/Difficulty";
import { FallingItem } from "../systems/FallingItem";
import { Hud } from "../ui/Hud";
import { StarveGauge } from "../ui/StarveGauge";
import { WeatherFx } from "../ui/WeatherFx";
import { addMuteToggle } from "../ui/MuteToggle";
import { Sfx } from "../audio/Sfx";

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
  private startTime = 0;
  private ended = false;

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
  private nextWarnBeep = 0;

  constructor() {
    super("Game");
  }

  create(): void {
    this.hp = gameConfig.startHp;
    this.starveTotal = starveWindow(0);
    this.starveTimer = this.starveTotal;
    this.ended = false;
    this.intro = true;
    this.introElapsed = 0;
    this.startTime = this.time.now;
    this.combo = 0;
    this.nextWarnBeep = 0;

    const user = this.registry.get("user") as GameUser;
    const baseKey = PLAYER_BASES[user.gender].key;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-2);

    this.weather = new WeatherFx(this, {
      rainDepth: -1,
      flashDepth: 145,
      flashMaxAlpha: 0.32,
      lightningMinMs: 5000,
      lightningMaxMs: 11000,
      quantity: 2,
      frequency: 52,
      thunderVolume: 0.35,
    });

    const footerTop = gameConfig.footer.top;
    const footer = this.add.graphics().setDepth(1);
    footer.fillStyle(0x0b1020, 0.82);
    footer.fillRect(0, footerTop, GAME_WIDTH, GAME_HEIGHT - footerTop);
    footer.fillStyle(0x2a3450, 1);
    footer.fillRect(0, footerTop, GAME_WIDTH, 5);

    this.player = new Player(this, baseKey);
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
        fontFamily: "system-ui, sans-serif",
        fontSize: "180px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(200);

    this.hud.update(0, 0);
    this.starve.update(this.starveTimer, this.starveTotal);

    addMuteToggle(this, 60, 150);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => Sfx.stopMusic(0.2));
  }

  private handleCatch(item: FallingItem): void {
    if (this.ended || item.getData("collected")) return;

    const def = item.def;
    const delta = def.type === "activity" ? def.value : -def.value;

    this.applyHp(delta);
    if (def.type === "food") {
      this.combo = 0;
      Sfx.catchBad();
      this.cameras.main.shake(140, 0.006);
    } else if (def.type === "activity") {
      Sfx.catchGood(this.combo);
      this.combo++;
    } else {
      Sfx.catchNeutral();
    }
    if (def.type !== "activity") {
      const elapsed = (this.time.now - this.startTime) / 1000;
      this.starveTotal = starveWindow(elapsed);
      this.starveTimer = this.starveTotal;
      this.hungerWarned = false;
    }
    this.showFloatingText(item.x, item.y, delta);
    this.showCatchPopup(def.key, def.label, delta);
    item.collect();
  }

  private showCatchPopup(textureKey: string, label: string, delta: number): void {
    const cx = GAME_WIDTH / 2;
    const cy = gameConfig.footer.popupY;

    let color = "#ff6b6b";
    let sign = "";
    if (delta > 0) {
      color = "#7CFC8A";
      sign = "+";
    } else if (delta === 0) {
      color = "#cfd8e6";
    }

    const icon = this.add.image(cx - 96, cy, textureKey).setDisplaySize(56, 56).setDepth(120);
    const name = this.add
      .text(cx - 58, cy - 16, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(120);
    const eff = this.add
      .text(cx - 58, cy + 14, delta === 0 ? "netral" : `${sign}${Math.round(delta)} kkal`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(120);

    const group = [icon, name, eff];
    group.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: group, alpha: 1, y: "-=10", duration: 140, ease: "Quad.easeOut" });
    this.tweens.add({
      targets: group,
      alpha: 0,
      delay: 650,
      duration: 250,
      onComplete: () => group.forEach((o) => o.destroy()),
    });
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

    const txt = this.add
      .text(x, y, `${sign}${Math.round(delta)} kkal`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "34px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(90);

    this.tweens.add({
      targets: txt,
      y: y - 90,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  update(time: number, delta: number): void {
    if (this.ended) return;

    if (this.intro) {
      this.updateIntro(delta);
      return;
    }

    const elapsed = (time - this.startTime) / 1000;

    if (this.cursors.left?.isDown) this.player.nudge(-12);
    if (this.cursors.right?.isDown) this.player.nudge(12);

    this.spawner.update(delta, elapsed);

    if (gameConfig.passiveHpDrainPerSec > 0) {
      this.applyHp(-(gameConfig.passiveHpDrainPerSec * delta) / 1000);
    }

    const cullY = gameConfig.footer.top;
    for (const child of [...this.items.getChildren()]) {
      const item = child as FallingItem;
      if (item.y > cullY) item.destroy();
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

    if (this.hp <= 0) {
      this.endGame(elapsed, "hp");
    } else if (gameConfig.starvation.enabled && this.starveTimer <= 0) {
      this.endGame(elapsed, "starve");
    }
  }

  private updateIntro(delta: number): void {
    this.introElapsed += delta;
    const cfg = gameConfig.intro;

    const fillT = Phaser.Math.Clamp(this.introElapsed / cfg.countMs, 0, 1);
    const eased = Phaser.Math.Easing.Cubic.Out(fillT);
    this.hud.update(eased * gameConfig.maxHp, 0);

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

    if (this.introElapsed >= cfg.countMs + cfg.goMs) this.startPlay(this.time.now);
  }

  private startPlay(time: number): void {
    this.intro = false;
    this.dragging = false;
    this.hungerWarned = false;
    this.startTime = time;
    this.hp = gameConfig.startHp;
    this.starveTotal = starveWindow(0);
    this.starveTimer = this.starveTotal;
    this.hud.update(this.hp, 0);
    this.warnBorder.setVisible(false);
    this.countdownText.destroy();
    Sfx.startMusic();
  }

  private endGame(elapsed: number, reason: "hp" | "starve"): void {
    this.ended = true;
    this.physics.pause();
    Sfx.stopMusic(0.3);
    this.time.delayedCall(350, () => {
      this.scene.start("GameOver", { survivalSeconds: elapsed, reason });
    });
  }
}
