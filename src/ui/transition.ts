import Phaser from "phaser";

const FADE_MS = 220;
const busy = new WeakSet<Phaser.Scene>();

/** Fade the camera to night-blue, then start `key`. Ignores double taps. */
export function goTo(scene: Phaser.Scene, key: string, data?: object): void {
  if (busy.has(scene)) return;
  busy.add(scene);
  const cam = scene.cameras.main;
  cam.fadeOut(FADE_MS, 5, 8, 20);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    busy.delete(scene);
    scene.scene.start(key, data);
  });
}

/** Fade a scene in from night-blue (call at the top of create()). */
export function fadeInScene(scene: Phaser.Scene, ms = FADE_MS + 60): void {
  busy.delete(scene);
  scene.cameras.main.fadeIn(ms, 5, 8, 20);
}
