import Phaser from "phaser";
import type { LeaderboardEntry } from "../data/leaderboard";

const MEDALS = [0xffd54f, 0xcfd8dc, 0xd7a86e];

export interface PanelOpts {
  width?: number;
  rowHeight?: number;
  highlightId?: string;
  /** Extra entry shown below a gap when the player ranked outside the list. */
  extra?: LeaderboardEntry;
  online?: boolean;
  emptyText?: string;
}

/** Rounded panel with a ranked list: rank · initials · seconds. */
export function renderLeaderboard(
  scene: Phaser.Scene,
  cx: number,
  top: number,
  entries: LeaderboardEntry[],
  opts: PanelOpts = {},
): Phaser.GameObjects.Container {
  const W = opts.width ?? 600;
  const RH = opts.rowHeight ?? 50;
  const rows = Math.max(entries.length, 1) + (opts.extra ? 2 : 0);
  const H = rows * RH + 40;
  const c = scene.add.container(cx, top);

  const bg = scene.add.graphics();
  bg.fillStyle(0x0b1020, 0.78).fillRoundedRect(-W / 2, 0, W, H, 22);
  bg.lineStyle(3, 0x2a3450, 1).strokeRoundedRect(-W / 2, 0, W, H, 22);
  c.add(bg);

  const font = (size: number, color: string, bold = true): Phaser.Types.GameObjects.Text.TextStyle => ({
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? "bold" : "normal",
  });

  if (entries.length === 0) {
    c.add(
      scene.add
        .text(0, 20 + RH / 2, opts.emptyText ?? "Belum ada skor. Jadilah yang pertama!", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "26px",
          color: "#9fb0d0",
        })
        .setOrigin(0.5),
    );
    return c;
  }

  const addRow = (e: LeaderboardEntry, y: number): void => {
    const mine = !!opts.highlightId && e.id === opts.highlightId;
    if (mine) {
      const hl = scene.add.graphics();
      hl.fillStyle(0x2e7d32, 0.55).fillRoundedRect(-W / 2 + 12, y - RH / 2 + 4, W - 24, RH - 8, 12);
      c.add(hl);
      scene.tweens.add({ targets: hl, alpha: 0.45, duration: 500, yoyo: true, repeat: -1 });
    }
    if (e.rank <= 3) {
      const medal = scene.add.graphics();
      medal.fillStyle(MEDALS[e.rank - 1], 1).fillCircle(-W / 2 + 52, y, 18);
      c.add(medal);
    }
    const rankColor = e.rank <= 3 ? "#0b1020" : "#9fb0d0";
    c.add(scene.add.text(-W / 2 + 52, y, `${e.rank}`, font(e.rank <= 3 ? 22 : 26, rankColor)).setOrigin(0.5));
    c.add(scene.add.text(-W / 2 + 110, y, e.name, font(34, mine ? "#ffffff" : "#e8f0ff")).setOrigin(0, 0.5));
    c.add(
      scene.add
        .text(W / 2 - 34, y, `${e.score.toFixed(1)} dtk`, font(30, mine ? "#b9ffbf" : "#7CFC8A"))
        .setOrigin(1, 0.5),
    );
  };

  let y = 20 + RH / 2;
  for (const e of entries) {
    addRow(e, y);
    y += RH;
  }
  if (opts.extra) {
    c.add(scene.add.text(0, y, "• • •", font(24, "#6b7aa0")).setOrigin(0.5));
    y += RH;
    addRow(opts.extra, y);
  }
  return c;
}
