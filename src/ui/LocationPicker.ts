import Phaser from "phaser";
import { BACKDROP_CHOICES, BACKDROP_LABEL, backdropForNow, type BackdropChoice, type BackdropVariant } from "../config/theme";
import { getBackdropChoice } from "../data/prefs";
import { makeBackdropThumb } from "./Backdrop";
import { openCarouselPicker } from "./CarouselPicker";

/** "Pilih Lokasi Bermain": carousel of Otomatis / IGD / GPT / Taman. */

const DESC: Record<BackdropChoice, string> = {
  auto: "Lokasi berganti mengikuti jam (WIB)",
  hospital: "Gedung IGD di malam hari",
  morning: "Gedung GPT di pagi mendung",
  garden: "Taman tengah RSUD saat sore hujan",
};

const SLOT_TEXT: Record<BackdropChoice, string> = {
  auto: "",
  hospital: "Otomatis: 18.00–05.00",
  morning: "Otomatis: 05.00–11.00",
  garden: "Otomatis: 11.00–18.00",
};

export function openLocationPicker(scene: Phaser.Scene, onPick: (c: BackdropChoice) => void): void {
  const autoNow = backdropForNow() as Exclude<BackdropChoice, "auto">;
  openCarouselPicker(scene, {
    title: "PILIH LOKASI BERMAIN",
    currentId: getBackdropChoice(),
    onPick: (id) => onPick(id as BackdropChoice),
    items: BACKDROP_CHOICES.map((c) => ({
      id: c,
      label: BACKDROP_LABEL[c],
      desc: DESC[c],
      badge: c === "auto" ? `Sekarang: ${BACKDROP_LABEL[autoNow]}` : SLOT_TEXT[c],
      badgeColor: c === "auto" ? "#7CFC8A" : "#FFD54F",
      drawThumb: (sc, area, w, h) => {
        const v: BackdropVariant = c === "auto" ? backdropForNow() : c;
        area.add(sc.add.image(0, 0, makeBackdropThumb(sc, v, w, h)));
      },
    })),
  });
}
