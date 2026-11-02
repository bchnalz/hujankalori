import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config/gameConfig";
import {
  BACKDROP_CHOICES,
  BACKDROP_LABEL,
  backdropForNow,
  FONT_DISPLAY,
  FONT_UI,
  type BackdropChoice,
  type BackdropVariant,
} from "../config/theme";
import { getBackdropChoice } from "../data/prefs";
import { Sfx } from "../audio/Sfx";
import { makeBackdropThumb } from "./Backdrop";
import { makeButton } from "./Button";

/**
 * "Pilih Lokasi Bermain" popup: a swipeable carousel of scenery cards
 * (Otomatis / IGD / GPT / Taman) with left/right arrows, page dots and a PILIH
 * button. Calls `onPick` with the chosen option, or nothing on close.
 */

const PANEL_X = 30;
const PANEL_Y = 170;
const PANEL_W = GAME_WIDTH - 60;
const PANEL_H = 960;
const CARD_W = 440;
const CARD_H = 560;
const THUMB_H = 430;
const CARD_Y = PANEL_Y + 140 + CARD_H / 2;
const SPACING = CARD_W + 50;
const DEPTH = 200;

const DESC: Record<BackdropChoice, string> = {
  auto: "Lokasi berganti mengikuti jam (WIB)",
  hospital: "Gedung IGD di malam hari",
  morning: "Gedung GPT di pagi mendung",
  garden: "Taman di tengah RSUD di sore hujan",
};

const SLOT_TEXT: Record<BackdropChoice, string> = {
  auto: "",
  hospital: "Otomatis: 18.00–05.00",
  morning: "Otomatis: 05.00–11.00",
  garden: "Otomatis: 11.00–18.00",
};

