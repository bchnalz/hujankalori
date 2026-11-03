import Phaser from "phaser";

export type Expression = "normal" | "happy" | "chew" | "shock" | "panic" | "dizzy" | "full";

const FRAME = 128;
/** Face anchor points inside the 128px sprite frame (measured from the art). */
const EYE_L = { x: 56, y: 42 };
const EYE_R = { x: 72, y: 42 };
const MOUTH = { x: 64, y: 50 };
/** Head bob per idle frame (frame bbox tops: 15, 12, 15, 18). */
const BOB = [0, -3, 0, 3];
const INK = 0x2b1d14;

/**
 * The player's look: the idle sprite plus a procedurally drawn face that
 * follows the head bob and changes expression. Anchored at the feet, so
 * squash/stretch and leaning pivot on the ground like a real body.
 */
export class CharacterArt extends Phaser.GameObjects.Container {
  private readonly body2: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly face: Phaser.GameObjects.Graphics;
  private expr: Expression = "normal";
  private baseExpr: Expression = "normal";
  private revertTimer?: Phaser.Time.TimerEvent;
  private chewOpen = false;
  private chewTimer?: Phaser.Time.TimerEvent;
  private bob = 0;
  /** Surgical mask on: no mouth / cheeks. */
  private readonly masked: boolean;
  readonly baseScale: number;

