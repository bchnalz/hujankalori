import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKDROP_LABEL, FONT_DISPLAY, FONT_UI, type BackdropChoice, type BackdropVariant } from "../config/theme";
import { ITEMS } from "../config/itemConfig";
import { UI } from "../config/assetManifest";
import type { Gender } from "../data/types";
import { drawCharacterPortrait, type Uniform } from "../objects/CharacterSprite";
import { Sfx } from "../audio/Sfx";
import { makeBackdropThumb } from "./Backdrop";
import { makeButton } from "./Button";

/**
 * Shareable result card (3:4, 1080 × 1440) for WhatsApp / Instagram Story:
 * score, achievement, initials, the character in their uniform on the scene
 * they played, the food they caught (with counts), and a QR + link back to
 * the game. Shared through the phone's share sheet with an automatic caption.
 */

export interface CardData {
  seconds: number;
  name: string;
  /** Best placement this run, e.g. { rank: 2, period: "hari ini" }. */
  rank?: { rank: number; label: string } | null;
  newRecord: boolean;
  variant: BackdropVariant;
  gender: Gender;
  uniform: Uniform;
  /** item key -> count (activities are ignored on the card). */
  caught: Record<string, number>;
}

const W = 1080;
const H = 1440;

export function gameUrl(): string {
  return `${window.location.origin}/`;
}

const sec = (s: number): string => s.toFixed(1).replace(".", ",");

export function shareCaption(d: CardData): string {
  const url = gameUrl();
  const who = d.name ? `Aku ${d.name}` : "Aku";
  if (d.rank && d.rank.rank === 1) {
    return `🏆 ${who} jadi #1 ${d.rank.label} di Hujan Kalori, bertahan ${sec(d.seconds)} detik! Kamu yakin bisa ngalahin? Buktikan sekarang 👉 ${url}`;
  }
  if (d.rank) {
    return `🌧️ ${who} bertahan ${sec(d.seconds)} detik di Hujan Kalori dan masuk peringkat #${d.rank.rank} ${d.rank.label}! Berani tantang rekorku? 👉 ${url}`;
  }
  if (d.newRecord) {
    return `🔥 Rekor baru! ${who} bertahan ${sec(d.seconds)} detik di Hujan Kalori. Coba kalahkan, kalau bisa 😎 👉 ${url}`;
  }
  return `🌧️ ${who} bertahan ${sec(d.seconds)} detik di Hujan Kalori. Kamu bisa lebih lama? Main sekarang 👉 ${url}`;
}

