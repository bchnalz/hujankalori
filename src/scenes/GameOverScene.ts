import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKGROUND } from "../config/assetManifest";
import type { SessionResult } from "../data/types";
import {
  fetchTop,
  getSavedInitials,
  isNameAllowed,
  recordPersonalBest,
  submitScore,
  type LeaderboardEntry,
} from "../data/leaderboard";
import { Sfx } from "../audio/Sfx";
import { makeButton } from "../ui/Button";
import { addMuteToggle } from "../ui/MuteToggle";
import { renderLeaderboard } from "../ui/LeaderboardPanel";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SLOTS = 4;

export class GameOverScene extends Phaser.Scene {
  private result: SessionResult = { survivalSeconds: 0 };
  private name = "";
  private entryUi!: Phaser.GameObjects.Container;
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private slotBoxes!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private busy = false;
  private phase: "entry" | "board" = "entry";

  constructor() {
    super("GameOver");
  }

  init(data: SessionResult): void {
    this.result = data ?? { survivalSeconds: 0 };
  }

  create(): void {
    this.busy = false;
    this.phase = "entry";
    this.slotTexts = [];
    this.name = getSavedInitials();

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUND.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.graphics().fillStyle(0x000000, 0.6).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    addMuteToggle(this, 56, 56);

    const starved = this.result.reason === "starve";
    const pb = recordPersonalBest(this.result.survivalSeconds);

    const title = this.add
      .text(GAME_WIDTH / 2, 150, starved ? "KELAPARAN!" : "GAME OVER", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "72px",
        color: starved ? "#ffb300" : "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    title.setScale(1.6).setAlpha(0);
    this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 380, ease: "Back.easeOut" });

    this.add
      .text(GAME_WIDTH / 2, 222, starved ? "Kamu lupa makan!" : "Kalori berlebih — batas tercapai!", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#cfd8e6",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 290, "Waktu Bertahan", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5);

    const scoreText = this.add
      .text(GAME_WIDTH / 2, 362, "0.0 dtk", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "84px",
        color: "#7CFC8A",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: this.result.survivalSeconds,
      duration: 700,
      ease: "Cubic.easeOut",
      onUpdate: () => scoreText.setText(`${counter.v.toFixed(1)} dtk`),
    });

