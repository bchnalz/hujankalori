import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { BACKDROP, PALETTE, type BackdropVariant } from "../config/theme";

/**
 * Rainy night city backdrop, drawn procedurally into canvas textures once per
 * game (cheap to render afterwards):
 *  - night sky gradient with a warm city glow at the horizon and a hazy moon
 *  - drifting rain clouds
 *  - far and near skyline silhouettes; near buildings have lit windows (a few
 *    flicker) and one is a hospital with a glowing red cross
 *  - optional wet street with puddles, light reflections and rain ripples
 */

export interface BackdropOpts {
  /** y where buildings stand / the street starts (default 1020). */
  horizon?: number;
  /** Draw the wet street from `horizon` to the bottom. */
  ground?: boolean;
  /** Depth of the street layer (the game draws it under the HUD feed). */
  groundDepth?: number;
  /** Rain ripples on the street. */
  ripples?: boolean;
  /** 0..1 darkening over the skyline so foreground UI stands out. */
  dim?: number;
  /** Override the configured scenery ("city" | "hospital"). */
  variant?: BackdropVariant;
}

/** Which scenery to draw; `?bg=city` or `?bg=hospital` in the URL overrides it. */
function pickVariant(explicit?: BackdropVariant): BackdropVariant {
  if (explicit) return explicit;
  try {
    const q = new URLSearchParams(window.location.search).get("bg");
    if (q === "city" || q === "hospital") return q;
  } catch {
    /* ignore */
  }
  return BACKDROP;
}

const SKY = "__bd_sky";
const CLOUD = "__bd_cloud";
const RIPPLE = "__bd_ripple";

