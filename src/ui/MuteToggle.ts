import Phaser from "phaser";
import { Sfx } from "../audio/Sfx";

/** Speaker on/off button. The choice is remembered in localStorage by Sfx. */
export function addMuteToggle(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const S = 72;
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.4).fillRoundedRect(-S / 2, -S / 2, S, S, 14);

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