    if (pb.isNew) {
      const badge = this.add
        .text(GAME_WIDTH / 2, 432, "★ REKOR BARU! ★", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "30px",
          color: "#ffd54f",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: badge, alpha: 1, delay: 700, duration: 200 });
      this.tweens.add({ targets: badge, scale: 1.12, delay: 900, duration: 420, yoyo: true, repeat: -1 });
      this.time.delayedCall(700, () => Sfx.newRecord());
    } else {
      this.add
        .text(GAME_WIDTH / 2, 432, `Rekor kamu: ${pb.best.toFixed(1)} dtk`, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "24px",
          color: "#6b7aa0",
        })
        .setOrigin(0.5);
    }

    Sfx.gameOver(starved);

    if (this.result.survivalSeconds >= 1) {
      this.buildEntry();
    } else {
      void this.showBoard();
    }
  }

  // --------------------------------------------------------------- initials

  private buildEntry(): void {
    const c = (this.entryUi = this.add.container(0, 0));

    c.add(
      this.add
        .text(GAME_WIDTH / 2, 500, "Tulis inisialmu (4 huruf)", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "30px",
          color: "#e8f0ff",
          fontStyle: "bold",
        })
        .setOrigin(0.5),
    );

    // Slots
    const SW = 104;
    const GAP = 22;
    const x0 = GAME_WIDTH / 2 - ((SW + GAP) * SLOTS - GAP) / 2 + SW / 2;
    this.slotBoxes = this.add.graphics();
    c.add(this.slotBoxes);
    for (let i = 0; i < SLOTS; i++) {
      const t = this.add
        .text(x0 + i * (SW + GAP), 598, "", {
          fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
          fontSize: "76px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      this.slotTexts.push(t);
      c.add(t);
    }
    const blink = { on: 1 };
    this.tweens.add({
      targets: blink,
      on: 0,
      duration: 450,
      yoyo: true,
      repeat: -1,
      onUpdate: () => this.drawSlots(x0, SW, GAP, blink.on > 0.5),
    });

    // On-screen keyboard: 26 letters + wide backspace (7 × 4 grid).
    const KW = 84;
    const KH = 74;
    const KG = 8;
    const cols = 7;
    const gx0 = GAME_WIDTH / 2 - ((KW + KG) * cols - KG) / 2;
    const gy0 = 690;
    const keys = [...LETTERS, "⌫"];
    keys.forEach((k, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const wide = k === "⌫";
      const w = wide ? KW * 2 + KG : KW;
      const x = gx0 + col * (KW + KG) + w / 2;
      const y = gy0 + row * (KH + KG) + KH / 2;
      c.add(this.makeKey(x, y, w, KH, k, () => (wide ? this.backspace() : this.typeLetter(k))));
    });

    this.msgText = this.add
      .text(GAME_WIDTH / 2, 1032, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#ff8a80",
      })
      .setOrigin(0.5);
    c.add(this.msgText);

    c.add(makeButton(this, 220, 1130, "KIRIM", () => void this.submit(), { width: 300, height: 96 }));
    c.add(
      makeButton(this, 530, 1130, "LEWATI", () => void this.showBoard(), {
        width: 240,
        height: 96,
        color: 0x37406b,
      }),
    );

    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
      if (this.phase !== "entry") return;
      if (ev.key === "Backspace") this.backspace();
      else if (ev.key === "Enter") void this.submit();
      else if (/^[a-zA-Z]$/.test(ev.key)) this.typeLetter(ev.key.toUpperCase());
    });

    this.refreshSlots();
  }

  private makeKey(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onPress: () => void,
  ): Phaser.GameObjects.Container {
    const bg = this.add.graphics();
    const draw = (down: boolean): void => {
      bg.clear();
      bg.fillStyle(0x1a2238, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 12);
      bg.fillStyle(down ? 0x4caf50 : 0x37406b, 1).fillRoundedRect(-w / 2, -h / 2 + (down ? 4 : 0), w, h - 4, 12);
    };
    draw(false);
    const t = this.add
      .text(0, -2, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "36px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const key = this.add.container(x, y, [bg, t]).setSize(w, h);
    key.setInteractive({ useHandCursor: true });
    key.on("pointerdown", () => {
      draw(true);
      t.y = 2;
    });
    const up = (): void => {
      draw(false);
      t.y = -2;
    };
    key.on("pointerout", up);
    key.on("pointerup", () => {
      up();
      onPress();
    });
    return key;
  }

  private drawSlots(x0: number, SW: number, GAP: number, cursorOn: boolean): void {
    const g = this.slotBoxes;
    g.clear();
    for (let i = 0; i < SLOTS; i++) {
      const x = x0 + i * (SW + GAP);
      const active = i === Math.min(this.name.length, SLOTS - 1) && this.name.length < SLOTS;
      g.fillStyle(0x0b1020, 0.85).fillRoundedRect(x - SW / 2, 540, SW, 116, 14);
      g.lineStyle(4, active ? 0x7cfc8a : 0x2a3450, 1).strokeRoundedRect(x - SW / 2, 540, SW, 116, 14);
      if (active && cursorOn) g.fillStyle(0x7cfc8a, 1).fillRect(x - 30, 636, 60, 6);
    }
  }

  private refreshSlots(): void {
    for (let i = 0; i < SLOTS; i++) this.slotTexts[i]?.setText(this.name[i] ?? "");
  }

  private typeLetter(ch: string): void {
    if (this.busy) return;
    if (this.name.length >= SLOTS) {
      this.name = this.name.slice(0, SLOTS - 1);
    }
    this.name += ch;
    Sfx.type();
    this.msgText.setText("");
    this.refreshSlots();
    const t = this.slotTexts[this.name.length - 1];
    if (t) {
      t.setScale(1.4);
      this.tweens.add({ targets: t, scale: 1, duration: 160, ease: "Back.easeOut" });
    }
  }

  private backspace(): void {
    if (this.busy || this.name.length === 0) return;
    this.name = this.name.slice(0, -1);
    Sfx.type();
    this.msgText.setText("");
    this.refreshSlots();
  }

  private async submit(): Promise<void> {
    if (this.busy || this.phase !== "entry") return;
    if (this.name.length < SLOTS) {
      this.msgText.setText("Inisial harus 4 huruf ya!");
      this.cameras.main.shake(120, 0.004);
      return;
    }
    if (!isNameAllowed(this.name)) {
      this.msgText.setText("Inisial itu tidak bisa dipakai. Coba yang lain.");
      this.cameras.main.shake(120, 0.004);
      return;
    }
    this.busy = true;
    this.msgText.setColor("#9fb0d0").setText("Mengirim skor…");
    Sfx.submit();

    const r = await submitScore(this.name, this.result.survivalSeconds);
    if (!this.scene.isActive()) return;
    if (!r.ok) {
      this.busy = false;
      const msg =
        r.error === "rate_limited"
          ? "Terlalu sering mengirim. Tunggu sebentar ya."
          : r.error === "blocked_name"
            ? "Inisial itu tidak bisa dipakai. Coba yang lain."
            : "Gagal mengirim skor. Coba lagi.";
      this.msgText.setColor("#ff8a80").setText(msg);
      return;
    }

    let extra: LeaderboardEntry | undefined;
    const inTop = r.entries.some((e) => e.id === r.id);
    if (!inTop && r.rank && r.id) {
      extra = { rank: r.rank, name: this.name, score: this.result.survivalSeconds, id: r.id };
    }
    if (r.rank && r.rank <= 3) Sfx.newRecord();
    this.showBoard({ entries: r.entries, online: r.online, highlightId: r.id, extra, rank: r.rank });
  }

  // ------------------------------------------------------------ leaderboard

  private async showBoard(pre?: {
    entries: LeaderboardEntry[];
    online: boolean;
    highlightId?: string;
    extra?: LeaderboardEntry;
    rank?: number;
  }): Promise<void> {
    if (this.phase === "board") return;
    this.phase = "board";
    this.busy = true;
    this.entryUi?.destroy();

    const loading = this.add
      .text(GAME_WIDTH / 2, 640, "Memuat peringkat…", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#9fb0d0",
      })
      .setOrigin(0.5);

    const data = pre ?? (await fetchTop(10));
    if (!this.scene.isActive()) return;
    loading.destroy();

    const header = pre?.rank ? `Peringkat kamu: #${pre.rank}` : "PERINGKAT TERATAS";
    this.add
      .text(GAME_WIDTH / 2, 500, header, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "32px",
        color: pre?.rank ? "#ffd54f" : "#e8f0ff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const rows = data.entries.slice(0, pre?.extra ? 8 : 10);
    const panel = renderLeaderboard(this, GAME_WIDTH / 2, 540, rows, {
      highlightId: pre?.highlightId,
      extra: pre?.extra,
      rowHeight: 48,
    });
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, y: "-=10", duration: 260 });

    if (!data.online) {
      this.add
        .text(GAME_WIDTH / 2, 1076, "Offline — peringkat disimpan di perangkat ini", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "20px",
          color: "#6b7aa0",
        })
        .setOrigin(0.5);
    }

    makeButton(this, 220, 1150, "MAIN LAGI", () => this.scene.start("Game"), { width: 300 });
    makeButton(this, 530, 1150, "MENU", () => this.scene.start("Menu"), { width: 240, color: 0x37406b });
  }
}
