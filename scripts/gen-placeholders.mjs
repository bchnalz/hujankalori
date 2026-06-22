// Generates placeholder PNG assets for Calorie Catcher using only Node built-ins.
// Run: npm run assets  (also runs automatically before dev/build)
//
// These are throwaway placeholders. Designers replace them by dropping real
// PNGs into the same paths (see docs/asset-config-spec.md) and, for new items,
// registering them in src/config/itemConfig.ts.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Non-destructive by default: only writes a placeholder when the file is
// missing, so real artwork dropped in by designers is never overwritten.
// Pass --force to regenerate everything (e.g. `npm run assets:force`).
const FORCE = process.argv.includes("--force");

// ---------- PNG encoder ----------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- tiny drawing canvas ----------
class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a = 255] = c;
    const i = (y * this.w + x) * 4;
    const sa = a / 255;
    const ia = 1 - sa;
    this.buf[i] = Math.round(r * sa + this.buf[i] * ia);
    this.buf[i + 1] = Math.round(g * sa + this.buf[i + 1] * ia);
    this.buf[i + 2] = Math.round(b * sa + this.buf[i + 2] * ia);
    this.buf[i + 3] = Math.min(255, Math.round(a + this.buf[i + 3] * ia));
  }
  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  circle(cx, cy, r, c) {
    for (let yy = cy - r; yy <= cy + r; yy++)
      for (let xx = cx - r; xx <= cx + r; xx++) {
        const dx = xx - cx;
        const dy = yy - cy;
        if (dx * dx + dy * dy <= r * r) this.set(xx, yy, c);
      }
  }
  ring(cx, cy, r, thick, c) {
    for (let yy = cy - r; yy <= cy + r; yy++)
      for (let xx = cx - r; xx <= cx + r; xx++) {
        const d = Math.sqrt((xx - cx) ** 2 + (yy - cy) ** 2);
        if (d <= r && d >= r - thick) this.set(xx, yy, c);
      }
  }
  roundRect(x, y, w, h, r, c) {
    this.rect(x + r, y, w - 2 * r, h, c);
    this.rect(x, y + r, w, h - 2 * r, c);
    this.circle(x + r, y + r, r, c);
    this.circle(x + w - r - 1, y + r, r, c);
    this.circle(x + r, y + h - r - 1, r, c);
    this.circle(x + w - r - 1, y + h - r - 1, r, c);
  }
  triangleDown(cx, topY, halfTop, height, c) {
    for (let i = 0; i <= height; i++) {
      const half = halfTop * (1 - i / height);
      this.rect(cx - half, topY + i, half * 2, 1, c);
    }
  }
  png() {
    return encodePng(this.w, this.h, this.buf);
  }
}

function lerpC(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];
}
function save(relPath, canvas) {
  const full = join("public", "assets", relPath);
  if (!FORCE && existsSync(full)) {
    console.log("skip (exists)", full);
    return;
  }
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, canvas.png());
  console.log("wrote", full);
}

// ---------- item badges ----------
const RING = { food: [229, 57, 53], healthy: [67, 160, 71], activity: [30, 136, 229] };
const ITEMS = [
  ["items/food/bakso.png", "food", [180, 90, 70]],
  ["items/food/seblak.png", "food", [200, 60, 50]],
  ["items/food/mie_goreng.png", "food", [210, 170, 70]],
  ["items/food/nasi_padang.png", "food", [200, 150, 60]],
  ["items/food/donat.png", "food", [235, 120, 170]],
  ["items/food/es_teh.png", "food", [150, 100, 50]],
  ["items/healthy/pisang.png", "healthy", [240, 215, 90]],
  ["items/healthy/alpukat.png", "healthy", [110, 150, 60]],
  ["items/healthy/brokoli_rebus.png", "healthy", [60, 160, 70]],
  ["items/healthy/apel.png", "healthy", [220, 60, 60]],
  ["items/healthy/telur_rebus.png", "healthy", [240, 235, 210]],
  ["items/healthy/wortel.png", "healthy", [240, 140, 40]],
  ["items/healthy/air_mineral.png", "healthy", [120, 190, 235]],
  ["items/activity/jogging_5.png", "activity", [60, 150, 230]],
  ["items/activity/jogging_30.png", "activity", [40, 110, 210]],
  ["items/activity/angkat_beban_15.png", "activity", [95, 105, 125]],
  ["items/activity/yoga_30.png", "activity", [120, 90, 210]],
  ["items/activity/bersepeda_15.png", "activity", [50, 190, 200]],
  ["items/activity/bersepeda_45.png", "activity", [30, 150, 170]],
];
for (const [path, cat, color] of ITEMS) {
  const c = new Canvas(96, 96);
  c.circle(48, 48, 44, [...RING[cat], 255]);
  c.circle(48, 48, 37, [255, 255, 255, 255]);
  c.circle(48, 48, 33, [...color, 255]);
  c.circle(38, 38, 8, [255, 255, 255, 150]);
  save(path, c);
}

