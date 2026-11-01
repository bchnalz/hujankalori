import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND } from "../config/assetManifest";
import { fetchBoard, getSavedInitials, PERIOD_LABEL, type Period } from "../data/leaderboard";
import { makeButton } from "../ui/Button";
import { addMuteToggle } from "../ui/MuteToggle";
import { renderLeaderboard } from "../ui/LeaderboardPanel";
import { addPeriodTabs } from "../ui/PeriodTabs";
import { WeatherFx } from "../ui/WeatherFx";
import { Sfx } from "../audio/Sfx";

const PANEL_TOP = 292;
const ROW_H = 50;
const ROWS = 15;

/** Public Top-15 board with Hari Ini / Minggu Ini / Semua tabs. */
export class LeaderboardScene extends Phaser.Scene {
  private panel?: Phaser.GameObjects.Container;
  private status!: Phaser.GameObjects.Text;
  private meText!: Phaser.GameObjects.Text;
  private reqId = 0;

  constructor() {
    super("Leaderboard");
  }

  create(): void {
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.panel = undefined;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-2);
    new WeatherFx(this, {
      rainDepth: -1,
      flashDepth: 145,
      flashMaxAlpha: 0.3,
      lightningMinMs: 5000,
      lightningMaxMs: 10000,
      thunderVolume: 0.6,
      rainVolume: 0.05,
    });
    Sfx.playMusic("menu");
    this.add.graphics().fillStyle(0x000000, 0.45).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    addMuteToggle(this, 56, 56);

    this.add
      .text(GAME_WIDTH / 2, 120, "PERINGKAT", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "68px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 182, "Waktu bertahan terlama • skor terbaik per inisial", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5);

    const initial = (this.registry.get("lbPeriod") as Period | undefined) ?? "week";
    addPeriodTabs(this, GAME_WIDTH / 2, 244, initial, (p) => this.loadPeriod(p));

    this.status = this.add
      .text(GAME_WIDTH / 2, 600, "", { fontFamily: "system-ui, sans-serif", fontSize: "28px", color: "#9fb0d0" })
      .setOrigin(0.5);
    this.meText = this.add
      .text(GAME_WIDTH / 2, PANEL_TOP + ROWS * ROW_H + 72, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#ffd54f",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 86, "KEMBALI", () => this.scene.start("Menu"), {
      color: 0x37406b,
    });

    this.loadPeriod(initial);
  }

  private loadPeriod(period: Period): void {
    this.registry.set("lbPeriod", period);
    const id = ++this.reqId;
    this.panel?.destroy();
    this.panel = undefined;
    this.meText.setText("");
    this.status.setText("Memuat…");

    const me = getSavedInitials();
    void fetchBoard(period, ROWS, me).then((data) => {
      if (!this.scene.isActive() || id !== this.reqId) return;
      this.status.setText("");
      this.panel = renderLeaderboard(this, GAME_WIDTH / 2, PANEL_TOP, data.entries, {
        rowHeight: ROW_H,
        highlightId: /^[A-Z]{4}$/.test(me) ? me : undefined,
        emptyText: period === "all" ? "Belum ada skor. Jadilah yang pertama!" : `Belum ada skor ${PERIOD_LABEL[period].toLowerCase()}.`,
      });
      this.panel.setAlpha(0);
      this.tweens.add({ targets: this.panel, alpha: 1, duration: 200 });

      const lines: string[] = [];
      if (data.me) {
        lines.push(`${me}: #${data.me.rank.toLocaleString("id-ID")} dari ${data.total.toLocaleString("id-ID")} pemain • ${data.me.score.toFixed(1)} dtk`);
      } else if (data.total > 0) {
        lines.push(`${data.total.toLocaleString("id-ID")} pemain`);
      }
      if (!data.online) lines.push("Offline — menampilkan skor di perangkat ini");
      this.meText.setText(lines.join("\n"));
      this.meText.setColor(data.me ? "#ffd54f" : "#9fb0d0");
    });
  }
}