interface Win {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Deterministic RNG so the skyline looks the same every time. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const hex = (c: number, a = 1): string =>
  `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

function makeSky(scene: Phaser.Scene): void {
  if (scene.textures.exists(SKY)) return;
  const tex = scene.textures.createCanvas(SKY, GAME_WIDTH, GAME_HEIGHT)!;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  g.addColorStop(0, hex(PALETTE.night.top));
  g.addColorStop(0.55, hex(PALETTE.night.mid));
  g.addColorStop(0.8, hex(0x2a2f5e));
  g.addColorStop(1, hex(PALETTE.night.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  // warm light pollution above the city
  const glow = ctx.createRadialGradient(GAME_WIDTH / 2, 1040, 40, GAME_WIDTH / 2, 1040, 620);
  glow.addColorStop(0, "rgba(255,170,120,0.22)");
  glow.addColorStop(1, "rgba(255,170,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  // hazy moon behind the clouds
  const moon = ctx.createRadialGradient(150, 230, 10, 150, 230, 170);
  moon.addColorStop(0, "rgba(220,230,255,0.55)");
  moon.addColorStop(0.18, "rgba(200,215,255,0.22)");
  moon.addColorStop(1, "rgba(200,215,255,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, GAME_WIDTH, 600);
  ctx.fillStyle = "rgba(235,240,255,0.5)";
  ctx.beginPath();
  ctx.arc(150, 230, 34, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
}

function makeCloud(scene: Phaser.Scene): void {
  if (scene.textures.exists(CLOUD)) return;
  const W = 420;
  const H = 170;
  const tex = scene.textures.createCanvas(CLOUD, W, H)!;
  const ctx = tex.getContext();
  const r = rng(11);
  for (let i = 0; i < 14; i++) {
    const cx = 60 + r() * (W - 120);
    const cy = 60 + r() * (H - 100);
    const rad = 40 + r() * 50;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, "rgba(70,82,120,0.55)");
    grad.addColorStop(1, "rgba(70,82,120,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.refresh();
}

function makeRipple(scene: Phaser.Scene): void {
  if (scene.textures.exists(RIPPLE)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.lineStyle(3, 0xbcd0ff, 1).strokeEllipse(40, 12, 76, 20);
  g.generateTexture(RIPPLE, 80, 24);
  g.destroy();
}

/** Skyline texture for a horizon; returns the lit windows (for flicker). */
function makeSkyline(scene: Phaser.Scene, horizon: number, layer: "far" | "near"): { key: string; windows: Win[] } {
  const key = `__bd_${layer}_${horizon}`;
  const winKey = `${key}_wins`;
  if (scene.textures.exists(key)) {
    return { key, windows: (scene.registry.get(winKey) as Win[]) ?? [] };
  }
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, horizon)!;
  const ctx = tex.getContext();
  const r = rng(layer === "far" ? 3 : 7);
  const windows: Win[] = [];
  const color = layer === "far" ? PALETTE.skyline.far : PALETTE.skyline.near;
  const [minH, maxH] = layer === "far" ? [200, 460] : [110, 300];
  const hospitalX = 470;

  let x = -20;
  while (x < GAME_WIDTH + 20) {
    const isHospital = layer === "near" && x < hospitalX && x + 160 > hospitalX;
    const w = isHospital ? 170 : layer === "far" ? 60 + r() * 70 : 70 + r() * 80;
    const h = isHospital ? 330 : minH + r() * (maxH - minH);
    const top = horizon - h;
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, top, w, h + 2);
    // rooftop details
    if (!isHospital && r() < 0.4) ctx.fillRect(x + w * 0.3, top - 14, w * 0.25, 14);
    if (!isHospital && r() < 0.25) ctx.fillRect(x + w * 0.65, top - 46, 3, 46); // antenna

    // windows
    const cols = Math.floor((w - 16) / 18);
    const rows = Math.floor((h - 24) / 26);
    const ox = x + (w - cols * 18) / 2 + 3;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const wx = ox + cx * 18;
        const wy = top + 16 + cy * 26;
        const lit = r() < (layer === "far" ? 0.18 : isHospital ? 0.6 : 0.32);
        if (lit) {
          const warm = r() < 0.8;
          ctx.fillStyle = hex(warm ? PALETTE.skyline.window : PALETTE.skyline.windowCool, layer === "far" ? 0.35 : 0.85);
          ctx.fillRect(wx, wy, 10, 13);
          if (layer === "near") windows.push({ x: wx, y: wy, w: 10, h: 13 });
        } else if (layer === "near") {
          ctx.fillStyle = "rgba(255,255,255,0.04)";
          ctx.fillRect(wx, wy, 10, 13);
        }
      }
    }

    if (isHospital) {
      // glowing red cross sign on the roof
      const sx = x + w / 2;
      scene.registry.set("__bd_hospital_x", sx);
      const sy = top - 46;
      const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 80);
      glow.addColorStop(0, "rgba(255,80,80,0.55)");
      glow.addColorStop(1, "rgba(255,80,80,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 80, sy - 80, 160, 160);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx - 26, sy - 26, 52, 52);
      ctx.fillStyle = "#e53935";
      ctx.fillRect(sx - 7, sy - 20, 14, 40);
      ctx.fillRect(sx - 20, sy - 7, 40, 14);
      ctx.fillStyle = hex(color);
      ctx.fillRect(sx - 3, sy + 26, 6, 20); // sign post
    }
    x += w + (layer === "far" ? -6 + r() * 10 : 4 + r() * 14);
  }
  tex.refresh();
  scene.registry.set(winKey, windows);
  return { key, windows };
}

function makeGround(scene: Phaser.Scene, horizon: number, variant: BackdropVariant): string {
  const key = `__bd_ground_${variant}_${horizon}`;
  if (scene.textures.exists(key)) return key;
  const H = GAME_HEIGHT - horizon;
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, H)!;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, hex(PALETTE.ground.top));
  g.addColorStop(1, hex(PALETTE.ground.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GAME_WIDTH, H);
  // curb line
  ctx.fillStyle = hex(0x3a4878);
  ctx.fillRect(0, 0, GAME_WIDTH, 6);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 0, GAME_WIDTH, 2);
  // reflections of window light
  const r = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = r() * GAME_WIDTH;
    const w = 6 + r() * 14;
    const len = 30 + r() * 90;
    const warm = r() < 0.8;
    const grad = ctx.createLinearGradient(0, 8, 0, 8 + len);
    grad.addColorStop(0, hex(warm ? PALETTE.skyline.window : PALETTE.skyline.windowCool, 0.22));
    grad.addColorStop(1, hex(warm ? PALETTE.skyline.window : PALETTE.skyline.windowCool, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x, 8, w, len);
  }
  // red cross reflection
  const rg = ctx.createLinearGradient(0, 8, 0, 120);
  rg.addColorStop(0, "rgba(255,80,80,0.25)");
  rg.addColorStop(1, "rgba(255,80,80,0)");
  ctx.fillStyle = rg;
  const hx = (scene.registry.get("__bd_hospital_x") as number | undefined) ?? 540;
  ctx.fillRect(hx - 15, 8, 30, 112);
  // puddles
  for (let i = 0; i < 6; i++) {
    const px = 60 + r() * (GAME_WIDTH - 120);
    const py = 40 + r() * (H - 70);
    const pw = 90 + r() * 120;
    const ph = 14 + r() * 12;
    ctx.fillStyle = hex(PALETTE.ground.puddle, 0.55);
    ctx.beginPath();
    ctx.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hex(PALETTE.ground.shine, 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(px, py - 2, pw / 2 - 8, ph / 2 - 4, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  tex.refresh();
  return key;
}

/** Points used for animated details on the IGD backdrop. */
interface HospitalLayout {
  key: string;
  windows: Win[];
  /** Ambulance roof light centres. */
  lights: Array<{ x: number; y: number }>;
}

/**
 * The RSUD emergency building (IGD) at night, in the same flat style:
 * a cream facade with glowing wavy blue window bands and a red neon "IGD",
 * a blue glass wing with red floor stripes and its "Accident & Emergency"
 * sign, an orange ground-floor band, the tensile drop-off canopy, an
 * ambulance, plants and street lamps.
 */
function makeHospital(scene: Phaser.Scene, horizon: number): HospitalLayout {
  const key = `__bd_igd_${horizon}`;
  const metaKey = `${key}_meta`;
  if (scene.textures.exists(key)) {
    const m = scene.registry.get(metaKey) as HospitalLayout | undefined;
    return m ?? { key, windows: [], lights: [] };
  }
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, horizon)!;
  const ctx = tex.getContext();
  const base = horizon;
  const r = rng(21);
  const windows: Win[] = [];
  const font = (w: number, px: number): string => `${w} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;

