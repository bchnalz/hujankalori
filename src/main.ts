import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { SplashScene } from "./scenes/SplashScene";
import { MenuScene } from "./scenes/MenuScene";
import { HowToPlayScene } from "./scenes/HowToPlayScene";
import { GameScene } from "./scenes/GameScene";
import { GameOverScene } from "./scenes/GameOverScene";

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
  scene: [BootScene, SplashScene, MenuScene, HowToPlayScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);

// Dynamic-viewport handling: keep the canvas filling the *visible* area as the
// mobile browser address bar shows/hides (visualViewport), and re-fit on rotate.
const applyViewport = (): void => {
  const app = document.getElementById("app");
  const vv = window.visualViewport;
  if (app && vv) app.style.height = `${vv.height}px`;
  game.scale.refresh();
};
window.visualViewport?.addEventListener("resize", applyViewport);
window.visualViewport?.addEventListener("scroll", applyViewport);
window.addEventListener("orientationchange", () => window.setTimeout(applyViewport, 250));
applyViewport();
