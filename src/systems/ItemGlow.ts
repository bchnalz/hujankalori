import Phaser from "phaser";
import type { ItemType } from "../config/itemConfig";

/**
 * Neon-emissive outline for falling items, colour-coded by item type so the
 * player can read good vs bad at a glance on the dark night backdrop:
 *   activity = green · healthy = gold · heavy food = red-orange
 *
 * Glow textures are "baked" once per item (canvas: solid silhouette → soft
 * blurred halo + crisp dilated rim), so during play it's just one extra image
 * per item — cheap on any phone and works without WebGL.
 */

interface GlowColors {
  rim: string;
  glow: string;
  spark: number[];
}

export const GLOW: Record<ItemType, GlowColors> = {
  activity: { rim: "#c4ffd2", glow: "#2bff74", spark: [0x7cfc8a, 0xc4ffd2, 0xffffff] },
  healthy: { rim: "#fff3b8", glow: "#ffc22e", spark: [0xffd54f, 0xfff3b8, 0xffffff] },
  food: { rim: "#ffc8b6", glow: "#ff4526", spark: [0xff6a45, 0xffb199, 0xffe0d6] },
};

/** Visual tuning ("outline tegas, pendaran tipis, denyut pelan"). */
export const GLOW_TUNING = {
  pad: 26,
  rimPx: 3,
  haloBlur: 16,
  haloAlpha: 0.85,
  pulseMin: 0.72,
  pulseMs: 760,
  trailAlpha: 0.2,
  sparkEveryMs: 85,
};

const SPARK_TEX = "__item_spark";

export function glowKeyFor(key: string): string {
  return `${key}__glow`;
}

/** Build (once) and return the glow texture key for an item texture. */
export function ensureGlowTexture(scene: Phaser.Scene, key: string, type: ItemType): string {
  const gk = glowKeyFor(key);
  if (scene.textures.exists(gk)) return gk;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const { pad, rimPx, haloBlur, haloAlpha } = GLOW_TUNING;
  const c = GLOW[type];

  // solid silhouette in the rim colour
  const sil = document.createElement("canvas");
  sil.width = w;
  sil.height = h;
  const s = sil.getContext("2d")!;
  s.drawImage(src, 0, 0);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = c.rim;
  s.fillRect(0, 0, w, h);

  const tex = scene.textures.createCanvas(gk, w + pad * 2, h + pad * 2)!;
  const ctx = tex.getContext();
  // soft halo
  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = haloBlur;
  ctx.globalAlpha = haloAlpha;
  ctx.drawImage(sil, pad, pad);
  ctx.drawImage(sil, pad, pad);
  ctx.restore();
  // crisp rim: silhouette dilated by a few px
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.drawImage(sil, pad + Math.cos(a) * rimPx, pad + Math.sin(a) * rimPx);
  }
  tex.refresh();
  return gk;
}

/** Faint light column trailing above a falling item. */
export function ensureTrailTexture(scene: Phaser.Scene, type: ItemType): string {
  const key = `__item_trail_${type}`;
  if (scene.textures.exists(key)) return key;
  const W = 44;
  const H = 150;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx = tex.getContext();
  const col = Phaser.Display.Color.HexStringToColor(GLOW[type].glow);
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, `rgba(${col.red},${col.green},${col.blue},0)`);
  v.addColorStop(1, `rgba(${col.red},${col.green},${col.blue},1)`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // soften the sides
  ctx.globalCompositeOperation = "destination-in";
  const hz = ctx.createLinearGradient(0, 0, W, 0);
  hz.addColorStop(0, "rgba(0,0,0,0)");
  hz.addColorStop(0.5, "rgba(0,0,0,1)");
  hz.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hz;
  ctx.fillRect(0, 0, W, H);
  tex.refresh();
  return key;
}

/** One pooled spark emitter per item type per scene. */
const emitters = new WeakMap<Phaser.Scene, Partial<Record<ItemType, Phaser.GameObjects.Particles.ParticleEmitter>>>();

export function sparkEmitter(scene: Phaser.Scene, type: ItemType): Phaser.GameObjects.Particles.ParticleEmitter {
  if (!scene.textures.exists(SPARK_TEX)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture(SPARK_TEX, 8, 8);
    g.destroy();
  }
  let byType = emitters.get(scene);
  if (!byType) {
    byType = {};
    emitters.set(scene, byType);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => emitters.delete(scene));
  }
  let e = byType[type];
  if (!e || !e.active) {
    e = scene.add
      .particles(0, 0, SPARK_TEX, {
        emitting: false,
        speed: { min: 8, max: 42 },
        angle: { min: 0, max: 360 },
        gravityY: -40, // drift up as the item falls past
        lifespan: { min: 380, max: 720 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: GLOW[type].spark,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(1.4);
    byType[type] = e;
  }
  return e;
}