  // ---- glass wing (behind, right)
  const wx0 = 462;
  const wx1 = GAME_WIDTH + 10;
  const wTop = base - 500;
  ctx.fillStyle = "#16244a";
  ctx.fillRect(wx0, wTop, wx1 - wx0, base - wTop);
  ctx.fillStyle = "#283255";
  ctx.fillRect(wx0, wTop - 34, wx1 - wx0, 34);
  // "Accident & Emergency Department" sign on the parapet
  ctx.save();
  ctx.font = font(800, 14);
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,80,80,0.9)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText("ACCIDENT & EMERGENCY DEPARTMENT", wx0 + 16, wTop - 17, wx1 - wx0 - 34);
  ctx.restore();
  // glazing
  let row = 0;
  for (let y = wTop + 14; y < base - 140; y += 28, row++) {
    if (row % 4 === 0) {
      ctx.fillStyle = "#e53935";
      ctx.fillRect(wx0, y - 6, wx1 - wx0, 5);
    }
    for (let x = wx0 + 10; x < wx1 - 14; x += 30) {
      const lit = r() < 0.55;
      if (lit) {
        const t = r();
        ctx.fillStyle = t < 0.55 ? "rgba(159,216,255,0.75)" : t < 0.85 ? "rgba(232,244,255,0.6)" : "rgba(255,210,122,0.6)";
        windows.push({ x, y, w: 26, h: 21 });
      } else {
        ctx.fillStyle = "rgba(36,64,122,0.9)";
      }
      ctx.fillRect(x, y, 26, 21);
    }
  }

  // ---- main block (front, left) with a rounded corner
  const mx0 = 24;
  const mx1 = 478;
  const mTop = base - 600;
  const block = (): void => {
    const R = 70;
    ctx.beginPath();
    ctx.moveTo(mx0, base);
    ctx.lineTo(mx0, mTop + R);
    ctx.quadraticCurveTo(mx0, mTop, mx0 + R, mTop);
    ctx.lineTo(mx1, mTop);
    ctx.lineTo(mx1, base);
    ctx.closePath();
  };
  const fg = ctx.createLinearGradient(0, mTop, 0, base);
  fg.addColorStop(0, "#4b5374");
  fg.addColorStop(1, "#30385a");
  ctx.fillStyle = fg;
  block();
  ctx.fill();
  // curvature shading on the rounded side
  const side = ctx.createLinearGradient(mx0, 0, mx0 + 130, 0);
  side.addColorStop(0, "rgba(0,0,0,0.38)");
  side.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = side;
  block();
  ctx.fill();
  // panel seams
  ctx.save();
  block();
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let y = mTop + 40; y < base - 110; y += 40) {
    ctx.beginPath();
    ctx.moveTo(mx0, y);
    ctx.lineTo(mx1, y);
    ctx.stroke();
  }
  for (let x = mx0 + 60; x < mx1; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, mTop);
    ctx.lineTo(x, base - 110);
    ctx.stroke();
  }
  ctx.restore();

  // wavy window bands, glowing
  const wave = (x0: number, x1: number, y: number, h: number): void => {
    const w = x1 - x0;
    ctx.beginPath();
    ctx.moveTo(x0, y + h * 0.58);
    ctx.bezierCurveTo(x0 + w * 0.14, y - h * 0.08, x0 + w * 0.5, y + h * 0.04, x1, y + h * 0.1);
    ctx.lineTo(x1, y + h * 0.62);
    ctx.bezierCurveTo(x0 + w * 0.62, y + h * 0.56, x0 + w * 0.26, y + h * 1.02, x0, y + h * 0.58);
    ctx.closePath();
  };
  const band = (x0: number, x1: number, y: number, h: number): void => {
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#9ee2ff");
    g.addColorStop(1, "#3d86d4");
    ctx.shadowColor = "rgba(120,200,255,0.7)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = g;
    wave(x0, x1, y, h);
    ctx.fill();
    ctx.shadowBlur = 0;
    // mullions + a few warm rooms
    wave(x0, x1, y, h);
    ctx.clip();
    for (let x = x0 + 8; x < x1; x += 24) {
      if (r() < 0.16) {
        ctx.fillStyle = "rgba(255,214,140,0.55)";
        ctx.fillRect(x, y, 24, h);
      }
      ctx.fillStyle = "rgba(14,34,70,0.38)";
      ctx.fillRect(x, y, 2, h);
    }
    ctx.restore();
    // dark "eyebrow" louver along the top edge
    ctx.save();
    ctx.strokeStyle = "#1c2238";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    const w = x1 - x0;
    ctx.beginPath();
    ctx.moveTo(x0, y + h * 0.58);
    ctx.bezierCurveTo(x0 + w * 0.14, y - h * 0.08, x0 + w * 0.5, y + h * 0.04, x1, y + h * 0.1);
    ctx.stroke();
    ctx.restore();
  };
  for (const y of [105, 205, 305, 405]) {
    band(150, mx1 - 2, mTop + y, 62);
    band(40, 138, mTop + y + 10, 44);
  }

  // red neon "IGD"
  const igdX = 318;
  ctx.save();
  ctx.font = font(800, 70);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(255,60,60,0.95)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#ff4040";
  ctx.fillText("IGD", igdX, mTop + 82);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd0d0";
  ctx.globalAlpha = 0.35;
  ctx.fillText("IGD", igdX, mTop + 80);
  ctx.restore();
  scene.registry.set("__bd_hospital_x", igdX);

  // ---- ground floor: orange band, entrance, doors
  ctx.save();
  ctx.shadowColor = "rgba(255,130,60,0.8)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#ff7a3d";
  ctx.fillRect(mx0 + 30, base - 112, wx1 - mx0, 14);
  ctx.restore();
  ctx.fillStyle = "#121a30";
  ctx.fillRect(mx0 + 30, base - 98, wx1 - mx0, 98);
  ctx.fillStyle = "rgba(255,207,138,0.75)";
  ctx.fillRect(196, base - 84, 62, 84);
  ctx.fillRect(272, base - 84, 44, 84);
  ctx.fillStyle = "#b8302c";
  ctx.fillRect(334, base - 80, 30, 80);
  ctx.fillStyle = "#2f6fd6";
  ctx.fillRect(150, base - 74, 30, 20); // small blue info sign
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillRect(156, base - 68, 18, 3);
  ctx.fillRect(156, base - 62, 12, 3);

  // ---- street lamps
  const lamp = (x: number): void => {
    ctx.strokeStyle = "#2a3048";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - 150);
    ctx.lineTo(x + 18, base - 156);
    ctx.stroke();
    const g = ctx.createRadialGradient(x + 18, base - 152, 2, x + 18, base - 152, 80);
    g.addColorStop(0, "rgba(255,220,160,0.75)");
    g.addColorStop(1, "rgba(255,220,160,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, base - 240, 180, 180);
    const cone = ctx.createLinearGradient(0, base - 150, 0, base);
    cone.addColorStop(0, "rgba(255,220,160,0.18)");
    cone.addColorStop(1, "rgba(255,220,160,0)");
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x + 10, base - 150);
    ctx.lineTo(x + 26, base - 150);
    ctx.lineTo(x + 70, base);
    ctx.lineTo(x - 34, base);
    ctx.closePath();
    ctx.fill();
  };
  lamp(112);

  // ---- tensile canopy over the drop-off
  const A = { x: 360, y: base - 158 };
  const B = { x: 560, y: base - 290 };
  const C = { x: 736, y: base - 214 };
  const D = { x: 646, y: base - 132 };
  const glow = ctx.createRadialGradient(570, base - 120, 10, 570, base - 120, 190);
  glow.addColorStop(0, "rgba(255,214,150,0.4)");
  glow.addColorStop(1, "rgba(255,214,150,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(360, base - 300, 380, 300);
  const sail = ctx.createLinearGradient(0, B.y, 0, D.y);
  sail.addColorStop(0, "#8a8273");
  sail.addColorStop(1, "#b9ad92");
  ctx.fillStyle = sail;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.quadraticCurveTo(470, base - 200, B.x, B.y);
  ctx.quadraticCurveTo(660, base - 230, C.x, C.y);
  ctx.quadraticCurveTo(690, base - 170, D.x, D.y);
  ctx.quadraticCurveTo(500, base - 160, A.x, A.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,210,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(60,58,52,0.6)";
  ctx.beginPath();
  ctx.moveTo(B.x, B.y);
  ctx.lineTo(560, base - 150);
  ctx.stroke();
  ctx.strokeStyle = "#3a3f55";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(B.x, B.y);
  ctx.lineTo(B.x - 6, base);
  ctx.stroke();

  // ---- plants along the front
  for (let x = 40; x < 470; x += 26) {
    const h = 18 + r() * 14;
    ctx.fillStyle = "#183c2e";
    ctx.beginPath();
    ctx.ellipse(x, base - h / 2 + 2, 22, h / 2 + 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(60,140,100,0.35)";
    ctx.beginPath();
    ctx.ellipse(x - 4, base - h + 4, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // palm by the entrance
  ctx.strokeStyle = "#1d4a36";
  ctx.lineCap = "round";
  ctx.lineWidth = 9;
  const px = 488;
  const py = base - 74;
  for (const [dx, dy] of [[-70, -30], [-56, -64], [-14, -86], [30, -78], [66, -46], [74, -6], [-80, 6]]) {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + dx * 0.5, py + dy - 20, px + dx, py + dy);
    ctx.stroke();
  }
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#3b2f25";
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px - 4, base);
  ctx.stroke();
  // trees on the far left
  ctx.fillStyle = "#14322a";
  for (const [x, y, rr] of [[-10, base - 170, 62], [40, base - 120, 46]]) {
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- ambulance
  const ax = 520;
  const aw = 186;
  const ah = 86;
  const aTop = base - 10 - ah;
  const rr = (x: number, y: number, w: number, h: number, rad: number): void => {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  };
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(ax + aw / 2, base - 6, aw / 2 + 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#dfe5ee";
  rr(ax, aTop, aw - 44, ah, 10);
  ctx.fill();
  // cab
  ctx.beginPath();
  ctx.moveTo(ax + aw - 48, aTop + 14);
  ctx.lineTo(ax + aw - 22, aTop + 14);
  ctx.lineTo(ax + aw, aTop + 46);
  ctx.lineTo(ax + aw, aTop + ah - 6);
  ctx.quadraticCurveTo(ax + aw, aTop + ah, ax + aw - 6, aTop + ah);
  ctx.lineTo(ax + aw - 48, aTop + ah);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1f3a66";
  ctx.beginPath();
  ctx.moveTo(ax + aw - 40, aTop + 20);
  ctx.lineTo(ax + aw - 24, aTop + 20);
  ctx.lineTo(ax + aw - 8, aTop + 44);
  ctx.lineTo(ax + aw - 40, aTop + 44);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(ax + 14, aTop + 14, 40, 24);
  ctx.fillStyle = "#e53935";
  ctx.fillRect(ax, aTop + 52, aw, 9);
  ctx.save();
  ctx.font = font(800, 13);
  ctx.fillStyle = "#e53935";
  ctx.fillText("AMBULANCE", ax + 62, aTop + 32);
  ctx.restore();
  // star of life
  ctx.fillStyle = "#2f6fd6";
  ctx.beginPath();
  ctx.arc(ax + 98, aTop + 70, 8, 0, Math.PI * 2);
  ctx.fill();
  // wheels
  for (const wx of [ax + 36, ax + aw - 34]) {
    ctx.fillStyle = "#151a26";
    ctx.beginPath();
    ctx.arc(wx, base - 10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7d8597";
    ctx.beginPath();
    ctx.arc(wx, base - 10, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // light bar
  ctx.fillStyle = "#2a3048";
  ctx.fillRect(ax + 72, aTop - 8, 46, 8);
  const lights = [
    { x: ax + 82, y: aTop - 5 },
    { x: ax + 108, y: aTop - 5 },
  ];

  tex.refresh();
  const meta: HospitalLayout = { key, windows, lights };
  scene.registry.set(metaKey, meta);
  return meta;
}

export function addBackdrop(scene: Phaser.Scene, opts: BackdropOpts = {}): void {
  const horizon = opts.horizon ?? 1020;
  makeSky(scene);
  makeCloud(scene);
  makeRipple(scene);

  scene.add.image(0, 0, SKY).setOrigin(0).setDepth(-10);

  // drifting clouds
  const r = rng(Math.floor(Math.random() * 1000) + 1);
  for (let i = 0; i < 5; i++) {
    const y = 90 + i * 70 + r() * 40;
    const scale = 0.8 + r() * 0.9;
    const c = scene.add
      .image(r() * GAME_WIDTH, y, CLOUD)
      .setScale(scale, scale * 0.8)
      .setAlpha(0.55 + r() * 0.35)
      .setDepth(-9);
    const speed = 8 + r() * 10; // px/s
    const drift = (): void => {
      const dist = c.x + c.displayWidth / 2 + 10;
      scene.tweens.add({
        targets: c,
        x: -c.displayWidth / 2 - 10,
        duration: (dist / speed) * 1000,
        onComplete: () => {
          c.x = GAME_WIDTH + c.displayWidth / 2;
          drift();
        },
      });
    };
    drift();
  }

  const far = makeSkyline(scene, horizon, "far");
  scene.add.image(0, 0, far.key).setOrigin(0).setDepth(-8);
  const variant = pickVariant(opts.variant);
  let near: { key: string; windows: Win[] };
  let offColor: number = PALETTE.skyline.near;
  if (variant === "hospital") {
    const h = makeHospital(scene, horizon);
    near = h;
    offColor = 0x24407a;
    scene.add.image(0, 0, h.key).setOrigin(0).setDepth(-7);
    // ambulance light bar: alternating red / blue with a soft glow
    const bar = scene.add.graphics().setDepth(-6.4).setBlendMode(Phaser.BlendModes.ADD);
    let phase = 0;
    const drawBar = (): void => {
      bar.clear();
      const [a, b] = h.lights;
      if (!a || !b) return;
      const on = phase % 2 === 0;
      const red = on ? a : b;
      const blue = on ? b : a;
      bar.fillStyle(0xff3030, 0.35).fillCircle(red.x, red.y, 26);
      bar.fillStyle(0xff5050, 1).fillCircle(red.x, red.y, 6);
      bar.fillStyle(0x3a7bff, 0.35).fillCircle(blue.x, blue.y, 26);
      bar.fillStyle(0x5a95ff, 0.5).fillCircle(blue.x, blue.y, 5);
      phase++;
    };
    drawBar();
    scene.time.addEvent({ delay: 260, loop: true, callback: drawBar });
  } else {
    near = makeSkyline(scene, horizon, "near");
    scene.add.image(0, 0, near.key).setOrigin(0).setDepth(-7);
  }

  if (opts.dim) {
    scene.add.rectangle(GAME_WIDTH / 2, horizon / 2, GAME_WIDTH, horizon, PALETTE.night.top, opts.dim).setDepth(-6.5);
  }

  // a few windows switch off/on now and then
  if (near.windows.length) {
    const flick = scene.add.graphics().setDepth(-6.9);
    const off = new Set<number>();
    scene.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        const i = Math.floor(Math.random() * near.windows.length);
        if (off.has(i)) off.delete(i);
        else if (off.size < 6) off.add(i);
        flick.clear();
        flick.fillStyle(offColor, 0.9);
        for (const k of off) {
          const w = near.windows[k];
          flick.fillRect(w.x, w.y, w.w, w.h);
        }
      },
    });
  }

  if (opts.ground !== false) {
    const gKey = makeGround(scene, horizon, variant);
    const depth = opts.groundDepth ?? -1.6;
    scene.add.image(0, horizon, gKey).setOrigin(0).setDepth(depth);

    if (opts.ripples !== false) {
      const pool: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < 10; i++) pool.push(scene.add.image(-100, -100, RIPPLE).setDepth(depth + 0.01).setAlpha(0));
      let next = 0;
      scene.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          const rip = pool[next];
          next = (next + 1) % pool.length;
          const y = horizon + 14 + Math.random() * (GAME_HEIGHT - horizon - 40);
          const depthScale = 0.5 + ((y - horizon) / (GAME_HEIGHT - horizon)) * 0.8; // nearer = bigger
          rip.setPosition(Math.random() * GAME_WIDTH, y).setScale(0.15 * depthScale).setAlpha(0.55);
          scene.tweens.killTweensOf(rip);
          scene.tweens.add({ targets: rip, scale: depthScale, alpha: 0, duration: 650, ease: "Quad.easeOut" });
        },
      });
    }
  }
}