export function openLocationPicker(scene: Phaser.Scene, onPick: (c: BackdropChoice) => void): void {
  const current = getBackdropChoice();
  let index = Math.max(0, BACKDROP_CHOICES.indexOf(current));
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objs.push(o);
    return o;
  };

  // dim + input blocker
  const shade = keep(
    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x03050c, 0.72)
      .setDepth(DEPTH)
      .setInteractive()
      .setAlpha(0),
  );
  const root = keep(scene.add.container(0, 0).setDepth(DEPTH + 1).setAlpha(0));

  const bg = scene.add.graphics();
  bg.fillStyle(0x0b1020, 0.97).fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 30);
  bg.lineStyle(4, 0x2a3450, 1).strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 30);
  root.add(bg);
  root.add(
    scene.add
      .text(GAME_WIDTH / 2, PANEL_Y + 62, "PILIH LOKASI BERMAIN", {
        fontFamily: FONT_DISPLAY,
        fontSize: "44px",
        color: "#FFD54F",
        stroke: "#070b18",
        strokeThickness: 6,
      })
      .setOrigin(0.5),
  );

  // ---- carousel track (masked to the panel)
  const track = scene.add.container(0, 0);
  root.add(track);
  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  maskShape.fillStyle(0xffffff).fillRect(PANEL_X + 4, PANEL_Y + 100, PANEL_W - 8, CARD_H + 80);
  track.setMask(maskShape.createGeometryMask());

  const autoNow = backdropForNow() as Exclude<BackdropChoice, "auto">;
  const cards = BACKDROP_CHOICES.map((c, i) => {
    const card = scene.add.container(GAME_WIDTH / 2 + i * SPACING, CARD_Y);
    const box = scene.add.graphics();
    const thumbVariant: BackdropVariant = c === "auto" ? backdropForNow() : c;
    const thumb = scene.add.image(0, -CARD_H / 2 + 10 + THUMB_H / 2, makeBackdropThumb(scene, thumbVariant, CARD_W - 20, THUMB_H));
    const frame = scene.add.graphics();
    frame.lineStyle(3, 0x000000, 0.35).strokeRoundedRect(-CARD_W / 2 + 10, -CARD_H / 2 + 10, CARD_W - 20, THUMB_H, 16);
    const name = scene.add
      .text(0, CARD_H / 2 - 92, BACKDROP_LABEL[c], { fontFamily: FONT_DISPLAY, fontSize: "40px", color: "#ffffff" })
      .setOrigin(0.5);
    const desc = scene.add
      .text(0, CARD_H / 2 - 44, DESC[c], {
        fontFamily: FONT_UI,
        fontSize: "21px",
        color: "#c9d4ec",
        align: "center",
        wordWrap: { width: CARD_W - 40 },
      })
      .setOrigin(0.5);
    card.add([box, thumb, frame, name, desc]);
    // badge on the thumbnail
    const badgeText = c === "auto" ? `Sekarang: ${BACKDROP_LABEL[autoNow]}` : SLOT_TEXT[c];
    const badge = scene.add
      .text(-CARD_W / 2 + 26, -CARD_H / 2 + 26, badgeText, {
        fontFamily: FONT_UI,
        fontSize: "19px",
        fontStyle: "bold",
        color: "#0b1020",
        backgroundColor: c === "auto" ? "#7CFC8A" : "#FFD54F",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0, 0);
    card.add(badge);
    if (c === current) {
      const used = scene.add
        .text(CARD_W / 2 - 26, -CARD_H / 2 + 26, "Dipakai", {
          fontFamily: FONT_UI,
          fontSize: "19px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#2e7d32",
          padding: { x: 12, y: 6 },
        })
        .setOrigin(1, 0);
      card.add(used);
    }
    track.add(card);
    return { card, box, c };
  });

  const drawCards = (): void => {
    cards.forEach(({ box }, i) => {
      const on = i === index;
      box.clear();
      box.fillStyle(on ? 0x16243f : 0x111a30, 1).fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
      box.lineStyle(on ? 5 : 3, on ? 0x7cfc8a : 0x2a3450, 1).strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 24);
    });
  };

  // ---- dots
  const dots = BACKDROP_CHOICES.map((_, i) => {
    const d = scene.add.circle(GAME_WIDTH / 2 + (i - (BACKDROP_CHOICES.length - 1) / 2) * 34, CARD_Y + CARD_H / 2 + 40, 8, 0xffffff);
    root.add(d);
    return d;
  });

  let trackX = -index * SPACING;
  const layout = (x: number): void => {
    track.x = x;
    cards.forEach(({ card }) => {
      const off = Math.abs(card.x - GAME_WIDTH / 2 + x) / SPACING;
      const k = Phaser.Math.Clamp(off, 0, 1);
      card.setScale(1 - 0.12 * k);
      card.setAlpha(1 - 0.45 * k);
    });
  };
  const refresh = (): void => {
    drawCards();
    dots.forEach((d, i) => d.setFillStyle(i === index ? 0x7cfc8a : 0x3a4566, 1).setScale(i === index ? 1.25 : 1));
    arrowL.setAlpha(index > 0 ? 1 : 0.3);
    arrowR.setAlpha(index < cards.length - 1 ? 1 : 0.3);
  };
  const goToIndex = (i: number, sound = true): void => {
    const next = Phaser.Math.Clamp(i, 0, cards.length - 1);
    if (next === index) {
      if (sound) Sfx.bump();
      // little rubber-band nudge
      scene.tweens.addCounter({
        from: track.x,
        to: trackX,
        duration: 220,
        ease: "Back.easeOut",
        onUpdate: (tw) => layout(tw.getValue() ?? trackX),
      });
      return;
    }
    if (sound) Sfx.slide(next > index ? 1 : -1);
    index = next;
    trackX = -index * SPACING;
    refresh();
    scene.tweens.addCounter({
      from: track.x,
      to: trackX,
      duration: 300,
      ease: "Cubic.easeOut",
      onUpdate: (tw) => layout(tw.getValue() ?? trackX),
    });
  };

  // ---- arrows
  const arrow = (x: number, dir: -1 | 1): Phaser.GameObjects.Container => {
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.3).fillCircle(0, 5, 36);
    g.fillStyle(0x4656a0, 1).fillCircle(0, 0, 36);
    g.lineStyle(3, 0x6474c4, 1).strokeCircle(0, 0, 36);
    g.fillStyle(0xffffff, 1).fillTriangle(dir * 14, 0, -dir * 9, -15, -dir * 9, 15);
    const a = scene.add.container(x, CARD_Y - 60, [g]).setSize(84, 84).setInteractive({ useHandCursor: true });
    a.on("pointerdown", () => a.setScale(0.9));
    a.on("pointerout", () => a.setScale(1));
    a.on("pointerup", () => {
      a.setScale(1);
      goToIndex(index + dir);
    });
    root.add(a);
    return a;
  };
  const arrowL = arrow(PANEL_X + 44, -1);
  const arrowR = arrow(PANEL_X + PANEL_W - 44, 1);

  // ---- swipe on the card area
  const swipe = scene.add.zone(GAME_WIDTH / 2, CARD_Y, PANEL_W - 180, CARD_H).setInteractive();
  root.addAt(swipe, 1);
  let dragFrom: number | null = null;
  let moved = 0;
  swipe.on("pointerdown", (p: Phaser.Input.Pointer) => {
    dragFrom = p.x;
    moved = 0;
    scene.tweens.killTweensOf(track);
  });
  const onMove = (p: Phaser.Input.Pointer): void => {
    if (dragFrom === null || !p.isDown) return;
    moved = p.x - dragFrom;
    const edge = (index === 0 && moved > 0) || (index === cards.length - 1 && moved < 0);
    layout(trackX + (edge ? moved * 0.35 : moved));
  };
  const onUp = (): void => {
    if (dragFrom === null) return;
    dragFrom = null;
    if (moved < -70) goToIndex(index + 1);
    else if (moved > 70) goToIndex(index - 1);
    else if (Math.abs(moved) > 8) goToIndex(index, false);
    else {
      // tap on a side card jumps to it
      layout(trackX);
    }
  };
  scene.input.on("pointermove", onMove);
  scene.input.on("pointerup", onUp);

  // ---- buttons
  const close = (picked?: BackdropChoice): void => {
    scene.input.off("pointermove", onMove);
    scene.input.off("pointerup", onUp);
    Sfx.whoosh(true);
    scene.tweens.add({ targets: shade, alpha: 0, duration: 200 });
    scene.tweens.add({
      targets: root,
      alpha: 0,
      y: 40,
      duration: 200,
      ease: "Cubic.easeIn",
      onComplete: () => {
        objs.forEach((o) => o.destroy());
        maskShape.destroy();
        if (picked) onPick(picked);
      },
    });
  };
  const pick = makeButton(scene, GAME_WIDTH / 2, PANEL_Y + PANEL_H - 82, "PILIH", () => {
    Sfx.ding();
    close(BACKDROP_CHOICES[index]);
  }, { width: 360, height: 96 });
  root.add(pick);

  const x = scene.add.container(PANEL_X + PANEL_W - 44, PANEL_Y + 56).setSize(64, 64).setInteractive({ useHandCursor: true });
  const xg = scene.add.graphics();
  xg.fillStyle(0x1b2440, 1).fillCircle(0, 0, 28);
  xg.lineStyle(5, 0xc9d4ec, 1);
  xg.lineBetween(-10, -10, 10, 10).lineBetween(10, -10, -10, 10);
  x.add(xg);
  x.on("pointerup", () => {
    Sfx.click();
    close();
  });
  root.add(x);

  layout(trackX);
  refresh();

  // open animation
  Sfx.whoosh();
  root.y = 60;
  scene.tweens.add({ targets: shade, alpha: 1, duration: 220 });
  scene.tweens.add({ targets: root, alpha: 1, y: 0, duration: 320, ease: "Back.easeOut" });
}
