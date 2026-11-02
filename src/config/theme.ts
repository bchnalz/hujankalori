/**
 * Visual theme: one palette and two typefaces shared by every scene.
 * Fonts are self-hosted (@fontsource, bundled by Vite) so the game looks the
 * same on every phone instead of falling back to each OS's system font.
 */
import "@fontsource/lilita-one/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";

/** Chunky display face — matches the logo and the promo flyer. */
export const FONT_DISPLAY = '"Lilita One", "Plus Jakarta Sans", system-ui, sans-serif';
/** Everyday UI text. */
export const FONT_UI = '"Plus Jakarta Sans", system-ui, sans-serif';

export type BackdropVariant = "city" | "hospital";
/** Scenery behind every screen: a generic rainy city, or the RSUD IGD building. */
export const BACKDROP: BackdropVariant = "hospital";

export const PALETTE = {
  night: { top: 0x070b18, mid: 0x111a38, bottom: 0x24365f },
  skyline: { far: 0x1a2546, near: 0x10172e, window: 0xffd27a, windowCool: 0x9fd8ff },
  ground: { top: 0x1a2340, bottom: 0x0b1020, puddle: 0x2c3c66, shine: 0x9fb8e8 },
  primary: { base: 0x4caf50, light: 0x7cfc8a, dark: 0x2e7d32 },
  secondary: { base: 0x4656a0, light: 0x6474c4, dark: 0x2c3770 },
  danger: { base: 0xe53935, light: 0xff6b6b, dark: 0xa32622 },
  gold: { base: 0xffd54f, dark: 0xc79a1e },
  panel: 0x0b1020,
  panelLine: 0x2a3450,
  text: "#ffffff",
  textMuted: "#9fb0d0",
  stroke: "#0b1020",
} as const;

/** Resolve once the bundled fonts are ready (Phaser text is rasterised on creation). */
export async function loadFonts(): Promise<void> {
  if (!("fonts" in document)) return;
  const wanted = [
    `400 48px "Lilita One"`,
    `500 24px "Plus Jakarta Sans"`,
    `700 24px "Plus Jakarta Sans"`,
    `800 24px "Plus Jakarta Sans"`,
  ];
  try {
    await Promise.race([
      Promise.all(wanted.map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2500)), // never block the game on a slow network
    ]);
  } catch {
    /* fall back to system fonts */
  }
}
