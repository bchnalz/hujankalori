import Phaser from "phaser";
import { FONT_DISPLAY, FONT_UI } from "../config/theme";
import { GAME_WIDTH, gameConfig } from "../config/gameConfig";
import { Sfx } from "../audio/Sfx";

/** Glass panel across the top that holds the buttons, the gauge and the donut. */
export const PANEL_X = 16;
export const PANEL_Y = 16;
export const PANEL_W = GAME_WIDTH - 32;
export const PANEL_H = 124;

/** Calorie gauge bar (inside the panel). */
export const BAR_X = 96;
export const BAR_Y = 74;
export const BAR_W = 448;
export const BAR_H = 34;

/** Below this share of the limit the gauge is in the danger zone. */
const DANGER = 0.2;
const SEGMENTS = 8;
const SPARK_TEX = "__hud_spark";

const fmt = (n: number): string => Math.max(0, Math.round(n)).toLocaleString("id-ID");

function stateColor(ratio: number): { fill: number; shine: number; glow: number } {
  if (ratio < 0.25) return { fill: 0xff4526, shine: 0xff9a80, glow: 0xff4526 };
  if (ratio < 0.5) return { fill: 0xffc22e, shine: 0xffe08a, glow: 0xffc22e };
  return { fill: 0x43b047, shine: 0x9dffab, glow: 0x7cfc8a };
}

/**
 * In-game heads-up display: one dark glass panel at the top with the calorie
 * gauge (segments, a hatched danger zone, colour by state), and the survival
 * timer large and centred below it.
 *
 * The gauge animates both ways: a drop leaves a "melting" segment, shakes the
 * bar, chips red sparks off its end and pops "−N"; a gain grows the bar with a
 * shimmer sweep, sparkles and "+N". In the danger zone it pulses.
 */
