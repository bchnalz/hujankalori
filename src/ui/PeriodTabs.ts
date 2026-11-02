import Phaser from "phaser";
import { FONT_UI } from "../config/theme";
import { PERIODS, PERIOD_LABEL, type Period } from "../data/leaderboard";
import { Sfx } from "../audio/Sfx";

/** Segmented control: Hari Ini · Minggu Ini · Semua. */
export function addPeriodTabs(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  initial: Period,
  onChange: (p: Period) => void,
  width = 600,
): Phaser.GameObjects.Container {
  const H = 64;
  const segW = width / PERIODS.length;
  const c = scene.add.container(cx, cy);

  const bg = scene.add.graphics();
  bg.fillStyle(0x0b1020, 0.8).fillRoundedRect(-width / 2, -H / 2, width, H, H / 2);
  bg.lineStyle(3, 0x2a3450, 1).strokeRoundedRect(-width / 2, -H / 2, width, H, H / 2);
  const pill = scene.add.graphics();
  c.add([bg, pill]);

  const labels: Phaser.GameObjects.Text[] = [];
  let current = initial;

  const draw = (): void => {
    const i = PERIODS.indexOf(current);
    pill.clear();
    pill.fillStyle(0x4caf50, 1).fillRoundedRect(-width / 2 + i * segW + 5, -H / 2 + 5, segW - 10, H - 10, (H - 10) / 2);
    labels.forEach((t, j) => t.setColor(j === i ? "#ffffff" : "#9fb0d0"));
  };

  PERIODS.forEach((p, i) => {
    const x = -width / 2 + segW * (i + 0.5);
    const t = scene.add
      .text(x, 0, PERIOD_LABEL[p], {
        fontFamily: FONT_UI,
        fontSize: "26px",
        color: "#9fb0d0",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    labels.push(t);
    const hit = scene.add.zone(x, 0, segW, H).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => {
      if (current === p) return;
      current = p;
      Sfx.click();
      draw();
      onChange(p);
    });
    c.add([t, hit]);
  });

  draw();
  return c;
}
