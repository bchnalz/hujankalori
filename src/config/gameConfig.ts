export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const gameConfig = {
  maxHp: 2000,
  startHp: 2000,

  allowOverheal: false,

  passiveHpDrainPerSec: 0,

  starvation: {
    enabled: true,
    warnSeconds: 2,
    tiers: [
      { untilSeconds: 30, window: 12 },
      { untilSeconds: 45, window: 10 },
      { untilSeconds: 60, window: 8 },
      { untilSeconds: 70, window: 6 },
    ],
    minWindow: 5,
  },

  intro: {
    countMs: 3000,
    goMs: 600,
  },

  player: {
    width: 128,
    height: 128,
    y: GAME_HEIGHT - 330,
    followLerp: 0.4,
    bodyWidth: 86,
    bodyHeight: 64,
    bodyOffsetY: 36,
  },

  footer: {
    top: GAME_HEIGHT - 260,
    popupY: GAME_HEIGHT - 195,
  },

  item: {
    size: 96,
    bodyRadius: 40,
    cullMarginY: 120,
    sizeBonusByType: { food: 24 },

    floaty: {
      types: ["activity"],
      sizeBonus: 30,
      speedFactor: 0.45,
      swayAmplitude: 75,
      swayFrequency: 2.2,
      rotationSway: 0.18,
      bubble: {
        scale: 1.18,
        color: 0x9fd8ff,
        alpha: 0.25,
        strokeColor: 0xffffff,
        strokeAlpha: 0.55,
        strokeWidth: 4,
      },
    },
  },

  difficulty: {
    tauSeconds: 70,
    spawn: { baseIntervalMs: 950, minIntervalMs: 320 },
    fall: { baseSpeed: 180, maxSpeed: 760 },
    weights: {
      food: { base: 0.45, max: 0.74 },
      healthy: { base: 0.2, max: 0.15 },
      activity: { base: 0.18, max: 0.06 },
    },
  },
} as const;