export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly value: Phaser.GameObjects.Text;
  private readonly unit: Phaser.GameObjects.Text;
  private readonly timeNum: Phaser.GameObjects.Text;
  private readonly timeUnit: Phaser.GameObjects.Text;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Trailing "melting" value shown after a drop. */
  private ghost = -1;
  private ghostHoldUntil = 0;
  /** Bar length actually drawn (eases up on gains). */
  private drawn = -1;
  /** Rolling number shown in the label. */
  private shown = -1;
  private lastHp = -1;
  private lastTime = 0;
  private shimmer = -1;
  private shakeUntil = 0;
  private timerVisible = true;
  private lastSecond = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.panel = scene.add.graphics().setDepth(100);
    this.drawPanel();
    this.bar = scene.add.graphics().setDepth(101);

    this.label = scene.add
      .text(BAR_X + 2, BAR_Y - 22, "BATAS KALORI", {
        fontFamily: FONT_UI,
        fontSize: "19px",
        fontStyle: "bold",
        color: "#c9d4ec",
      })
      .setOrigin(0, 0.5)
      .setDepth(102);
    this.label.setLetterSpacing?.(2);
    this.unit = scene.add
      .text(BAR_X + BAR_W - 2, BAR_Y - 20, " / 2.000 kkal", {
        fontFamily: FONT_UI,
        fontSize: "17px",
        fontStyle: "bold",
        color: "#9fb0d0",
      })
      .setOrigin(1, 0.5)
      .setDepth(102);
    this.unit.setText(` / ${fmt(gameConfig.maxHp)} kkal`);
    this.value = scene.add
      .text(0, BAR_Y - 24, "", { fontFamily: FONT_DISPLAY, fontSize: "32px", color: "#ffffff" })
      .setOrigin(1, 0.5)
      .setDepth(102);

    const timerStyle = {
      fontFamily: FONT_DISPLAY,
      color: "#ffffff",
      stroke: "#0b1020",
      strokeThickness: 9,
    };
    this.timeNum = scene.add
      .text(GAME_WIDTH / 2, PANEL_Y + PANEL_H + 52, "", { ...timerStyle, fontSize: "66px" })
      .setOrigin(1, 0.5)
      .setDepth(102)
      .setShadow(0, 5, "rgba(0,0,0,0.35)", 0, true, true);
    this.timeUnit = scene.add
      .text(GAME_WIDTH / 2, PANEL_Y + PANEL_H + 62, " dtk", { ...timerStyle, fontSize: "34px", strokeThickness: 7 })
      .setOrigin(0, 0.5)
      .setDepth(102);

    if (!scene.textures.exists(SPARK_TEX)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1).fillCircle(5, 5, 5);
      g.generateTexture(SPARK_TEX, 10, 10);
      g.destroy();
    }
    this.sparks = scene.add
      .particles(0, 0, SPARK_TEX, {
        emitting: false,
        speed: { min: 60, max: 220 },
        angle: { min: 0, max: 360 },
        gravityY: 420,
        lifespan: { min: 300, max: 620 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(103);
  }

  private drawPanel(): void {
    const g = this.panel;
    g.fillStyle(0x000000, 0.3).fillRoundedRect(PANEL_X, PANEL_Y + 6, PANEL_W, PANEL_H, 30);
    g.fillStyle(0x0e1630, 0.8).fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 30);
    g.fillStyle(0xffffff, 0.05).fillRoundedRect(PANEL_X + 6, PANEL_Y + 4, PANEL_W - 12, PANEL_H * 0.42, 24);
    g.lineStyle(2, 0xa0beff, 0.2).strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 30);
  }

  setTimerVisible(v: boolean): void {
    this.timerVisible = v;
    this.timeNum.setVisible(v);
    this.timeUnit.setVisible(v);
  }

  /**
   * @param animate false for scripted fills (intro sweep, briefing, resets) so
   *                they don't trigger the gain/drop effects.
   */
  update(hp: number, elapsedSeconds: number, animate = true): void {
    const max = gameConfig.maxHp;
    const ratio = Phaser.Math.Clamp(hp / max, 0, 1);
    const now = this.scene.time.now;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (!animate || this.lastHp < 0) {
      this.ghost = hp;
      this.drawn = hp;
    } else if (hp < this.lastHp - 1) {
      this.onDrop(this.lastHp - hp, ratio);
    } else if (hp > this.lastHp + 1) {
      this.onGain(hp - this.lastHp, ratio);
    }
    if (this.ghost < 0 || hp >= this.ghost) this.ghost = hp;
    if (now > this.ghostHoldUntil && this.ghost > hp) {
      this.ghost = Math.max(hp, this.ghost - max * 0.8 * dt);
    }
    // drops cut the bar instantly (the ghost melts); gains grow it smoothly
    if (hp <= this.drawn) this.drawn = hp;
    else this.drawn = Math.min(hp, this.drawn + Math.max(max * 0.9 * dt, (hp - this.drawn) * dt * 6));
    this.lastHp = hp;

    this.shown = this.shown < 0 || !animate ? hp : Phaser.Math.Linear(this.shown, hp, Math.min(1, dt * 12 + 0.05));
    if (Math.abs(this.shown - hp) < 1) this.shown = hp;

    this.drawBar(ratio, now);

    const danger = ratio < DANGER && ratio > 0;
    if (danger) {
      const blink = Math.sin(now / 140) > -0.2;
      this.label.setText("⚠ HAMPIR KENYANG!").setColor(blink ? "#ff6b4f" : "#ffb199");
    } else {
      this.label.setText("BATAS KALORI").setColor("#c9d4ec");
    }
    this.value.setText(fmt(this.shown));
    this.value.setColor(danger ? "#ff8a70" : "#ffffff");
    this.value.x = this.unit.x - this.unit.width - 2;

    if (this.timerVisible) {
      this.timeNum.setText(elapsedSeconds.toFixed(1).replace(".", ","));
      const w = this.timeNum.width + this.timeUnit.width;
      this.timeNum.x = GAME_WIDTH / 2 - w / 2 + this.timeNum.width;
      this.timeUnit.x = this.timeNum.x;
      // small beat on every whole second
      const sec = Math.floor(elapsedSeconds);
      if (sec !== this.lastSecond) {
        if (this.lastSecond >= 0 && sec > 0 && animate) {
          this.scene.tweens.add({ targets: this.timeNum, scale: { from: 1.08, to: 1 }, duration: 180, ease: "Quad.easeOut" });
        }
        this.lastSecond = sec;
      }
    }
  }

  private drawBar(ratio: number, now: number): void {
    const max = gameConfig.maxHp;
    const g = this.bar;
    g.clear();
    const shake = now < this.shakeUntil ? Math.sin(now / 18) * 5 * ((this.shakeUntil - now) / 260) : 0;
    const x = BAR_X + shake;
    const y = BAR_Y;
    const R = BAR_H / 2;
    const c = stateColor(ratio);
    const drawnR = Phaser.Math.Clamp(this.drawn / max, 0, 1);
    const ghostR = Phaser.Math.Clamp(this.ghost / max, 0, 1);
    const danger = ratio < DANGER && ratio > 0;

    // track
    g.fillStyle(0x070b16, 1).fillRoundedRect(x, y, BAR_W, BAR_H, R);
    // danger zone: hatched stripes + dashed edge
    const zw = BAR_W * DANGER;
    g.lineStyle(4, 0xff4526, 0.32);
    for (let sx = x + 10; sx + BAR_H * 0.6 <= x + zw; sx += 12) g.lineBetween(sx, y + BAR_H - 4, sx + BAR_H * 0.6, y + 4);
    g.lineStyle(2, 0xff6e50, 0.85);
    for (let sy = y + 3; sy < y + BAR_H - 3; sy += 8) g.lineBetween(x + zw, sy, x + zw, Math.min(sy + 4, y + BAR_H - 3));

    // melting segment
    if (ghostR > drawnR + 0.002) {
      g.fillStyle(0xffe0b2, 0.92).fillRoundedRect(x, y, Math.max(BAR_H, BAR_W * ghostR), BAR_H, R);
    }
    if (drawnR > 0) {
      const w = Math.max(BAR_H, BAR_W * drawnR);
      const pulse = danger ? 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(now / 160)) : 0.22;
      // glow
      g.fillStyle(c.glow, pulse).fillRoundedRect(x - 4, y - 4, w + 8, BAR_H + 8, R + 4);
      g.fillStyle(c.fill, 1).fillRoundedRect(x, y, w, BAR_H, R);
      g.fillStyle(c.shine, 0.45).fillRoundedRect(x + 8, y + 5, Math.max(8, w - 16), BAR_H * 0.26, 6);
      // shimmer sweep after a gain
      if (this.shimmer >= 0) {
        const t = (now - this.shimmer) / 520;
        if (t >= 1) this.shimmer = -1;
        else {
          const sx = x + (w + 60) * t - 40;
          g.fillStyle(0xffffff, 0.45 * (1 - t));
          g.fillRect(Phaser.Math.Clamp(sx, x, x + w), y + 2, Math.max(0, Math.min(28, x + w - sx)), BAR_H - 4);
        }
      }
    }
    // segment ticks
    g.fillStyle(0x000000, 0.38);
    for (let i = 1; i < SEGMENTS; i++) g.fillRect(x + (BAR_W * i) / SEGMENTS - 1, y + 3, 2, BAR_H - 6);
    g.lineStyle(2, 0xffffff, 0.12).strokeRoundedRect(x, y, BAR_W, BAR_H, R);
  }

  private barEnd(ratio: number): number {
    return BAR_X + Math.max(BAR_H / 2, BAR_W * ratio);
  }

  private onDrop(amount: number, ratio: number): void {
    const now = this.scene.time.now;
    this.ghostHoldUntil = now + 380;
    this.shakeUntil = now + 260;
    this.scene.tweens.add({ targets: this.value, scale: { from: 1.25, to: 1 }, duration: 240, ease: "Quad.easeOut" });
    const ex = this.barEnd(ratio);
    this.sparks.setParticleTint(0xff6a45);
    this.sparks.emitParticleAt(ex, BAR_Y + BAR_H / 2, Math.min(16, 6 + Math.round(amount / 40)));
    this.popAmount(ex, `−${fmt(amount)}`, "#ff6a45");
    if (amount >= 150) Sfx.gaugeDown();
  }

  private onGain(amount: number, ratio: number): void {
    this.shimmer = this.scene.time.now;
    this.scene.tweens.add({ targets: this.value, scale: { from: 1.2, to: 1 }, duration: 220, ease: "Quad.easeOut" });
    const ex = this.barEnd(ratio);
    this.sparks.setParticleTint(0x9dffab);
    this.sparks.emitParticleAt(ex, BAR_Y + BAR_H / 2, 10);
    this.popAmount(ex, `+${fmt(amount)}`, "#7CFC8A");
    Sfx.gaugeUp();
  }

  /** Little "−450" / "+250" that pops under the bar end and fades. */
  private popAmount(x: number, text: string, color: string): void {
    const t = this.scene.add
      .text(Phaser.Math.Clamp(x, BAR_X + 40, BAR_X + BAR_W - 40), BAR_Y + BAR_H + 22, text, {
        fontFamily: FONT_DISPLAY,
        fontSize: "34px",
        color,
        stroke: "#0b1020",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(104)
      .setScale(0.6);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: "Back.easeOut" });
    this.scene.tweens.add({ targets: t, y: t.y + 26, alpha: 0, delay: 420, duration: 380, onComplete: () => t.destroy() });
  }
}
