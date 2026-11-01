import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { width?: number; height?: number; color?: number } = {},
): Phaser.GameObjects.Container {
  const width = opts.width ?? 320;
  const height = opts.height ?? 96;
  const color = opts.color ?? 0x4caf50;

  const bg = scene.add.graphics();
  bg.fillStyle(color, 1).fillRoundedRect(-width / 2, -height / 2, width, height, 18);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [bg, text]).setSize(width, height);
  container.setInteractive({ useHandCursor: true });

  container.on("pointerover", () => container.setScale(1.05));
  container.on("pointerout", () => container.setScale(1));
  container.on("pointerdown", () => container.setScale(0.96));
  container.on("pointerup", () => {
    container.setScale(1);
    Sfx.click();
    onClick();
  });

  return container;
}