// ---------- player sprite sheets ----------
function drawCharacter(c, ox, opts) {
  const cx = ox + 64;
  const bob = [0, -3, 0, 3][opts.frame];
  const skin = [242, 205, 175, 255];
  const pants = [45, 45, 70, 255];
  const shirt = opts.shirt;
  const hair = opts.hair;
  // legs
  c.roundRect(cx - 20, 96, 16, 28, 5, pants);
  c.roundRect(cx + 4, 96, 16, 28, 5, pants);
  // body
  c.roundRect(cx - 26, 54 + bob, 52, 46, 12, shirt);
  // arms
  c.roundRect(cx - 36, 58 + bob, 12, 36, 6, shirt);
  c.roundRect(cx + 24, 58 + bob, 12, 36, 6, shirt);
  c.circle(cx - 30, 94 + bob, 7, skin);
  c.circle(cx + 30, 94 + bob, 7, skin);
  // head + hair
  c.circle(cx, 36 + bob, 20, skin);
  if (opts.long) {
    c.roundRect(cx - 24, 18 + bob, 48, 18, 8, hair);
    c.rect(cx - 24, 30 + bob, 8, 26, hair);
    c.rect(cx + 16, 30 + bob, 8, 26, hair);
  } else {
    c.roundRect(cx - 22, 16 + bob, 44, 16, 8, hair);
  }
}
function buildSheet(opts) {
  const c = new Canvas(512, 128);
  for (let f = 0; f < 4; f++) drawCharacter(c, f * 128, { ...opts, frame: f });
  return c;
}
save("player/base_male.png", buildSheet({ shirt: [40, 95, 205, 255], hair: [40, 30, 20, 255], long: false }));
save("player/base_female.png", buildSheet({ shirt: [220, 80, 150, 255], hair: [70, 45, 30, 255], long: true }));

// ---------- background ----------
{
  const c = new Canvas(720, 1280);
  const top = [26, 34, 78];
  const bottom = [78, 110, 175];
  for (let y = 0; y < 1280; y++) c.rect(0, y, 720, 1, lerpC(top, bottom, y / 1280));
  // simple ground band
  c.rect(0, 1180, 720, 100, [54, 120, 74, 255]);
  save("background/bg.png", c);
}

// ---------- ui icons ----------
{
  const token = new Canvas(64, 64);
  token.circle(32, 32, 28, [244, 196, 48, 255]);
  token.ring(32, 32, 28, 4, [200, 150, 20, 255]);
  save("ui/token.png", token);

  const point = new Canvas(64, 64);
  point.circle(32, 32, 28, [142, 91, 255, 255]);
  point.circle(32, 32, 10, [255, 255, 255, 220]);
  save("ui/point.png", point);

  const heart = new Canvas(64, 64);
  const red = [229, 57, 53, 255];
  heart.circle(23, 26, 13, red);
  heart.circle(41, 26, 13, red);
  heart.triangleDown(32, 30, 22, 28, red);
  save("ui/heart.png", heart);
}

console.log("Placeholder assets generated.");
