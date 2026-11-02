import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, gameConfig } from "../config/gameConfig";
import { Sfx } from "../audio/Sfx";
import { BAR_H, BAR_W, BAR_X, BAR_Y, type Hud } from "./Hud";
import { STARVE_CX, STARVE_CY, STARVE_R, type StarveGauge } from "./StarveGauge";
import { makeButton } from "./Button";

const PANEL_X = 40;
const PANEL_Y = 340;
const PANEL_W = GAME_WIDTH - 80;
const PANEL_H = 730;
// In-panel mini versions of the HUD widgets
const MINI_BAR_W = 520;
const MINI_BAR_H = 44;
const MINI_BAR_X = (GAME_WIDTH - MINI_BAR_W) / 2;
const MINI_BAR_Y = PANEL_Y + 92;
const MINI_DONUT_X = GAME_WIDTH / 2;
const MINI_DONUT_Y = PANEL_Y + 432;
const MINI_DONUT_R = 50;
const HUNGER_DEMO_TOTAL = 12;

/**
 * Pre-round briefing popup. The real HUD stays lit above a dimmed field while:
 *  1. the calorie bar fills to full (sweep + ding) — "this is your daily limit",
 *  2. the hunger donut pops in and drains in a quick demo, then refills —
 *     "but don't skip meals or you'll faint",
 *  3. a SIAP! button appears; tapping it closes the popup and calls onDone.
 * Every motion has a sound.
 */
