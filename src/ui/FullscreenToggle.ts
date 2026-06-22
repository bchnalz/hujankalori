import Phaser from "phaser";

/**
 * Small fullscreen toggle button. Renders only where the Fullscreen API is
 * available (hidden on e.g. iOS Safari). When the game is embedded in an iframe,
 * fullscreen also requires the host page to set allow="fullscreen" on the iframe.
 */
export function addFullscreenToggle(scene: Phaser.Scene, x: number, y: number): void {
  if (!scene.scale.fullscreen.available) return;

  const S = 72;
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.4).fillRoundedRect(-S / 2, -S / 2, S, S, 14);

  const icon = scene.add.graphics();
  icon.lineStyle(5, 0xffffff, 1);
  const a = 18;
  const len = 12;
  const corners: ReadonlyArray<readonly [number, number, number, number]> = [
    [-a, -a, 1, 1],
    [a, -a, -1, 1],
    [-a, a, 1, -1],
    [a, a, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    icon.beginPath();
    icon.moveTo(cx + sx * len, cy);
    icon.lineTo(cx, cy);
    icon.lineTo(cx, cy + sy * len);
    icon.strokePath();
  }

  const container = scene.add.container(x, y, [bg, icon]).setSize(S, S).setDepth(300);
  container.setInteractive({ useHandCursor: true });
  container.on("pointerover", () => container.setScale(1.08));
  container.on("pointerout", () => container.setScale(1));
  container.on("pointerup", () => scene.scale.toggleFullscreen());
}
