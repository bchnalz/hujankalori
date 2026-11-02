import Phaser from "phaser";
import { FONT_DISPLAY, PALETTE } from "../config/theme";
import { Sfx } from "../audio/Sfx";

const LEGACY_SECONDARY = 0x37406b;

/**
 * Chunky game button: a darker "base" under the face gives it depth, a soft
 * highlight on top, and pressing pushes the face down onto the base.
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { width?: number; height?: number; color?: number; fontSize?: number } = {},
): Phaser.GameObjects.Container {
  const width = opts.width ?? 320;
  const height = opts.height ?? 96;
  const color = opts.color === LEGACY_SECONDARY ? PALETTE.secondary.base : (opts.color ?? PALETTE.primary.base);
  const dark = Phaser.Display.Color.IntegerToColor(color).darken(28).color;
  const DEPTH = Math.max(5, Math.round(height * 0.08));
  const R = Math.min(24, height / 2.6);

  const base = scene.add.graphics();
  base.fillStyle(0x000000, 0.28).fillRoundedRect(-width / 2 + 2, -height / 2 + DEPTH + 4, width - 4, height, R);
  base.fillStyle(dark, 1).fillRoundedRect(-width / 2, -height / 2 + DEPTH, width, height, R);

  const face = scene.add.container(0, 0);
  const faceBg = scene.add.graphics();
  faceBg.fillStyle(color, 1).fillRoundedRect(-width / 2, -height / 2, width, height, R);
  faceBg.fillStyle(0xffffff, 0.16).fillRoundedRect(-width / 2 + 8, -height / 2 + 6, width - 16, height * 0.34, R * 0.7);

  const text = scene.add
    .text(0, -1, label, {
      fontFamily: FONT_DISPLAY,
      fontSize: `${opts.fontSize ?? 42}px`,
      color: "#ffffff",
      stroke: "rgba(0,0,0,0.22)",
      strokeThickness: 2,
    })
    .setOrigin(0.5)
    .setShadow(0, 3, "rgba(0,0,0,0.25)", 0, false, true);
  face.add([faceBg, text]);

  const container = scene.add.container(x, y, [base, face]).setSize(width, height + DEPTH);
  container.setInteractive({ useHandCursor: true });

  const press = (down: boolean): void => {
    face.y = down ? DEPTH - 1 : 0;
  };
  container.on("pointerover", () => container.setScale(1.04));
  container.on("pointerout", () => {
    container.setScale(1);
    press(false);
  });
  container.on("pointerdown", () => press(true));
  container.on("pointerup", () => {
    press(false);
    container.setScale(1);
    Sfx.click();
    onClick();
  });

  return container;
}