export function runBriefing(scene: Phaser.Scene, hud: Hud, starve: StarveGauge, onDone: () => void): void {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objs.push(o);
    return o;
  };

  hud.update(0, 0);
  hud.setTimerVisible(false);
  starve.update(HUNGER_DEMO_TOTAL, HUNGER_DEMO_TOTAL);
  starve.setAlpha(0);

  // Dim the play field but not the HUD (HUD sits at depth 100+).
  const shade = keep(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050814, 0.7).setDepth(95));
  shade.setInteractive(); // swallow drags behind the popup
  shade.setAlpha(0);
  scene.tweens.add({ targets: shade, alpha: 1, duration: 250 });

  // Panel
  const panel = keep(scene.add.container(0, 40).setDepth(96).setAlpha(0));
  const bg = scene.add.graphics();
  bg.fillStyle(0x0b1020, 0.96).fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 28);
  bg.lineStyle(4, 0x2a3450, 1).strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 28);
  bg.lineStyle(2, 0x2a3450, 1).lineBetween(PANEL_X + 40, PANEL_Y + 300, PANEL_X + PANEL_W - 40, PANEL_Y + 300);
  panel.add(bg);

  const heading = (y: number, text: string, color: string): Phaser.GameObjects.Text =>
    scene.add
      .text(GAME_WIDTH / 2, y, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "36px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0);
  const body = (y: number, text: string): Phaser.GameObjects.Text =>
    scene.add
      .text(GAME_WIDTH / 2, y, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "29px",
        color: "#e8f0ff",
        align: "center",
        lineSpacing: 8,
        wordWrap: { width: PANEL_W - 90 },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);

  const hA = heading(PANEL_Y + 52, "BATAS KALORI HARIAN", "#7CFC8A");
  const tA = body(PANEL_Y + 158, "Ini adalah batas kalori harian Anda. Bila habis, perut Anda sudah kekenyangan!");
  const hB = heading(PANEL_Y + 344, "TIMER LAPAR", "#FFD54F");
  const tB = body(PANEL_Y + 502, "Tapi jangan sampai nggak makan ya, nanti kamu pingsan!");
  panel.add([hA, tA, hB, tB]);

  // Mini calorie bar
  const miniBar = scene.add.graphics().setAlpha(0);
  const miniBarText = scene.add
    .text(GAME_WIDTH / 2, MINI_BAR_Y + MINI_BAR_H / 2, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#0b1020",
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setAlpha(0);
  const drawMiniBar = (v: number): void => {
    const ratio = Phaser.Math.Clamp(v / gameConfig.maxHp, 0, 1);
    miniBar.clear();
    miniBar.fillStyle(0x10131c, 1).fillRoundedRect(MINI_BAR_X, MINI_BAR_Y, MINI_BAR_W, MINI_BAR_H, 12);
    if (ratio > 0) {
      miniBar.fillStyle(0x4caf50, 1).fillRoundedRect(MINI_BAR_X, MINI_BAR_Y, Math.max(20, MINI_BAR_W * ratio), MINI_BAR_H, 12);
      miniBar.fillStyle(0xffffff, 0.16).fillRoundedRect(MINI_BAR_X + 6, MINI_BAR_Y + 5, Math.max(10, MINI_BAR_W * ratio - 12), MINI_BAR_H * 0.28, 8);
    }
    miniBar.lineStyle(3, 0x2a3450, 1).strokeRoundedRect(MINI_BAR_X, MINI_BAR_Y, MINI_BAR_W, MINI_BAR_H, 12);
    miniBarText.setText(`${Math.round(v)} / ${gameConfig.maxHp} kkal`);
  };
  drawMiniBar(0);

  // Mini hunger donut
  const miniDonut = scene.add.graphics().setAlpha(0);
  const miniDonutNum = scene.add
    .text(MINI_DONUT_X, MINI_DONUT_Y, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setAlpha(0);
  const drawMiniDonut = (remaining: number): void => {
    const ratio = Phaser.Math.Clamp(remaining / HUNGER_DEMO_TOTAL, 0, 1);
    const low = remaining <= gameConfig.starvation.warnSeconds;
    const color = low ? 0xe53935 : ratio < 0.5 ? 0xffb300 : 0x4caf50;
    miniDonut.clear();
    miniDonut.fillStyle(0x10131c, 1).fillCircle(MINI_DONUT_X, MINI_DONUT_Y, MINI_DONUT_R);
    if (ratio > 0) {
      const start = -Math.PI / 2;
      miniDonut.fillStyle(color, 1);
      miniDonut.beginPath();
      miniDonut.slice(MINI_DONUT_X, MINI_DONUT_Y, MINI_DONUT_R, start, start + Math.PI * 2 * ratio, false);
      miniDonut.closePath();
      miniDonut.fillPath();
    }
    miniDonut.fillStyle(0x10131c, 1).fillCircle(MINI_DONUT_X, MINI_DONUT_Y, MINI_DONUT_R * 0.55);
    miniDonut.lineStyle(3, 0x2a3450, 1).strokeCircle(MINI_DONUT_X, MINI_DONUT_Y, MINI_DONUT_R + 3);
    miniDonutNum.setText(`${Math.ceil(remaining)}`).setColor(low ? "#ff6b6b" : "#ffffff");
  };
  drawMiniDonut(HUNGER_DEMO_TOTAL);
  panel.add([miniBar, miniBarText, miniDonut, miniDonutNum]);

  // Highlights + pointer arrows (above the HUD)
  const barFrame = keep(scene.add.graphics().setDepth(104).setAlpha(0));
  barFrame.lineStyle(6, 0xffd54f, 1).strokeRoundedRect(BAR_X - 10, BAR_Y - 10, BAR_W + 20, BAR_H + 20, 20);
  const barArrow = keep(
    scene.add.text(GAME_WIDTH / 2, BAR_Y + BAR_H + 34, "▲", { fontSize: "40px", color: "#ffd54f" }).setOrigin(0.5).setDepth(104).setAlpha(0),
  );
  const gaugeFrame = keep(scene.add.graphics().setDepth(104).setAlpha(0));
  gaugeFrame.lineStyle(6, 0xffd54f, 1).strokeCircle(STARVE_CX, STARVE_CY, STARVE_R + 18);
  const gaugeArrow = keep(
    scene.add
      .text(STARVE_CX, STARVE_CY + STARVE_R + 62, "▲", { fontSize: "40px", color: "#ffd54f" })
      .setOrigin(0.5)
      .setDepth(104)
      .setAlpha(0),
  );
  const flash = keep(scene.add.rectangle(BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2, BAR_W, BAR_H, 0xffffff, 1).setDepth(103).setAlpha(0));

  const show = (targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[], delay = 0): void => {
    scene.tweens.add({ targets, alpha: 1, duration: 260, delay });
  };
  const bob = (o: Phaser.GameObjects.Text): void => {
    scene.tweens.add({ targets: o, y: o.y + 10, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  };
  const pulse = (o: Phaser.GameObjects.Graphics): void => {
    scene.tweens.add({ targets: o, alpha: { from: 1, to: 0.3 }, duration: 450, yoyo: true, repeat: -1 });
  };

  // ---- 0: panel in
  Sfx.whoosh();
  scene.tweens.add({ targets: panel, y: 0, alpha: 1, duration: 380, ease: "Back.easeOut" });

  // ---- 1: calorie bar fills
  scene.time.delayedCall(420, () => {
    Sfx.pop();
    show([hA, tA, miniBar, miniBarText]);
    show(barArrow);
    bob(barArrow);
    barFrame.setAlpha(1);
    pulse(barFrame);

    const fill = { v: 0 };
    const FILL_MS = 1400;
    Sfx.fillSweep(FILL_MS / 1000);
    scene.tweens.add({
      targets: fill,
      v: gameConfig.maxHp,
      duration: FILL_MS,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        hud.update(fill.v, 0);
        drawMiniBar(fill.v);
      },
      onComplete: () => {
        hud.update(gameConfig.maxHp, 0);
        drawMiniBar(gameConfig.maxHp);
        scene.tweens.add({ targets: miniBarText, scale: 1.25, duration: 140, yoyo: true });
        Sfx.ding();
        flash.setAlpha(0.8);
        scene.tweens.add({ targets: flash, alpha: 0, duration: 450 });
        scene.time.delayedCall(900, step2);
      },
    });
  });

  // ---- 2: hunger donut pops in, drains, refills
  const step2 = (): void => {
    Sfx.pop();
    show([hB, tB, miniDonut, miniDonutNum]);
    miniDonutNum.setScale(0.4);
    scene.tweens.add({ targets: miniDonutNum, scale: 1, duration: 300, ease: "Back.easeOut" });
    starve.setAlpha(1);
    show(gaugeArrow);
    bob(gaugeArrow);
    gaugeFrame.setAlpha(1);
    pulse(gaugeFrame);

    const demo = { t: HUNGER_DEMO_TOTAL };
    let lastWhole = HUNGER_DEMO_TOTAL;
    scene.tweens.add({
      targets: demo,
      t: 1.5,
      duration: 2200,
      delay: 350,
      ease: "Sine.easeIn",
      onUpdate: () => {
        starve.update(demo.t, HUNGER_DEMO_TOTAL);
        drawMiniDonut(demo.t);
        const whole = Math.ceil(demo.t);
        if (whole !== lastWhole) {
          lastWhole = whole;
          if (whole <= gameConfig.starvation.warnSeconds) Sfx.warn();
          else Sfx.tick();
        }
      },
      onComplete: () => {
        // "Eat" → refill
        const refill = { t: demo.t };
        Sfx.catchNeutral();
        scene.tweens.add({
          targets: refill,
          t: HUNGER_DEMO_TOTAL,
          duration: 450,
          ease: "Back.easeOut",
          onUpdate: () => {
            starve.update(refill.t, HUNGER_DEMO_TOTAL);
            drawMiniDonut(refill.t);
          },
          onComplete: () => {
            Sfx.ding();
            scene.time.delayedCall(350, step3);
          },
        });
      },
    });
  };

  // ---- 3: ready button
  const step3 = (): void => {
    Sfx.pop();
    const btn = makeButton(scene, GAME_WIDTH / 2, PANEL_Y + PANEL_H - 82, "SIAP!", close, { width: 360, height: 100 });
    btn.setDepth(97).setScale(0.5).setAlpha(0);
    keep(btn);
    scene.tweens.add({ targets: btn, scale: 1, alpha: 1, duration: 320, ease: "Back.easeOut" });
    scene.tweens.add({ targets: btn, scale: 1.05, duration: 600, delay: 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  };

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    Sfx.whoosh(true);
    for (const o of objs) scene.tweens.killTweensOf(o);
    scene.tweens.add({
      targets: objs,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        for (const o of objs) o.destroy();
        starve.setAlpha(1);
        starve.update(HUNGER_DEMO_TOTAL, HUNGER_DEMO_TOTAL);
        hud.setTimerVisible(true);
        onDone();
      },
    });
  };
}
