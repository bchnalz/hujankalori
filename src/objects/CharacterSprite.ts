import type { Gender } from "../data/types";

/**
 * Procedurally drawn player character (chibi style) in one of the RSUD staff
 * uniforms. Drawn on a canvas so every gender × uniform combination comes
 * from the same proportions, and the face overlay in CharacterArt lines up.
 *
 * Coordinates are in the 128-unit frame the face anchors use; the canvas is
 * drawn at `RES`× for crisp edges on high-DPI phones.
 */

export type Uniform = "umum" | "dokter" | "ok" | "penunjang" | "batik";
export const UNIFORMS: Uniform[] = ["umum", "dokter", "ok", "penunjang", "batik"];
export const UNIFORM_LABEL: Record<Uniform, string> = {
  umum: "Bagian Umum",
  dokter: "Dokter",
  ok: "Perawat OK",
  penunjang: "Penunjang",
  batik: "Batik",
};

export const SPRITE_UNIT = 128;
export const RES = 2;
export const FRAMES = 4;
/** Upper-body bob per idle frame (matches the face overlay in CharacterArt). */
export const BOB = [0, -3, 0, 3];

const INK = "#2b1d14";
const SKIN = "#f3cba5";
const SKIN_SHADE = "#e2ad86";

interface Look {
  top: string;
  topShade: string;
  bottom: string;
  bottomShade: string;
  collar?: string;
}

const LOOKS: Record<Uniform, Look> = {
  umum: { top: "#dcc196", topShade: "#c4a676", bottom: "#5b3e2b", bottomShade: "#47301f", collar: "#cfb283" },
  dokter: { top: "#f7f9fc", topShade: "#d9e0ea", bottom: "#7d838d", bottomShade: "#646a73" },
  ok: { top: "#3a9c7c", topShade: "#2d7f64", bottom: "#3a9c7c", bottomShade: "#2d7f64" },
  penunjang: { top: "#24335f", topShade: "#1a2549", bottom: "#1f2c54", bottomShade: "#151e3d", collar: "#2f4078" },
  batik: { top: "#8a4b22", topShade: "#713b19", bottom: "#1f1f24", bottomShade: "#141418" },
};

/** Canvas with all idle frames side by side (FRAMES × 128·RES wide). */
export function drawCharacterSheet(gender: Gender, uniform: Uniform): HTMLCanvasElement {
  const S = SPRITE_UNIT * RES;
  const c = document.createElement("canvas");
  c.width = S * FRAMES;
  c.height = S;
  const ctx = c.getContext("2d")!;
  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * S, 0);
    ctx.scale(RES, RES);
    drawFrame(ctx, gender, uniform, f);
    ctx.restore();
  }
  return c;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient | CanvasPattern, lw = 1.6): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

function batikPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  // kawung motif: four petals around a dot, on a brown ground
  const t = document.createElement("canvas");
  const P = 12 * RES;
  t.width = P;
  t.height = P;
  const g = t.getContext("2d")!;
  g.scale(RES, RES);
  g.fillStyle = "#8a4b22";
  g.fillRect(0, 0, 12, 12);
  g.fillStyle = "#e3b45a";
  for (const [cx, cy] of [
    [6, 6],
    [0, 0],
    [12, 0],
    [0, 12],
    [12, 12],
  ]) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      g.beginPath();
      g.ellipse(cx + Math.cos(a + Math.PI / 4) * 2.6, cy + Math.sin(a + Math.PI / 4) * 2.6, 2.4, 1.3, a + Math.PI / 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = "#3a1d0c";
  g.beginPath();
  g.arc(6, 6, 0.9, 0, Math.PI * 2);
  g.fill();
  const pat = ctx.createPattern(t, "repeat")!;
  pat.setTransform(new DOMMatrix().scale(1 / RES));
  return pat;
}