  constructor(scene: Phaser.Scene, x: number, feetY: number, textureKey: string, displayHeight = 176) {
    super(scene, x, feetY);
    this.baseScale = displayHeight / FRAME;
    this.masked = textureKey.endsWith("_ok");

    this.sprite = scene.add.sprite(0, 0, textureKey, 0).setOrigin(0.5, 1);
    // sheets may be drawn at 2× for crisp edges; keep the 128-unit frame space
    const fw = this.sprite.frame.width || FRAME;
    this.sprite.setScale(FRAME / fw);
    this.face = scene.add.graphics();
    this.body2 = scene.add.container(0, 0, [this.sprite, this.face]).setScale(this.baseScale);
    this.add(this.body2);
    scene.add.existing(this);

    const idle = `${textureKey}_idle`;
    if (scene.anims.exists(idle)) this.sprite.play(idle);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, frame: Phaser.Animations.AnimationFrame) => {
      this.bob = BOB[Number(frame.textureFrame)] ?? 0;
      this.drawFace();
    });
    this.drawFace();
  }

  get expression(): Expression {
    return this.expr;
  }

  /** Expression to return to after timed ones (e.g. "panic" while starving). */
  setBaseExpression(e: Expression): void {
    if (this.baseExpr === e) return;
    this.baseExpr = e;
    if (!this.revertTimer) this.applyExpr(e);
  }

  /** Show an expression; with `holdMs` it reverts to the base afterwards. */
  setExpression(e: Expression, holdMs = 0): void {
    this.revertTimer?.remove();
    this.revertTimer = undefined;
    this.applyExpr(e);
    if (holdMs > 0) {
      this.revertTimer = this.scene.time.delayedCall(holdMs, () => {
        this.revertTimer = undefined;
        this.applyExpr(this.baseExpr);
      });
    }
  }

  /** Quick squash & stretch, pivoting on the feet. */
  squash(amount = 0.14): void {
    const s = this.baseScale;
    this.scene.tweens.killTweensOf(this.body2);
    this.body2.setScale(s * (1 + amount), s * (1 - amount));
    this.scene.tweens.add({ targets: this.body2, scaleX: s, scaleY: s, duration: 260, ease: "Back.easeOut" });
  }

  /** Lean into movement (radians, small). */
  lean(angle: number): void {
    this.body2.rotation = angle;
  }

  /** Brief solid-colour flash (e.g. red when eating junk). */
  flash(color: number, ms = 110): void {
    this.sprite.setTintFill(color);
    this.scene.time.delayedCall(ms, () => this.sprite.clearTint());
  }

  /** Stretch horizontally (bloated look on the "too full" game over). */
  setBloat(x: number): void {
    this.body2.setScale(this.baseScale * x, this.baseScale);
  }

  private applyExpr(e: Expression): void {
    this.expr = e;
    this.chewTimer?.remove();
    this.chewTimer = undefined;
    if (e === "chew") {
      this.chewOpen = true;
      this.chewTimer = this.scene.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => {
          this.chewOpen = !this.chewOpen;
          this.drawFace();
        },
      });
    }
    this.drawFace();
  }

  /** Eyes-only expressions above a surgical mask. */
  private drawMaskedEyes(P: (p: { x: number; y: number }, dx?: number, dy?: number) => [number, number]): void {
    const g = this.face;
    const dot = (p: { x: number; y: number }, r: number): void => {
      const [x, y] = P(p);
      g.fillStyle(INK, 1).fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.9).fillCircle(x + r * 0.35, y - r * 0.35, r * 0.32);
    };
    const arcEyes = (r: number): void => {
      for (const p of [EYE_L, EYE_R]) {
        const [x, y] = P(p);
        g.beginPath();
        g.arc(x, y + 1.5, r, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
        g.strokePath();
      }
    };
    switch (this.expr) {
      case "happy":
      case "chew":
        arcEyes(3);
        break;
      case "shock":
      case "panic": {
        dot(EYE_L, this.expr === "shock" ? 3.6 : 2.8);
        dot(EYE_R, this.expr === "shock" ? 3.6 : 2.8);
        g.lineStyle(1.4, INK, 1);
        const [bl, by] = P(EYE_L, 0, -6);
        const [br] = P(EYE_R, 0, -6);
        g.lineBetween(bl - 3, by - 1, bl + 3, by + 1);
        g.lineBetween(br - 3, by + 1, br + 3, by - 1);
        break;
      }
      case "dizzy":
        for (const p of [EYE_L, EYE_R]) {
          const [x, y] = P(p);
          g.lineBetween(x - 2.5, y - 2.5, x + 2.5, y + 2.5);
          g.lineBetween(x - 2.5, y + 2.5, x + 2.5, y - 2.5);
        }
        break;
      case "full":
        for (const p of [EYE_L, EYE_R]) {
          const [x, y] = P(p);
          g.lineBetween(x - 2.5, y, x + 2.5, y);
        }
        break;
      default:
        dot(EYE_L, 2.6);
        dot(EYE_R, 2.6);
    }
  }

  private drawFace(): void {
    const g = this.face;
    g.clear();
    // frame coords -> local (origin at frame bottom-centre), plus head bob
    const P = (p: { x: number; y: number }, dx = 0, dy = 0): [number, number] => [
      p.x - FRAME / 2 + dx,
      p.y - FRAME + this.bob + dy,
    ];
    const eye = (p: { x: number; y: number }, r = 2.6): void => {
      const [x, y] = P(p);
      g.fillStyle(INK, 1).fillCircle(x, y, r);
      g.fillStyle(0xffffff, 0.9).fillCircle(x + r * 0.35, y - r * 0.35, r * 0.32);
    };
    const cheeks = (a = 0.55): void => {
      g.fillStyle(0xff8a95, a);
      const [lx, ly] = P(EYE_L, -4, 6);
      const [rx, ry] = P(EYE_R, 4, 6);
      g.fillEllipse(lx, ly, 6, 3.5);
      g.fillEllipse(rx, ry, 6, 3.5);
    };
    const [mx, my] = P(MOUTH);
    g.lineStyle(1.6, INK, 1);
    if (this.masked) {
      this.drawMaskedEyes(P);
      return;
    }

    switch (this.expr) {
      case "normal": {
        eye(EYE_L);
        eye(EYE_R);
        g.beginPath();
        g.arc(mx, my - 2, 4, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155));
        g.strokePath();
        break;
      }
      case "happy": {
        for (const p of [EYE_L, EYE_R]) {
          const [x, y] = P(p);
          g.beginPath();
          g.arc(x, y + 1.5, 3, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
          g.strokePath();
        }
        cheeks();
        g.fillStyle(INK, 1);
        g.slice(mx, my - 1.5, 5, 0, Math.PI, false);
        g.fillPath();
        g.fillStyle(0xff6f7d, 1).fillEllipse(mx, my + 1.6, 4.4, 2.2);
        break;
      }
      case "chew": {
        for (const p of [EYE_L, EYE_R]) {
          const [x, y] = P(p);
          g.beginPath();
          g.arc(x, y + 1.5, 2.6, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
          g.strokePath();
        }
        cheeks(0.7);
        if (this.chewOpen) g.fillStyle(INK, 1).fillEllipse(mx, my, 5, 4);
        else g.lineBetween(mx - 3, my, mx + 3, my);
        break;
      }
      case "shock": {
        eye(EYE_L, 3.6);
        eye(EYE_R, 3.6);
        g.lineStyle(1.4, INK, 1);
        const [bl, by] = P(EYE_L, 0, -6);
        const [br] = P(EYE_R, 0, -6);
        g.lineBetween(bl - 3, by - 1, bl + 3, by + 1);
        g.lineBetween(br - 3, by + 1, br + 3, by - 1);
        g.fillStyle(INK, 1).fillEllipse(mx, my + 1, 5, 6.5);
        break;
      }
      case "panic": {
        eye(EYE_L, 2.8);
        eye(EYE_R, 2.8);
        g.lineStyle(1.4, INK, 1);
        const [bl, by] = P(EYE_L, 0, -5);
        const [br] = P(EYE_R, 0, -5);
        g.lineBetween(bl - 3, by + 1.5, bl + 3, by - 1);
        g.lineBetween(br - 3, by - 1, br + 3, by + 1.5);
        g.beginPath();
        g.moveTo(mx - 5, my + 1);
        for (let i = 1; i <= 4; i++) g.lineTo(mx - 5 + i * 2.5, my + (i % 2 ? -1 : 1));
        g.strokePath();
        // sweat drop
        const [sx, sy] = P({ x: 82, y: 36 });
        g.fillStyle(0x9fd8ff, 0.95);
        g.fillTriangle(sx - 2, sy, sx + 2, sy, sx, sy - 4);
        g.fillCircle(sx, sy + 0.5, 2.2);
        break;
      }
      case "dizzy": {
        for (const p of [EYE_L, EYE_R]) {
          const [x, y] = P(p);
          g.lineBetween(x - 2.5, y - 2.5, x + 2.5, y + 2.5);
          g.lineBetween(x - 2.5, y + 2.5, x + 2.5, y - 2.5);
        }
        g.beginPath();
        g.moveTo(mx - 5, my + 1);
        for (let i = 1; i <= 4; i++) g.lineTo(mx - 5 + i * 2.5, my + (i % 2 ? -1 : 1));
        g.strokePath();
        break;
      }
      case "full": {
        for (const p of [EYE_L, EYE_R]) {
          const [x, y] = P(p);
          g.lineBetween(x - 2.5, y, x + 2.5, y);
        }
        g.fillStyle(0xff8a95, 0.8);
        const [lx, ly] = P(EYE_L, -5, 7);
        const [rx, ry] = P(EYE_R, 5, 7);
        g.fillCircle(lx, ly, 3.4);
        g.fillCircle(rx, ry, 3.4);
        g.fillStyle(INK, 1).fillCircle(mx, my + 1, 1.8);
        break;
      }
    }
  }
}
