import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import { PALETTE } from "../config/theme";

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

function makeGround(scene: Phaser.Scene, horizon: number): string {
  const key = `__bd_ground_${horizon}`;
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
  const near = makeSkyline(scene, horizon, "near");
  scene.add.image(0, 0, near.key).setOrigin(0).setDepth(-7);

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
        flick.fillStyle(PALETTE.skyline.near, 0.9);
        for (const k of off) {
          const w = near.windows[k];
          flick.fillRect(w.x, w.y, w.w, w.h);
        }
      },
    });
  }

  if (opts.ground !== false) {
    const gKey = makeGround(scene, horizon);
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
