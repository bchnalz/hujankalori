import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { backdropForNow, FONT_MONUMENT, PALETTE, type BackdropVariant } from "../config/theme";
import { getBackdropChoice } from "../data/prefs";

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
  /** Override the scenery for this screen. */
  variant?: BackdropVariant;
}

const VARIANT_KEY = "__bd_variant";

/**
 * Work out the scenery once and remember it in the game registry, so every
 * screen of a session shows the same scene even if the clock crosses a time
 * slot mid-run. Order: `?bg=` URL override → the player's menu pick →
 * the current WIB time of day.
 */
export function resolveBackdrop(scene: Phaser.Scene): BackdropVariant {
  let v: BackdropVariant | null = null;
  try {
    const q = new URLSearchParams(window.location.search).get("bg");
    if (q === "city" || q === "hospital" || q === "morning" || q === "garden") v = q;
  } catch {
    /* ignore */
  }
  if (!v) {
    const c = getBackdropChoice();
    v = c === "auto" ? backdropForNow() : c;
  }
  scene.registry.set(VARIANT_KEY, v);
  return v;
}

function pickVariant(scene: Phaser.Scene, explicit?: BackdropVariant): BackdropVariant {
  if (explicit) return explicit;
  return (scene.registry.get(VARIANT_KEY) as BackdropVariant | undefined) ?? resolveBackdrop(scene);
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

function makeSky(scene: Phaser.Scene, variant: BackdropVariant): string {
  if (variant === "morning") return makeMorningSky(scene);
  if (variant === "garden") return makeGardenSky(scene);
  if (scene.textures.exists(SKY)) return SKY;
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
  return SKY;
}

/** Rainy late afternoon: heavy grey cover with a faint warm band low down. */
function makeGardenSky(scene: Phaser.Scene): string {
  const key = "__bd_sky_garden";
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT)!;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  g.addColorStop(0, "#22263a");
  g.addColorStop(0.45, "#3a3d56");
  g.addColorStop(0.72, "#5e5a6e");
  g.addColorStop(1, "#3a3a52");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const sun = ctx.createRadialGradient(180, 520, 20, 180, 520, 420);
  sun.addColorStop(0, "rgba(230,190,170,0.16)");
  sun.addColorStop(1, "rgba(230,190,170,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, GAME_WIDTH, 1000);
  tex.refresh();
  return key;
}

/** Dark overcast morning: slate cloud cover, a pale band near the horizon, no sun. */
function makeMorningSky(scene: Phaser.Scene): string {
  const key = "__bd_sky_morning";
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, GAME_HEIGHT)!;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  g.addColorStop(0, "#1f2638");
  g.addColorStop(0.45, "#343e57");
  g.addColorStop(0.78, "#56627c");
  g.addColorStop(1, "#3a4560");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  // diffuse light where the hidden sun is
  const sun = ctx.createRadialGradient(560, 260, 20, 560, 260, 380);
  sun.addColorStop(0, "rgba(210,218,236,0.18)");
  sun.addColorStop(1, "rgba(210,218,236,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, GAME_WIDTH, 700);
  tex.refresh();
  return key;
}

function makeCloud(scene: Phaser.Scene, variant: BackdropVariant): string {
  const key = variant === "city" || variant === "hospital" ? CLOUD : `${CLOUD}_${variant}`;
  if (scene.textures.exists(key)) return key;
  const col = variant === "morning" ? "92,102,128" : variant === "garden" ? "96,94,118" : "70,82,120";
  const W = 420;
  const H = 170;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx = tex.getContext();
  const r = rng(11);
  for (let i = 0; i < 14; i++) {
    const cx = 60 + r() * (W - 120);
    const cy = 60 + r() * (H - 100);
    const rad = 40 + r() * 50;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, `rgba(${col},0.6)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  tex.refresh();
  return key;
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
  const garden = variant === "garden";
  const morning = variant === "morning" || garden;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, garden ? "#2c4a36" : morning ? "#3a4460" : hex(PALETTE.ground.top));
  g.addColorStop(1, garden ? "#142218" : morning ? "#1f2638" : hex(PALETTE.ground.bottom));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GAME_WIDTH, H);
  // curb line
  ctx.fillStyle = garden ? "#5a7a4c" : hex(0x3a4878);
  ctx.fillRect(0, 0, GAME_WIDTH, 6);
  if (garden) {
    // grass blades
    const gr = rng(9);
    ctx.strokeStyle = "rgba(120,170,110,0.25)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 260; i++) {
      const x = gr() * GAME_WIDTH;
      const y = 10 + gr() * (H - 10);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (gr() - 0.5) * 6, y - 6 - gr() * 6);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 0, GAME_WIDTH, 2);
  // reflections of window light
  const r = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = r() * GAME_WIDTH;
    const w = 6 + r() * 14;
    const len = 30 + r() * 90;
    const warm = r() < (morning ? 0.25 : 0.8);
    const grad = ctx.createLinearGradient(0, 8, 0, 8 + len);
    grad.addColorStop(0, hex(warm ? PALETTE.skyline.window : PALETTE.skyline.windowCool, 0.22));
    grad.addColorStop(1, hex(warm ? PALETTE.skyline.window : PALETTE.skyline.windowCool, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x, 8, w, len);
  }
  // red sign reflection (night scenery only)
  const rg = ctx.createLinearGradient(0, 8, 0, 120);
  if (morning) ctx.globalAlpha = 0;
  rg.addColorStop(0, "rgba(255,80,80,0.25)");
  rg.addColorStop(1, "rgba(255,80,80,0)");
  ctx.fillStyle = rg;
  const hx = (scene.registry.get("__bd_hospital_x") as number | undefined) ?? 540;
  ctx.fillRect(hx - 15, 8, 30, 112);
  ctx.globalAlpha = 1;
  // puddles
  for (let i = 0; i < 6; i++) {
    const px = 60 + r() * (GAME_WIDTH - 120);
    const py = 40 + r() * (H - 70);
    const pw = 90 + r() * 120;
    const ph = 14 + r() * 12;
    ctx.fillStyle = garden ? "rgba(96,112,130,0.5)" : morning ? "rgba(110,124,156,0.5)" : hex(PALETTE.ground.puddle, 0.55);
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

/** 0..1 — how much the IGD building is pushed into night shadow (URL: ?dark=0.6). */
const HOSPITAL_DARKNESS = (() => {
  try {
    const v = Number(new URLSearchParams(window.location.search).get("dark"));
    if (Number.isFinite(v) && v >= 0 && v <= 0.95 && new URLSearchParams(window.location.search).has("dark")) return v;
  } catch {
    /* ignore */
  }
  return 0.6;
})();

/** Extra shade on the ambulance on top of the building's night pass. */
const AMBULANCE_EXTRA_DARK = 0.15;

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
function makeHospital(scene: Phaser.Scene, horizon: number, darkness = HOSPITAL_DARKNESS): HospitalLayout {
  const key = `__bd_igd_${horizon}_${darkness}`;
  const metaKey = `${key}_meta`;
  if (scene.textures.exists(key)) {
    const m = scene.registry.get(metaKey) as HospitalLayout | undefined;
    return m ?? { key, windows: [], lights: [] };
  }
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, horizon)!;
  let ctx: CanvasRenderingContext2D = tex.getContext();
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
  const neon = (): void => {
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
  };
  neon();
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
  const lampGlow = (x: number): void => {
    const g = ctx.createRadialGradient(x + 18, base - 152, 2, x + 18, base - 152, 46);
    g.addColorStop(0, "rgba(255,226,170,0.9)");
    g.addColorStop(1, "rgba(255,226,170,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, base - 200, 120, 100);
  };

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

  // ---- ambulance (drawn on its own layer so it can sit deeper in shadow)
  const mainCtx = ctx;
  const ambCanvas = document.createElement("canvas");
  ambCanvas.width = GAME_WIDTH;
  ambCanvas.height = horizon;
  ctx = ambCanvas.getContext("2d")!;
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
  ctx = mainCtx;

  // Night pass: darken everything painted so far (sky stays untouched), then
  // put back the light sources so they still read as lit.
  if (darkness > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(6,10,24,${darkness})`;
    ctx.fillRect(0, 0, GAME_WIDTH, horizon);
    ctx.restore();
    neon();
    lampGlow(112);
  }
  // ambulance: extra shade so it doesn't compete with the player and items
  const ambDark = Math.min(0.9, darkness + AMBULANCE_EXTRA_DARK);
  const actx = ambCanvas.getContext("2d")!;
  actx.globalCompositeOperation = "source-atop";
  actx.fillStyle = `rgba(6,10,24,${ambDark})`;
  actx.fillRect(0, 0, GAME_WIDTH, horizon);
  ctx.drawImage(ambCanvas, 0, 0);
  const lights = [
    { x: ax + 82, y: aTop - 5 },
    { x: ax + 108, y: aTop - 5 },
  ];

  tex.refresh();
  const meta: HospitalLayout = { key, windows, lights };
  scene.registry.set(metaKey, meta);
  return meta;
}

/** 0..1 overcast shade on the main building (URL: ?mdark=0.4). */
const MAIN_DARKNESS = (() => {
  try {
    const p = new URLSearchParams(window.location.search);
    const v = Number(p.get("mdark"));
    if (p.has("mdark") && Number.isFinite(v) && v >= 0 && v <= 0.95) return v;
  } catch {
    /* ignore */
  }
  return 0.4;
})();

/**
 * RSUD main building on a dark overcast morning: white classical facade with
 * a maroon hip roof and five dormers, two corner towers with pyramid roofs and
 * small domed cupolas, arched top-floor and tower windows, iron balconies, a
 * central entrance portico with an arched window, the flag, palms, trees and
 * blue lamp posts. (No name sign, on request.)
 */
function makeMainBuilding(scene: Phaser.Scene, horizon: number, darkness = MAIN_DARKNESS): { key: string; windows: Win[] } {
  const key = `__bd_main_${horizon}_${darkness}`;
  const winKey = `${key}_wins`;
  if (scene.textures.exists(key)) return { key, windows: (scene.registry.get(winKey) as Win[]) ?? [] };
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, horizon)!;
  const ctx = tex.getContext();
  const base = horizon;
  const r = rng(33);
  const windows: Win[] = [];
  const lit: Win[] = [];

  const WALL = "#dfe3ea";
  const WALL_SHADE = "#c3c9d6";
  const TRIM = "#f3efe4";
  const ROOF = "#7a2a30";
  const ROOF_DARK = "#5a1e24";
  const GLASS = "#5d6984";
  const FRAME = "#f6f7fa";
  const WARM = "#ffd9a0";

  const win = (x: number, y: number, w: number, h: number, arched: boolean): void => {
    const isLit = r() < 0.2;
    ctx.fillStyle = FRAME;
    ctx.beginPath();
    if (arched) {
      ctx.moveTo(x - 2, y + h + 2);
      ctx.lineTo(x - 2, y + w / 2);
      ctx.arc(x + w / 2, y + w / 2, w / 2 + 2, Math.PI, 0);
      ctx.lineTo(x + w + 2, y + h + 2);
    } else {
      ctx.rect(x - 2, y - 2, w + 4, h + 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = isLit ? WARM : GLASS;
    ctx.beginPath();
    if (arched) {
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + w / 2);
      ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, y + h);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.closePath();
    ctx.fill();
    // mullions
    ctx.fillStyle = "rgba(246,247,250,0.9)";
    ctx.fillRect(x + w / 2 - 1, y + (arched ? w / 3 : 0), 2, h - (arched ? w / 3 : 0));
    ctx.fillRect(x, y + h * (arched ? 0.62 : 0.5) - 1, w, 2);
    const cell = { x, y, w, h };
    windows.push(cell);
    if (isLit) lit.push(cell);
  };

  // ---- towers
  const towers: Array<[number, number]> = [
    [18, 142],
    [578, 702],
  ];
  const tTop = base - 560;
  for (const [x0, x1] of towers) {
    ctx.fillStyle = WALL;
    ctx.fillRect(x0, tTop, x1 - x0, base - tTop);
    // edge pilasters + shading
    ctx.fillStyle = WALL_SHADE;
    ctx.fillRect(x0, tTop, 8, base - tTop);
    ctx.fillRect(x1 - 8, tTop, 8, base - tTop);
    // string courses
    ctx.fillStyle = TRIM;
    for (let y = tTop + 22; y < base - 30; y += 66) ctx.fillRect(x0, y, x1 - x0, 4);
    // stacked arched windows
    const cx = (x0 + x1) / 2;
    for (let y = tTop + 34; y < base - 70; y += 66) win(cx - 16, y, 32, 46, true);
    // cornice
    ctx.fillStyle = TRIM;
    ctx.fillRect(x0 - 10, tTop - 12, x1 - x0 + 20, 12);
    // pyramid roof
    const rg = ctx.createLinearGradient(0, tTop - 76, 0, tTop - 12);
    rg.addColorStop(0, ROOF_DARK);
    rg.addColorStop(1, ROOF);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(x0 - 22, tTop - 12);
    ctx.lineTo(x1 + 22, tTop - 12);
    ctx.lineTo(x1 - 26, tTop - 76);
    ctx.lineTo(x0 + 26, tTop - 76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = TRIM;
    ctx.fillRect(x0 - 24, tTop - 14, x1 - x0 + 48, 4);
    // cupola with dome and spire
    ctx.fillStyle = WALL;
    ctx.fillRect(cx - 16, tTop - 112, 32, 36);
    ctx.fillStyle = GLASS;
    ctx.beginPath();
    ctx.moveTo(cx - 7, tTop - 80);
    ctx.lineTo(cx - 7, tTop - 98);
    ctx.arc(cx, tTop - 98, 7, Math.PI, 0);
    ctx.lineTo(cx + 7, tTop - 80);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = TRIM;
    ctx.fillRect(cx - 20, tTop - 114, 40, 5);
    ctx.fillStyle = WALL;
    ctx.beginPath();
    ctx.arc(cx, tTop - 114, 16, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#8a93a6";
    ctx.fillRect(cx - 1, tTop - 146, 2, 18);
  }

  // ---- main block
  const mx0 = 142;
  const mx1 = 578;
  const mTop = base - 470;
  ctx.fillStyle = WALL;
  ctx.fillRect(mx0, mTop, mx1 - mx0, base - mTop);
  // hip roof with five dormers
  const roofTop = mTop - 118;
  const rg = ctx.createLinearGradient(0, roofTop, 0, mTop);
  rg.addColorStop(0, ROOF_DARK);
  rg.addColorStop(1, ROOF);
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(mx0 - 4, mTop);
  ctx.lineTo(mx1 + 4, mTop);
  ctx.lineTo(mx1 - 104, roofTop);
  ctx.lineTo(mx0 + 104, roofTop);
  ctx.closePath();
  ctx.fill();
  // roof shingle hint
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let y = roofTop + 14; y < mTop; y += 14) {
    const t = (y - roofTop) / (mTop - roofTop);
    ctx.beginPath();
    ctx.moveTo(mx0 + 104 - 108 * t, y);
    ctx.lineTo(mx1 - 104 + 108 * t, y);
    ctx.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const dx = mx0 + 120 + i * ((mx1 - mx0 - 240) / 4);
    const dy = mTop - 70;
    ctx.fillStyle = TRIM;
    ctx.beginPath();
    ctx.moveTo(dx - 20, dy + 30);
    ctx.lineTo(dx, dy);
    ctx.lineTo(dx + 20, dy + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = WALL;
    ctx.fillRect(dx - 14, dy + 26, 28, 22);
    ctx.fillStyle = GLASS;
    ctx.fillRect(dx - 9, dy + 29, 18, 16);
    ctx.fillStyle = "rgba(246,247,250,0.9)";
    ctx.fillRect(dx - 1, dy + 29, 2, 16);
  }
  // cream eave + cornice
  ctx.fillStyle = TRIM;
  ctx.fillRect(mx0 - 6, mTop - 4, mx1 - mx0 + 12, 10);

  // floors: arched pairs on top, rectangular pairs below, pilasters between bays
  const bays = 8;
  const bayW = (mx1 - mx0) / bays;
  const floorH = 58;
  for (let b = 1; b < bays; b++) {
    ctx.fillStyle = WALL_SHADE;
    ctx.fillRect(mx0 + b * bayW - 2, mTop + 8, 4, base - mTop - 8);
  }
  for (let f = 0; f < 7; f++) {
    const y = mTop + 18 + f * floorH;
    ctx.fillStyle = TRIM;
    ctx.fillRect(mx0, y - 8, mx1 - mx0, 3);
    for (let b = 0; b < bays; b++) {
      const bx = mx0 + b * bayW;
      const inPortico = f >= 4 && b >= 3 && b <= 4;
      if (inPortico) continue;
      win(bx + bayW / 2 - 19, y, 15, f === 0 ? 34 : 28, f === 0);
      win(bx + bayW / 2 + 4, y, 15, f === 0 ? 34 : 28, f === 0);
      // iron balconies on a few bays
      if ((f === 1 || f === 2) && (b === 0 || b === 2 || b === 5 || b === 7)) {
        ctx.strokeStyle = "#39404f";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 6, y + 22, bayW - 12, 10);
        for (let k = bx + 10; k < bx + bayW - 8; k += 5) {
          ctx.beginPath();
          ctx.moveTo(k, y + 22);
          ctx.lineTo(k, y + 32);
          ctx.stroke();
        }
      }
    }
  }
  // central entrance portico (no name sign)
  const px0 = mx0 + 3 * bayW - 10;
  const px1 = mx0 + 5 * bayW + 10;
  const pTop = base - 236;
  ctx.fillStyle = "#e8ebf1";
  ctx.fillRect(px0, pTop, px1 - px0, base - pTop);
  ctx.fillStyle = TRIM;
  ctx.fillRect(px0 - 6, pTop - 6, px1 - px0 + 12, 12);
  ctx.fillRect(px0 - 6, pTop + 22, px1 - px0 + 12, 4);
  ctx.fillStyle = WALL_SHADE;
  ctx.fillRect(px0, pTop, 5, base - pTop);
  ctx.fillRect(px1 - 5, pTop, 5, base - pTop);
  const pcx = (px0 + px1) / 2;
  win(pcx - 34, pTop + 50, 68, 70, true);
  // doors
  ctx.fillStyle = "#2c3346";
  ctx.fillRect(pcx - 30, base - 78, 60, 78);
  ctx.fillStyle = "rgba(255,217,160,0.65)";
  ctx.fillRect(pcx - 26, base - 72, 24, 72);
  ctx.fillRect(pcx + 2, base - 72, 24, 72);
  // small side windows in the portico
  win(px0 + 16, pTop + 150, 15, 28, false);
  win(px1 - 31, pTop + 150, 15, 28, false);

  // flag
  ctx.strokeStyle = "#cfd5df";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pcx - 56, base);
  ctx.lineTo(pcx - 56, base - 170);
  ctx.stroke();
  ctx.fillStyle = "#e53935";
  ctx.fillRect(pcx - 54, base - 168, 34, 11);
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(pcx - 54, base - 157, 34, 11);

  // ---- greenery and lamp posts in front
  const tree = (x: number, s: number): void => {
    ctx.fillStyle = "#2c4f3c";
    ctx.beginPath();
    ctx.arc(x, base - 70 * s, 46 * s, 0, Math.PI * 2);
    ctx.arc(x - 30 * s, base - 46 * s, 34 * s, 0, Math.PI * 2);
    ctx.arc(x + 30 * s, base - 46 * s, 34 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(120,170,130,0.25)";
    ctx.beginPath();
    ctx.arc(x - 12 * s, base - 88 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  const palm = (x: number, h: number, lean: number): void => {
    ctx.strokeStyle = "#5a4a3a";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    const tx = x + lean;
    const ty = base - h;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * 0.2, base - h * 0.5, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = "#2f5c46";
    ctx.lineWidth = 8;
    for (const [dx, dy] of [[-74, 22], [-60, -14], [-24, -40], [24, -40], [60, -14], [74, 22], [-40, 40], [40, 40]]) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + dx * 0.55, ty + dy - 24, tx + dx, ty + dy);
      ctx.stroke();
    }
  };
  const lampPost = (x: number): void => {
    ctx.strokeStyle = "#3f78c4";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - 160);
    ctx.lineTo(x + 16, base - 166);
    ctx.stroke();
  };
  tree(100, 1.0);
  tree(250, 0.9);
  tree(470, 0.95);
  tree(630, 1.0);
  lampPost(196);
  lampPost(522);
  palm(40, 150, 10);
  palm(178, 128, -8);
  palm(560, 136, 8);
  palm(690, 156, -12);
  // low hedge
  ctx.fillStyle = "#24443a";
  for (let x = 0; x < GAME_WIDTH; x += 24) {
    ctx.beginPath();
    ctx.ellipse(x, base - 8, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- overcast shade, then put back the warm room lights and lamp heads
  if (darkness > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(22,28,48,${darkness})`;
    ctx.fillRect(0, 0, GAME_WIDTH, horizon);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,214,150,0.75)";
  for (const w of lit) ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
  for (const x of [196, 522]) {
    const g = ctx.createRadialGradient(x + 16, base - 162, 2, x + 16, base - 162, 38);
    g.addColorStop(0, "rgba(255,230,180,0.85)");
    g.addColorStop(1, "rgba(255,230,180,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, base - 210, 100, 90);
  }
  // morning mist at the foot of the building
  const mist = ctx.createLinearGradient(0, base - 160, 0, base);
  mist.addColorStop(0, "rgba(190,200,222,0)");
  mist.addColorStop(1, "rgba(190,200,222,0.28)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, base - 160, GAME_WIDTH, 160);

  tex.refresh();
  scene.registry.set(winKey, lit);
  return { key, windows: lit };
}

/** 0..1 shade on the garden scene (URL: ?gdark=0.4). */
const GARDEN_DARKNESS = (() => {
  try {
    const p = new URLSearchParams(window.location.search);
    const v = Number(p.get("gdark"));
    if (p.has("gdark") && Number.isFinite(v) && v >= 0 && v <= 0.95) return v;
  } catch {
    /* ignore */
  }
  return 0.4;
})();

/**
 * RSUD front garden on a rainy late afternoon: tall cypress trees, a dense
 * tree line, a white ward building with a red cross on the left, a pendopo
 * (red tiled hip roof, white pillars, hanging red lanterns) on the right,
 * slender shade trees, a log planter, river stones, the lawn and the
 * "RSUD SIDOARJO" letter sign.
 */
function makeGarden(scene: Phaser.Scene, horizon: number, darkness = GARDEN_DARKNESS): { key: string; windows: Win[] } {
  const key = `__bd_garden_${horizon}_${darkness}`;
  const winKey = `${key}_wins`;
  if (scene.textures.exists(key)) return { key, windows: (scene.registry.get(winKey) as Win[]) ?? [] };
  const tex = scene.textures.createCanvas(key, GAME_WIDTH, horizon)!;
  const ctx = tex.getContext();
  const base = horizon;
  const r = rng(51);
  const lit: Win[] = [];
  const lanterns: Array<[number, number]> = [];

  const blob = (x: number, y: number, rad: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  };

  // ---- far tree line (mid green, hazy)
  for (let x = -20; x < GAME_WIDTH + 40; x += 34) {
    blob(x, base - 300 - r() * 70, 50 + r() * 26, "#3f6650");
  }
  ctx.fillStyle = "#3f6650";
  ctx.fillRect(0, base - 300, GAME_WIDTH, 300);

  // ---- white ward building on the left with a red cross
  const bx1 = 210;
  const bTop = base - 470;
  ctx.fillStyle = "#e4e8ef";
  ctx.fillRect(0, bTop, bx1, base - bTop);
  ctx.fillStyle = "#c6ccd8";
  ctx.fillRect(bx1 - 14, bTop, 14, base - bTop);
  ctx.fillStyle = "#f4f6f9";
  ctx.fillRect(0, bTop - 10, bx1 + 6, 12);
  for (let f = 0; f < 6; f++) {
    for (let c = 0; c < 3; c++) {
      const x = 14 + c * 62;
      const y = bTop + 30 + f * 70;
      const isLit = r() < 0.3;
      ctx.fillStyle = isLit ? "#ffd9a0" : "#5d6984";
      ctx.fillRect(x, y, 40, 34);
      ctx.fillStyle = "rgba(246,247,250,0.9)";
      ctx.fillRect(x + 19, y, 2, 34);
      if (isLit) lit.push({ x, y, w: 40, h: 34 });
    }
  }
  // red cross sign
  ctx.fillStyle = "#f4f6f9";
  ctx.fillRect(bx1 - 60, bTop + 40, 46, 46);
  ctx.fillStyle = "#e53935";
  ctx.fillRect(bx1 - 46, bTop + 46, 18, 34);
  ctx.fillRect(bx1 - 54, bTop + 54, 34, 18);

  // ---- tall cypress / cemara trees
  const cypress = (x: number, h: number, w: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, base - h);
    ctx.quadraticCurveTo(x + w, base - h * 0.55, x + w * 0.55, base - 40);
    ctx.lineTo(x - w * 0.55, base - 40);
    ctx.quadraticCurveTo(x - w, base - h * 0.55, x, base - h);
    ctx.fill();
    // foliage texture
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let y = base - h + 40; y < base - 60; y += 34) {
      ctx.beginPath();
      ctx.ellipse(x + (r() - 0.5) * w * 0.6, y, w * 0.35, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#4a3a2e";
    ctx.fillRect(x - 4, base - 44, 8, 44);
  };
  cypress(150, 640, 44, "#24503a");
  cypress(250, 560, 38, "#2a5a40");
  cypress(520, 600, 40, "#24503a");
  cypress(600, 660, 46, "#1f4733");

  // ---- slender shade tree in the middle (umbrella crown)
  const shade = (x: number, h: number, s: number): void => {
    ctx.strokeStyle = "#5b4a3a";
    ctx.lineWidth = 7 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x - 10 * s, base - h * 0.5, x + 6 * s, base - h);
    ctx.stroke();
    ctx.lineWidth = 3 * s;
    for (const [dx, dy] of [[-60, -30], [55, -40], [-30, -70], [35, -80]]) {
      ctx.beginPath();
      ctx.moveTo(x + 6 * s, base - h + 20);
      ctx.lineTo(x + dx * s, base - h + dy * s);
      ctx.stroke();
    }
    for (const [dx, dy, rr] of [[-60, -40, 40], [55, -50, 44], [0, -90, 50], [-30, -80, 36], [40, -96, 34]]) {
      blob(x + dx * s, base - h + dy * s, rr * s, "#3c7a4c");
    }
    ctx.fillStyle = "rgba(170,220,150,0.22)";
    blob(x - 20 * s, base - h - 100 * s, 22 * s, "rgba(170,220,150,0.22)");
  };
  shade(360, 340, 1.0);
  shade(80, 280, 0.8);

  // ---- pendopo on the right
  const px0 = 430;
  const px1 = 720;
  const roofBase = base - 210;
  // platform + shadowed interior
  ctx.fillStyle = "#3a4048";
  ctx.fillRect(px0 + 20, roofBase, px1 - px0 - 40, 150);
  ctx.fillStyle = "#d9d4c8";
  ctx.fillRect(px0 + 6, base - 64, px1 - px0 - 12, 18);
  // white pillars
  ctx.fillStyle = "#f2f0ea";
  for (let x = px0 + 26; x < px1 - 10; x += 64) ctx.fillRect(x, roofBase, 14, 150);
  // tiered red roof (joglo-ish hip)
  const roof = (y0: number, y1: number, inset: number, top: number): void => {
    const g = ctx.createLinearGradient(0, y1, 0, y0);
    g.addColorStop(0, "#8a2f2a");
    g.addColorStop(1, "#b5473a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(px0 - 14 + inset, y0);
    ctx.lineTo(px1 + 14 - inset, y0);
    ctx.lineTo(px1 - top, y1);
    ctx.lineTo(px0 + top, y1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let y = y1 + 8; y < y0; y += 8) {
      ctx.beginPath();
      ctx.moveTo(px0, y);
      ctx.lineTo(px1, y);
      ctx.stroke();
    }
  };
  roof(roofBase, roofBase - 46, 0, 50);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, GAME_WIDTH, roofBase - 46);
  ctx.clip();
  roof(roofBase - 40, roofBase - 100, 60, 110);
  ctx.restore();
  ctx.fillStyle = "#5e1f1c";
  ctx.fillRect(px0 + 46, roofBase - 47, px1 - px0 - 92, 5);
  ctx.fillStyle = "#f2f0ea";
  ctx.fillRect(px0 - 16, roofBase - 2, px1 - px0 + 32, 6);
  // hanging red lanterns
  for (const x of [px0 + 60, px0 + 150, px0 + 240]) {
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, roofBase + 4);
    ctx.lineTo(x, roofBase + 22);
    ctx.stroke();
    ctx.fillStyle = "#d8322c";
    ctx.beginPath();
    ctx.ellipse(x, roofBase + 34, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    lanterns.push([x, roofBase + 34]);
  }
  // hedges & flowering shrubs in front of the pendopo
  for (let x = px0; x < px1 + 20; x += 30) blob(x, base - 50, 24, "#2d5a3a");
  for (const x of [px0 + 40, px0 + 200]) blob(x, base - 58, 14, "#9a3f6a");
  // blue / red bins
  ctx.fillStyle = "#3d8fd6";
  ctx.fillRect(670, base - 104, 22, 40);
  ctx.fillStyle = "#d84a3a";
  ctx.fillRect(694, base - 104, 22, 40);

  // ---- lawn strip
  const lawn = ctx.createLinearGradient(0, base - 70, 0, base);
  lawn.addColorStop(0, "#4f8a4a");
  lawn.addColorStop(1, "#3c7240");
  ctx.fillStyle = lawn;
  ctx.fillRect(0, base - 46, GAME_WIDTH, 46);
  // log planter with greens (front left)
  ctx.fillStyle = "#4a3426";
  ctx.beginPath();
  ctx.roundRect(10, base - 64, 180, 30, 10);
  ctx.fill();
  ctx.fillStyle = "#3a281e";
  ctx.fillRect(36, base - 36, 16, 36);
  ctx.fillRect(150, base - 36, 16, 36);
  for (let x = 26; x < 180; x += 22) blob(x, base - 68 - r() * 8, 12 + r() * 6, "#6aa456");
  // river stones on the right
  for (let i = 0; i < 12; i++) {
    const x = 470 + i * 22 + r() * 8;
    ctx.fillStyle = r() < 0.5 ? "#3a3f46" : "#2c3036";
    ctx.beginPath();
    ctx.ellipse(x, base - 14, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- rainy late-afternoon shade, then relight rooms and lanterns
  if (darkness > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(24,26,46,${darkness})`;
    ctx.fillRect(0, 0, GAME_WIDTH, horizon);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,214,150,0.7)";
  for (const w of lit) ctx.fillRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
  for (const [x, y] of lanterns) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, 30);
    g.addColorStop(0, "rgba(255,140,110,0.9)");
    g.addColorStop(0.35, "rgba(255,80,60,0.35)");
    g.addColorStop(1, "rgba(255,80,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, y - 30, 60, 60);
  }
  // ---- "RSUD SIDOARJO" letter monument (Bebas Neue, like the real one):
  // four tall, separate charcoal-concrete RSUD letters, with cream SIDOARJO
  // letters standing in front in pairs (SI·DO·AR·JO), one pair per RSUD
  // letter, across their lower middle. A low shrub row hides only the feet.
  // Drawn after the shade pass so it stays legible.
  {
    const cx = GAME_WIDTH / 2;
    const foot = base - 22;
    const H = 134; // RSUD cap height
    const step = 90; // centre distance between RSUD letters
    const depth = 5;
    const letter = (ch: string, x: number, y: number, size: number, sx: number, face: string, side: string): void => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, 1);
      ctx.font = `400 ${size}px ${FONT_MONUMENT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = side;
      for (let d = depth; d > 0; d--) ctx.fillText(ch, d / sx, -d * 0.35);
      ctx.fillStyle = face;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    };
    const big = Math.round(H / 0.7);
    const rsud = ["R", "S", "U", "D"];
    const centers = rsud.map((_, i) => cx + (i - 1.5) * step);
    rsud.forEach((ch, i) => letter(ch, centers[i], foot, big, 1.12, "#596069", "#2b2f34"));

    const sH = H * 0.43;
    const small = Math.round(sH / 0.7);
    const sy = foot - H * 0.18;
    const pairs = [["S", "I"], ["D", "O"], ["A", "R"], ["J", "O"]];
    pairs.forEach(([a, b], i) => {
      const c = centers[i];
      letter(a, c - 19, sy, small, 1.08, "#f3eee1", "#9a9588");
      letter(b, c + 21, sy, small, 1.08, "#f3eee1", "#9a9588");
    });

    // shrubs in front, covering only the base of the letters
    const sr = rng(77);
    for (let x = cx - 2 * step - 20; x < cx + 2 * step + 30; x += 22) {
      const rr = 12 + sr() * 8;
      blob(x, base - 8 - sr() * 5, rr, "#203a2a");
      blob(x - 4, base - 12 - sr() * 5, rr * 0.55, "#2a4a34");
    }
    for (const x of [cx - 120, cx + 30, cx + 150]) blob(x, base - 18, 8, "#6a2f4c");
  }

  const mist = ctx.createLinearGradient(0, base - 200, 0, base);
  mist.addColorStop(0, "rgba(190,196,214,0)");
  mist.addColorStop(1, "rgba(190,196,214,0.2)");
  ctx.fillStyle = mist;
  ctx.fillRect(0, base - 200, GAME_WIDTH, 200);

  tex.refresh();
  scene.registry.set(winKey, lit);
  return { key, windows: lit };
}

export function addBackdrop(scene: Phaser.Scene, opts: BackdropOpts = {}): void {
  const horizon = opts.horizon ?? 1020;
  const variant = pickVariant(scene, opts.variant);
  const skyKey = makeSky(scene, variant);
  const cloudKey = makeCloud(scene, variant);
  makeRipple(scene);

  scene.add.image(0, 0, skyKey).setOrigin(0).setDepth(-10);

  // drifting clouds
  const r = rng(Math.floor(Math.random() * 1000) + 1);
  for (let i = 0; i < 5; i++) {
    const y = 90 + i * 70 + r() * 40;
    const scale = 0.8 + r() * 0.9;
    const c = scene.add
      .image(r() * GAME_WIDTH, y, cloudKey)
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
  if (variant === "morning" || variant === "garden") {
    // daylight haze washes out the distant city
    scene.add.rectangle(GAME_WIDTH / 2, horizon / 2, GAME_WIDTH, horizon, 0x5a6682, 0.55).setDepth(-7.9);
  }
  let near: { key: string; windows: Win[] };
  let offColor: number = PALETTE.skyline.near;
  if (variant === "garden") {
    const m = makeGarden(scene, horizon);
    near = m;
    offColor = 0x3a4560;
    scene.add.image(0, 0, m.key).setOrigin(0).setDepth(-7);
  } else if (variant === "morning") {
    const m = makeMainBuilding(scene, horizon);
    near = m;
    offColor = 0x3a4560;
    scene.add.image(0, 0, m.key).setOrigin(0).setDepth(-7);
  } else if (variant === "hospital") {
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
      // small and dim: a hint of the siren, not a distraction
      bar.fillStyle(0xff3030, 0.15).fillCircle(red.x, red.y, 14);
      bar.fillStyle(0xff5050, 0.65).fillCircle(red.x, red.y, 3.8);
      bar.fillStyle(0x3a7bff, 0.13).fillCircle(blue.x, blue.y, 14);
      bar.fillStyle(0x5a95ff, 0.38).fillCircle(blue.x, blue.y, 3.3);
      phase++;
    };
    drawBar();
    scene.time.addEvent({ delay: 480, loop: true, callback: drawBar });
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