function drawFrame(ctx: CanvasRenderingContext2D, gender: Gender, u: Uniform, f: number): void {
  const L = LOOKS[u];
  const bob = BOB[f];
  const swing = [0, -1, 0, 1][f];
  const female = gender === "female";
  const ok = u === "ok";

  // ---- ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(64, 125, 26, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- legs + shoes (fixed to the ground)
  const legTop = 96 + bob * 0.5;
  for (const x of [46, 65]) {
    rr(ctx, x, legTop, 17, 122 - legTop, 4);
    fillStroke(ctx, vgrad(ctx, legTop, 122, L.bottom, L.bottomShade));
  }
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(63, legTop + 2, 2, 120 - legTop);
  for (const x of [44, 64]) {
    rr(ctx, x, 117, 20, 8, 4);
    fillStroke(ctx, ok ? "#e9eef2" : "#26201d");
    ctx.fillStyle = ok ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.18)";
    ctx.fillRect(x + 3, 118, 9, 2);
  }

  // everything above the legs bobs
  ctx.save();
  ctx.translate(0, bob);

  // ---- long hair behind the body (female, not under the OK cap)
  if (female && !ok) {
    ctx.beginPath();
    ctx.moveTo(41, 34);
    ctx.quadraticCurveTo(38, 62, 44, 70);
    ctx.lineTo(84, 70);
    ctx.quadraticCurveTo(90, 62, 87, 34);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 30, 70, "#4a2c1d", "#38200f"));
  }

  // ---- arms (behind torso edge), swing a little
  const torsoTop = 58;
  for (const [x, dir] of [
    [29, -1],
    [87, 1],
  ] as const) {
    ctx.save();
    ctx.translate(x + 6, torsoTop + 4);
    ctx.rotate((swing * dir * 2 * Math.PI) / 180);
    rr(ctx, -6, -2, 12, 34, 6);
    fillStroke(ctx, vgrad(ctx, 0, 34, L.top, L.topShade));
    // short-sleeve scrubs show the forearm
    if (ok || u === "penunjang") {
      rr(ctx, -5, 18, 10, 14, 5);
      fillStroke(ctx, SKIN, 1.2);
    }
    ctx.beginPath();
    ctx.arc(0, 35, 6.2, 0, Math.PI * 2);
    fillStroke(ctx, SKIN, 1.4);
    ctx.restore();
  }

  // ---- torso
  rr(ctx, 38, torsoTop, 52, 42, 12);
  const torsoFill = u === "batik" ? batikPattern(ctx) : vgrad(ctx, torsoTop, torsoTop + 42, L.top, L.topShade);
  fillStroke(ctx, torsoFill, 1.8);
  // side shading
  ctx.save();
  rr(ctx, 38, torsoTop, 52, 42, 12);
  ctx.clip();
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(80, torsoTop, 12, 42);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(42, torsoTop + 2, 8, 30);
  ctx.restore();

  // uniform details
  if (u === "umum") {
    // shirt collar, button placket, chest pockets
    ctx.fillStyle = L.collar!;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(64, torsoTop + 9);
      ctx.lineTo(64 + s * 12, torsoTop - 1);
      ctx.lineTo(64 + s * 4, torsoTop - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(43,29,20,0.5)";
    ctx.beginPath();
    ctx.moveTo(64, torsoTop + 9);
    ctx.lineTo(64, torsoTop + 42);
    ctx.stroke();
    ctx.fillStyle = "#f1e4c8";
    for (let y = torsoTop + 14; y < torsoTop + 40; y += 8) {
      ctx.beginPath();
      ctx.arc(64, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const x of [46, 70]) {
      rr(ctx, x, torsoTop + 12, 12, 10, 2);
      ctx.strokeStyle = "rgba(43,29,20,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else if (u === "dokter") {
    // light-blue shirt and tie showing between the open lab-coat lapels
    ctx.fillStyle = "#cfe3f7";
    ctx.beginPath();
    ctx.moveTo(57, torsoTop - 1);
    ctx.lineTo(71, torsoTop - 1);
    ctx.lineTo(66, torsoTop + 42);
    ctx.lineTo(62, torsoTop + 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3f5f9e";
    ctx.beginPath();
    ctx.moveTo(62.5, torsoTop + 3);
    ctx.lineTo(65.5, torsoTop + 3);
    ctx.lineTo(66.5, torsoTop + 22);
    ctx.lineTo(64, torsoTop + 26);
    ctx.lineTo(61.5, torsoTop + 22);
    ctx.closePath();
    ctx.fill();
    // lapels
    ctx.fillStyle = "#eef2f8";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(64 + sgn * 7, torsoTop - 1);
      ctx.lineTo(64 + sgn * 15, torsoTop - 1);
      ctx.lineTo(64 + sgn * 9, torsoTop + 16);
      ctx.lineTo(64 + sgn * 3, torsoTop + 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // coat edges + pockets + pen
    ctx.strokeStyle = "rgba(43,29,20,0.4)";
    ctx.lineWidth = 1;
    for (const x of [61, 67]) {
      ctx.beginPath();
      ctx.moveTo(x, torsoTop + 24);
      ctx.lineTo(x, torsoTop + 42);
      ctx.stroke();
    }
    rr(ctx, 44, torsoTop + 27, 12, 9, 2);
    ctx.stroke();
    rr(ctx, 72, torsoTop + 12, 11, 8, 2);
    ctx.stroke();
    ctx.fillStyle = "#2f6fd1";
    ctx.fillRect(74, torsoTop + 8, 2, 6);
    // stethoscope
    ctx.strokeStyle = "#3a3f48";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(56, torsoTop + 1);
    ctx.quadraticCurveTo(52, torsoTop + 18, 58, torsoTop + 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(72, torsoTop + 1);
    ctx.quadraticCurveTo(76, torsoTop + 14, 74, torsoTop + 22);
    ctx.stroke();
    ctx.fillStyle = "#c9d1dc";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(74, torsoTop + 24, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (ok) {
    // scrub V-neck + chest pocket
    ctx.fillStyle = SKIN;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(56, torsoTop - 1);
    ctx.lineTo(64, torsoTop + 11);
    ctx.lineTo(72, torsoTop - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    rr(ctx, 70, torsoTop + 16, 11, 9, 2);
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.stroke();
  } else if (u === "penunjang") {
    // polo collar + placket
    ctx.fillStyle = L.collar!;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(64, torsoTop + 3);
      ctx.lineTo(64 + s * 11, torsoTop - 1);
      ctx.lineTo(64 + s * 9, torsoTop + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(64, torsoTop + 3);
    ctx.lineTo(64, torsoTop + 16);
    ctx.stroke();
    // small logo patch
    ctx.fillStyle = "#e3e8f5";
    ctx.beginPath();
    ctx.arc(75, torsoTop + 14, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (u === "batik") {
    // collar band
    rr(ctx, 54, torsoTop - 1, 20, 5, 2);
    fillStroke(ctx, "#5e2f12", 1.2);
    ctx.fillStyle = "#e3b45a";
    for (let y = torsoTop + 10; y < torsoTop + 40; y += 8) {
      ctx.beginPath();
      ctx.arc(64, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- neck + head
  rr(ctx, 58, 52, 12, 9, 3);
  fillStroke(ctx, SKIN_SHADE, 1.2);
  ctx.beginPath();
  ctx.ellipse(64, 38, 22, 21, 0, 0, Math.PI * 2);
  fillStroke(ctx, SKIN, 1.8);
  // ears (long hair covers them)
  for (const x of female && !ok ? [] : [42, 86]) {
    ctx.beginPath();
    ctx.ellipse(x, 41, 3.2, 4.4, 0, 0, Math.PI * 2);
    fillStroke(ctx, SKIN, 1.2);
  }

  // ---- hair / OK cap
  if (ok) {
    // surgical bouffant cap
    ctx.beginPath();
    ctx.moveTo(41, 36);
    ctx.quadraticCurveTo(38, 12, 64, 11);
    ctx.quadraticCurveTo(90, 12, 87, 36);
    ctx.quadraticCurveTo(64, 28, 41, 36);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 11, 36, "#4fb592", "#358f71"), 1.8);
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(43, 33);
    ctx.quadraticCurveTo(64, 26, 85, 33);
    ctx.stroke();
    // surgical mask (covers mouth and cheeks; the face overlay draws eyes only)
    ctx.beginPath();
    ctx.moveTo(47, 46.5);
    ctx.quadraticCurveTo(64, 44, 81, 46.5);
    ctx.quadraticCurveTo(82, 58, 64, 60);
    ctx.quadraticCurveTo(46, 58, 47, 46.5);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 45, 60, "#e8f6ff", "#bfe0f2"), 1.4);
    ctx.strokeStyle = "rgba(60,110,140,0.45)";
    ctx.lineWidth = 0.9;
    for (const y of [51, 55]) {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.quadraticCurveTo(64, y - 1.5, 78, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#cfe6f3";
    ctx.lineWidth = 1.2;
    for (const [a, b] of [
      [47, 47.5],
      [81, 47.5],
    ]) {
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(a < 64 ? 42 : 86, 40);
      ctx.stroke();
    }
  } else if (female) {
    // side locks in front of where the ears would be
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(64 + sgn * 18, 24);
      ctx.quadraticCurveTo(64 + sgn * 26, 34, 64 + sgn * 24, 54);
      ctx.quadraticCurveTo(64 + sgn * 21, 57, 64 + sgn * 18, 53);
      ctx.quadraticCurveTo(64 + sgn * 20, 42, 64 + sgn * 16, 33);
      ctx.closePath();
      fillStroke(ctx, vgrad(ctx, 24, 56, "#4e2e1e", "#3a2113"), 1.6);
    }
    // full fringe that sits high on the head (no "bald" forehead)
    ctx.beginPath();
    ctx.moveTo(41, 40);
    ctx.quadraticCurveTo(37, 13, 64, 12);
    ctx.quadraticCurveTo(91, 13, 87, 40);
    ctx.quadraticCurveTo(84, 30, 76, 27);
    ctx.quadraticCurveTo(68, 31, 60, 27);
    ctx.quadraticCurveTo(50, 29, 47, 34);
    ctx.quadraticCurveTo(44, 36, 41, 40);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 12, 40, "#5a3624", "#3e2315"), 1.8);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(55, 18, 7, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // hair clip
    ctx.fillStyle = "#ff7fa8";
    rr(ctx, 76, 22, 7, 3, 1.5);
    ctx.fill();
  } else {
    // short hair with a side part
    ctx.beginPath();
    ctx.moveTo(42, 37);
    ctx.quadraticCurveTo(38, 14, 62, 13);
    ctx.quadraticCurveTo(88, 12, 86, 36);
    ctx.quadraticCurveTo(84, 28, 78, 25);
    ctx.quadraticCurveTo(66, 30, 54, 25);
    ctx.quadraticCurveTo(46, 28, 42, 37);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, 12, 37, "#33241a", "#1f150e"), 1.8);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.ellipse(56, 17, 8, 2.4, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