function img(scene: Phaser.Scene, key: string): CanvasImageSource | null {
  if (!scene.textures.exists(key)) return null;
  return scene.textures.get(key).getSourceImage() as CanvasImageSource;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Outlined game-style text. */
function bold(c: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, fill: string, stroke = 12): void {
  c.font = font;
  c.lineJoin = "round";
  c.lineWidth = stroke;
  c.strokeStyle = "#0b1020";
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
}

export function drawShareCard(scene: Phaser.Scene, d: CardData): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  c.textBaseline = "alphabetic";

  // ---- scene backdrop (brightened a little) + rain + readability shade
  const bg = img(scene, makeBackdropThumb(scene, d.variant, W, H));
  if (bg) {
    c.filter = "brightness(1.35) saturate(1.1)";
    c.drawImage(bg, 0, 0, W, H);
    c.filter = "none";
  }
  c.strokeStyle = "rgba(200,220,255,0.12)";
  c.lineWidth = 2;
  for (let i = 0; i < 90; i++) {
    const x = (i * 137) % (W + 200) - 100;
    const y = (i * 271) % H;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - 8, y + 34);
    c.stroke();
  }
  const sh = c.createLinearGradient(0, 0, 0, H);
  sh.addColorStop(0, "rgba(7,11,24,0.92)");
  sh.addColorStop(0.36, "rgba(7,11,24,0.55)");
  sh.addColorStop(0.62, "rgba(7,11,24,0.2)");
  sh.addColorStop(1, "rgba(7,11,24,0.8)");
  c.fillStyle = sh;
  c.fillRect(0, 0, W, H);

  // ---- logo
  const logo = img(scene, UI.logo.key);
  if (logo) {
    const lw = (logo as HTMLImageElement).width || 1;
    const lh = (logo as HTMLImageElement).height || 1;
    const h = 160;
    const w = (lw / lh) * h;
    c.drawImage(logo, W / 2 - w / 2, 28, w, h);
  }

  // ---- achievement chip
  const chip = d.rank
    ? `${d.newRecord ? "🏆 REKOR BARU · " : ""}PERINGKAT #${d.rank.rank} ${d.rank.label.toUpperCase()}`
    : d.newRecord
      ? "🏆 REKOR BARU!"
      : "HASIL PERMAINANKU";
  const chipCol = d.rank?.rank === 1 || d.newRecord ? "#FFD54F" : "#7CFC8A";
  c.font = `800 34px ${FONT_UI}`;
  const cw = c.measureText(chip).width + 64;
  c.save();
  c.shadowColor = chipCol;
  c.shadowBlur = 30;
  rr(c, W / 2 - cw / 2, 206, cw, 64, 32);
  c.fillStyle = chipCol;
  c.fill();
  c.restore();
  c.fillStyle = "#0b1020";
  c.textAlign = "center";
  c.fillText(chip, W / 2, 250);

  // ---- big score
  c.font = `400 240px ${FONT_DISPLAY}`;
  const num = sec(d.seconds);
  const nw = c.measureText(num).width;
  c.font = `400 92px ${FONT_DISPLAY}`;
  const uw = c.measureText(" dtk").width;
  const sx = W / 2 - (nw + uw) / 2;
  c.textAlign = "left";
  c.save();
  c.shadowColor = "rgba(124,252,138,0.35)";
  c.shadowBlur = 40;
  bold(c, num, sx, 500, `400 240px ${FONT_DISPLAY}`, "#ffffff", 18);
  c.restore();
  bold(c, " dtk", sx + nw, 500, `400 92px ${FONT_DISPLAY}`, "#ffffff", 12);
  c.textAlign = "center";
  const locName = BACKDROP_LABEL[d.variant as BackdropChoice] ?? "";
  bold(c, `bertahan di Hujan Kalori${locName ? ` · ${locName}` : ""}`, W / 2, 566, `800 36px ${FONT_UI}`, "#e8f0ff", 8);

  // ---- character (left)
  const ch = drawCharacterPortrait(d.gender, d.uniform, 560, true);
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.beginPath();
  c.ellipse(270, 1128, 170, 22, 0, 0, Math.PI * 2);
  c.fill();
  c.drawImage(ch, -10, 1140 - 560);

  // ---- initials plate (right)
  const RX = 790;
  if (d.name) {
    bold(c, "PEMAIN", RX, 640, `800 26px ${FONT_UI}`, "#c9d4ec", 6);
    c.font = `400 116px ${FONT_DISPLAY}`;
    const iw = c.measureText(d.name).width + 80;
    c.save();
    c.shadowColor = "rgba(255,213,79,0.6)";
    c.shadowBlur = 34;
    rr(c, RX - iw / 2, 656, iw, 138, 28);
    c.fillStyle = "rgba(11,16,32,0.78)";
    c.fill();
    c.restore();
    c.lineWidth = 5;
    c.strokeStyle = "#FFD54F";
    rr(c, RX - iw / 2, 656, iw, 138, 28);
    c.stroke();
    c.fillStyle = "#FFD54F";
    c.fillText(d.name, RX, 768);
  }

  // ---- what I ate (food only, with counts)
  const eaten = Object.entries(d.caught)
    .map(([key, n]) => ({ def: ITEMS.find((it) => it.key === key), n }))
    .filter((e) => e.def && e.def.type !== "activity" && e.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  const PX = 560;
  const PY = 830;
  const PW = 480;
  const rows = Math.max(1, Math.ceil(eaten.length / 4));
  const PH = 70 + rows * 128;
  rr(c, PX, PY, PW, PH, 30);
  c.fillStyle = "rgba(11,16,32,0.78)";
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(160,190,255,0.3)";
  c.stroke();
  c.font = `800 26px ${FONT_UI}`;
  c.fillStyle = "#c9d4ec";
  c.fillText("YANG KUMAKAN", PX + PW / 2, PY + 46);
  if (!eaten.length) {
    c.font = `700 26px ${FONT_UI}`;
    c.fillStyle = "#9fb0d0";
    c.fillText("Belum makan apa-apa!", PX + PW / 2, PY + 120);
  }
  eaten.forEach((e, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = PX + 66 + col * 116;
    const cy = PY + 118 + row * 128;
    const healthy = e.def!.type === "healthy";
    const ring = healthy ? "#ffc22e" : "#ff5a3a";
    c.beginPath();
    c.arc(cx, cy, 48, 0, Math.PI * 2);
    c.fillStyle = "#16223f";
    c.fill();
    c.lineWidth = 4;
    c.strokeStyle = ring;
    c.stroke();
    const ic = img(scene, e.def!.key);
    if (ic) c.drawImage(ic, cx - 40, cy - 40, 80, 80);
    // count badge
    const t = `×${e.n}`;
    c.font = `400 30px ${FONT_DISPLAY}`;
    const bw = Math.max(46, c.measureText(t).width + 20);
    rr(c, cx + 14, cy + 22, bw, 36, 18);
    c.fillStyle = ring;
    c.fill();
    c.fillStyle = "#0b1020";
    c.fillText(t, cx + 14 + bw / 2, cy + 50);
  });

  // ---- footer: call to action (the link itself goes in the caption)
  const FH = 200;
  const FY = H - 36 - FH;
  rr(c, 36, FY, W - 72, FH, 36);
  const fg = c.createLinearGradient(0, FY, 0, FY + FH);
  fg.addColorStop(0, "rgba(18,26,52,0.95)");
  fg.addColorStop(1, "rgba(8,12,26,0.95)");
  c.fillStyle = fg;
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = "rgba(160,190,255,0.28)";
  c.stroke();
  c.textAlign = "center";
  c.save();
  c.shadowColor = "rgba(124,252,138,0.45)";
  c.shadowBlur = 22;
  c.font = `400 70px ${FONT_DISPLAY}`;
  c.fillStyle = "#7CFC8A";
  c.fillText(d.rank?.rank === 1 || d.newRecord ? "Bisa kalahkan rekorku?" : "Ayo tantang skorku!", W / 2, FY + 92);
  c.restore();
  c.font = `800 28px ${FONT_UI}`;
  c.fillStyle = "#e8f0ff";
  c.fillText(gameUrl().replace(/^https?:\/\//, "").replace(/\/$/, ""), W / 2, FY + 140);
  c.font = `700 22px ${FONT_UI}`;
  c.fillStyle = "#8ea0c4";
  c.fillText("Main gratis · tanpa login · cukup buka di HP", W / 2, FY + 174);
  return cv;
}

async function toBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

/** Share the card + caption through the phone's share sheet (fallback: download). */
export async function shareCard(cv: HTMLCanvasElement, caption: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await toBlob(cv);
  const file = new File([blob], "hujan-kalori.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: CardData | { files: File[] }) => boolean };
  void copyText(caption); // WhatsApp sometimes drops the text when an image is attached
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text: caption, title: "Hujan Kalori" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  downloadCard(blob);
  return "downloaded";
}

export function downloadCard(blob: Blob): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hujan-kalori.png";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1500);
}

/**
 * Preview popup: the card image, the caption, a BAGIKAN button (share sheet)
 * and SIMPAN (download). SFX on open, share and close.
 */
export function openSharePreview(scene: Phaser.Scene, d: CardData): void {
  const cv = drawShareCard(scene, d);
  const caption = shareCaption(d);
  const key = `__share_${Date.now()}`;
  scene.textures.addCanvas(key, cv);
  const DEPTH = 400;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const shade = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x03050c, 0.85)
    .setDepth(DEPTH)
    .setInteractive();
  objs.push(shade);
  const root = scene.add.container(0, 0).setDepth(DEPTH + 1).setAlpha(0);
  objs.push(root);
  const PW = 540;
  const PH = (PW * H) / W;
  const im = scene.add.image(GAME_WIDTH / 2, 70 + PH / 2, key).setDisplaySize(PW, PH);
  const frame = scene.add.graphics();
  frame.lineStyle(4, 0xffffff, 0.25).strokeRoundedRect(GAME_WIDTH / 2 - PW / 2 - 2, 68, PW + 4, PH + 4, 12);
  const capBox = scene.add.graphics();
  const cap = scene.add
    .text(GAME_WIDTH / 2, 70 + PH + 26, caption, {
      fontFamily: FONT_UI,
      fontSize: "20px",
      color: "#e8f0ff",
      align: "left",
      wordWrap: { width: PW + 60, useAdvancedWrap: true },
      lineSpacing: 4,
    })
    .setOrigin(0.5, 0);
  capBox.fillStyle(0x0e1630, 0.95).fillRoundedRect(GAME_WIDTH / 2 - (PW + 90) / 2, 70 + PH + 12, PW + 90, cap.height + 30, 16);
  capBox.lineStyle(2, 0x25d366, 0.6).strokeRoundedRect(GAME_WIDTH / 2 - (PW + 90) / 2, 70 + PH + 12, PW + 90, cap.height + 30, 16);
  const note = cap;
  root.add([im, frame, capBox, note]);
  const status = scene.add
    .text(GAME_WIDTH / 2, 70 + PH + cap.height + 62, "", { fontFamily: FONT_UI, fontSize: "22px", color: "#7CFC8A", fontStyle: "bold" })
    .setOrigin(0.5);
  root.add(status);

  const close = (): void => {
    Sfx.whoosh(true);
    scene.tweens.add({
      targets: [root, shade],
      alpha: 0,
      duration: 180,
      onComplete: () => {
        objs.forEach((o) => o.destroy());
        scene.textures.remove(key);
      },
    });
  };
  const by = Math.min(GAME_HEIGHT - 70, 70 + PH + cap.height + 130);
  root.add(
    makeButton(
      scene,
      140,
      by,
      "BAGIKAN",
      () => {
        Sfx.ding();
        void shareCard(cv, caption).then((r) => {
          if (r === "downloaded") status.setText("Gambar diunduh · caption sudah disalin");
          else if (r === "shared") status.setText("Terima kasih sudah berbagi!");
        });
      },
      { width: 240, height: 88, fontSize: 34, color: 0x25a35a },
    ),
  );
  root.add(
    makeButton(
      scene,
      382,
      by,
      "WHATSAPP",
      () => {
        Sfx.click();
        window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");
        status.setText("Membuka WhatsApp dengan caption & link");
      },
      { width: 220, height: 88, fontSize: 30, color: 0x1f8f4e },
    ),
  );
  root.add(
    makeButton(
      scene,
      596,
      by,
      "SIMPAN",
      () => {
        Sfx.click();
        void toBlob(cv).then((b) => {
          downloadCard(b);
          status.setText("Gambar disimpan");
        });
      },
      { width: 180, height: 88, fontSize: 32, color: 0x37406b },
    ),
  );
  const x = scene.add.container(GAME_WIDTH - 52, 52).setSize(72, 72).setInteractive({ useHandCursor: true });
  const xg = scene.add.graphics();
  xg.fillStyle(0x1b2440, 1).fillCircle(0, 0, 30);
  xg.lineStyle(5, 0xc9d4ec, 1);
  xg.lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  x.add(xg);
  x.on("pointerup", () => {
    Sfx.click();
    close();
  });
  root.add(x);

  Sfx.whoosh();
  root.y = 40;
  scene.tweens.add({ targets: root, alpha: 1, y: 0, duration: 260, ease: "Back.easeOut" });
}
