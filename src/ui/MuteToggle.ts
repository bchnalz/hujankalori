import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";

/** Speaker on/off button. The choice is remembered in localStorage by Sfx. */
export function addMuteToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { size?: number; round?: boolean } = {},
): Phaser.GameObjects.Container {
  const S = opts.size ?? 72;
  const bg = scene.add.graphics();
  if (opts.round) roundButtonBg(bg, S);
  else bg.fillStyle(0x000000, 0.4).fillRoundedRect(-S / 2, -S / 2, S, S, 14);

  const icon = scene.add.graphics();
  const draw = (): void => {
    icon.clear();
    icon.fillStyle(0xffffff, 1);
    // speaker body
    icon.fillRect(-20, -8, 10, 16);
    icon.fillTriangle(-10, -8, 4, -20, 4, 20);
    icon.fillTriangle(-10, -8, -10, 8, 4, 20);
    icon.lineStyle(4, 0xffffff, 1);
    if (Sfx.isMuted) {
      icon.lineStyle(5, 0xff6b6b, 1);
      icon.lineBetween(10, -10, 26, 10);
      icon.lineBetween(26, -10, 10, 10);
    } else {
      icon.beginPath();
      icon.arc(4, 0, 12, -0.9, 0.9);
      icon.strokePath();
      icon.beginPath();
      icon.arc(4, 0, 22, -0.9, 0.9);
      icon.strokePath();
    }
  };
  draw();

  icon.setScale(S / 72);
  const container = scene.add.container(x, y, [bg, icon]).setSize(S, S).setDepth(300);
  container.setInteractive({ useHandCursor: true });
  container.on("pointerover", () => container.setScale(1.08));
  container.on("pointerout", () => container.setScale(1));
  container.on("pointerup", () => {
    Sfx.unlock();
    Sfx.toggleMute();
    Sfx.click();
    draw();
  });
  return container;
}

/** Small round glass button background (HUD style). */
export function roundButtonBg(g: Phaser.GameObjects.Graphics, S: number): void {
  g.fillStyle(0x000000, 0.3).fillCircle(0, 3, S / 2);
  g.fillStyle(0x1b2647, 0.95).fillCircle(0, 0, S / 2);
  g.fillStyle(0xffffff, 0.07).fillCircle(0, -S * 0.12, S * 0.34);
  g.lineStyle(2, 0xa0beff, 0.25).strokeCircle(0, 0, S / 2);
}
