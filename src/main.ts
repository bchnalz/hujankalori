import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { StartScene } from "./scenes/StartScene";
import { SplashScene } from "./scenes/SplashScene";
import { MenuScene } from "./scenes/MenuScene";
import { TutorialScene } from "./scenes/TutorialScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";
import { Sfx } from "./audio/Sfx";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0b1020",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, StartScene, SplashScene, MenuScene, TutorialScene, GameScene, GameOverScene, LeaderboardScene],
};

const game = new Phaser.Game(config);
if (import.meta.env.DEV) (window as unknown as { __hk: Phaser.Game }).__hk = game;

// Unlock Web Audio directly inside native gesture events (iOS needs the
// AudioContext to be resumed synchronously in a real touch/click handler).
const unlockAudio = (): void => Sfx.unlock();
for (const ev of ["pointerup", "touchend", "click", "keydown"]) {
  document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
}

// Viewport handling for mobile browsers.
// #app is position:fixed + inset:0 (see index.html), so it always matches the
// *layout* viewport. That follows the address bar collapsing/expanding, but —
// unlike visualViewport — it does not shrink when iOS Safari opens its
// keyboard/URL editor. We used to size the game to visualViewport.height, so
// tapping the address bar on an iPhone shrank the game and Safari didn't always
// report the size coming back. Now we only re-fit and undo any page scroll.
let fitTimer = 0;
const refit = (): void => {
  window.clearTimeout(fitTimer);
  fitTimer = window.setTimeout(() => {
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    game.scale.refresh();
  }, 120);
};
window.addEventListener("resize", refit);
window.addEventListener("orientationchange", () => {
  refit();
  window.setTimeout(refit, 500); // iOS reports the final size late after rotating
});
window.visualViewport?.addEventListener("resize", refit);
window.addEventListener("pageshow", refit);
window.addEventListener("focus", refit);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refit();
});
refit();
