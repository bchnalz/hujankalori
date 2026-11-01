import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { UI } from "../config/assetManifest";
import { Sfx } from "../audio/Sfx";
import { WeatherFx } from "../ui/WeatherFx";

/**
 * First screen on page load: a single big "MULAI" button. The tap is the user
 * gesture browsers require before audio can play, so it unlocks Web Audio and
 * opens with a lightning strike + thunder before the splash.
 */
export class StartScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super("Start");
  }

  preload(): void {
    this.load.image(UI.logo.key, UI.logo.asset);
  }

  create(): void {
    this.started = false;
    this.cameras.main.setBackgroundColor("#05070f");

    const weather = new WeatherFx(this, {
      rainDepth: 0,
      flashDepth: 20,
      flashMaxAlpha: 0.35,
      lightningMinMs: 2500,
      lightningMaxMs: 5000,
      quantity: 2,
      frequency: 40,
      thunderVolume: 0.35,
    });

    const logo = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT * 0.34, UI.logo.key).setOrigin(0.5).setDepth(10);
    logo.setScale(Math.min((GAME_WIDTH * 0.8) / logo.width, 320 / logo.height));
    this.tweens.add({ targets: logo, y: logo.y - 12, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // Big round start button
    const R = 120;
    const btnY = GAME_HEIGHT * 0.64;
    const ring = this.add.graphics().setDepth(10);
    const btn = this.add.graphics().setDepth(11);
    btn.fillStyle(0x2e7d32, 1).fillCircle(0, 6, R);
    btn.fillStyle(0x4caf50, 1).fillCircle(0, 0, R);
    btn.lineStyle(6, 0xffffff, 0.9).strokeCircle(0, 0, R);
    // play triangle
    btn.fillStyle(0xffffff, 1).fillTriangle(-30, -48, -30, 48, 52, 0);
    btn.setPosition(GAME_WIDTH / 2, btnY);

    const label = this.add
      .text(GAME_WIDTH / 2, btnY + R + 60, "MULAI", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "58px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(11);

    const hint = this.add
      .text(GAME_WIDTH / 2, btnY + R + 130, "Ketuk untuk mulai • nyalakan suara 🔊", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5)
      .setDepth(11);

    const pulse = { r: R, a: 0.6 };
    this.tweens.add({
      targets: pulse,
      r: R + 60,
      a: 0,
      duration: 1300,
      repeat: -1,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(8, 0x7cfc8a, pulse.a).strokeCircle(GAME_WIDTH / 2, btnY, pulse.r);
      },
    });
    this.tweens.add({ targets: btn, scale: 1.05, duration: 650, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    const go = (): void => {
      if (this.started) return;
      this.started = true;
      Sfx.unlock();
      Sfx.startRain(0.07);
      Sfx.click();
      this.tweens.killTweensOf(btn);
      this.tweens.add({ targets: [btn, label, hint, ring], alpha: 0, scale: 0.85, duration: 220 });
      weather.bigStrike({ x: GAME_WIDTH / 2, targetY: btnY, depth: 30 });
      this.time.delayedCall(700, () => this.cameras.main.fadeOut(400, 0, 0, 0));
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("Splash"));
    };

    // Whole screen is the hit area — easiest on phones.
    this.input.once("pointerup", go);
    this.input.keyboard?.once("keydown-ENTER", go);
    this.input.keyboard?.once("keydown-SPACE", go);
  }
}
