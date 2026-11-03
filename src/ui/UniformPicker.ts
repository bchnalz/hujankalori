import Phaser from "phaser";
import { CharacterArt } from "../objects/CharacterArt";
import { ensureCharacter, UNIFORMS, UNIFORM_LABEL, type Uniform } from "../objects/CharacterSprite";
import type { GameUser } from "../data/types";
import { getUniform } from "../data/prefs";
import { makeBackdropThumb, resolveBackdrop } from "./Backdrop";
import { openCarouselPicker } from "./CarouselPicker";

/** "Pilih Seragam": carousel of the staff uniforms on the chosen character. */

const DESC: Record<Uniform, string> = {
  umum: "Atasan coklat muda, bawahan coklat tua",
  dokter: "Jas putih dengan stetoskop, bawahan abu-abu",
  ok: "Scrub hijau lengkap dengan penutup kepala dan masker",
  penunjang: "Biru navy dengan lis merah di lengan",
  batik: "Batik hitam bermotif virus corona",
  korpri: "Batik Korpri biru dengan pin Korpri emas",
};

export function openUniformPicker(scene: Phaser.Scene, onPick: (u: Uniform) => void): void {
  const user = scene.registry.get("user") as GameUser;
  const variant = (scene.registry.get("__bd_variant") as ReturnType<typeof resolveBackdrop> | undefined) ?? resolveBackdrop(scene);
  openCarouselPicker(scene, {
    title: "PILIH SERAGAM",
    currentId: getUniform(),
    onPick: (id) => onPick(id as Uniform),
    items: UNIFORMS.map((u) => ({
      id: u,
      label: UNIFORM_LABEL[u],
      desc: DESC[u],
      drawThumb: (sc, area, w, h) => {
        area.add(sc.add.image(0, 0, makeBackdropThumb(sc, variant, w, h)).setAlpha(0.55));
        const glow = sc.add.ellipse(0, h / 2 - 40, 260, 40, 0x000000, 0.35);
        const art = new CharacterArt(sc, 0, h / 2 - 36, ensureCharacter(sc, user.gender, u), 330);
        art.setExpression("happy");
        area.add([glow, art]);
      },
    })),
  });
}
