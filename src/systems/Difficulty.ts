import { gameConfig } from "../config/gameConfig";

const cfg = gameConfig.difficulty;

/**
 * Smooth 0 -> 1 difficulty progression based on elapsed survival time.
 * Asymptotic curve (no abrupt jumps) per GAME-02.
 */
export function ramp(tSeconds: number): number {
  return 1 - Math.exp(-Math.max(0, tSeconds) / cfg.tauSeconds);
}

function lerp(a: number, b: number, r: number): number {
  return a + (b - a) * r;
}

export function spawnIntervalMs(tSeconds: number): number {
  return lerp(cfg.spawn.baseIntervalMs, cfg.spawn.minIntervalMs, ramp(tSeconds));
}

export function fallSpeed(tSeconds: number): number {
  return lerp(cfg.fall.baseSpeed, cfg.fall.maxSpeed, ramp(tSeconds));
}

export interface TypeWeights {
  food: number;
  healthy: number;
  activity: number;
}

export function typeWeights(tSeconds: number): TypeWeights {
  const r = ramp(tSeconds);
  return {
    food: lerp(cfg.weights.food.base, cfg.weights.food.max, r),
    healthy: lerp(cfg.weights.healthy.base, cfg.weights.healthy.max, r),
    activity: lerp(cfg.weights.activity.base, cfg.weights.activity.max, r),
  };
}

/**
 * Starvation eat-window (seconds) for the current survival time. Longer early
 * (so slow-falling food can arrive), tighter as you survive. First matching
 * tier wins; falls back to minWindow past the last tier.
 */
export function starveWindow(tSeconds: number): number {
  for (const tier of gameConfig.starvation.tiers) {
    if (tSeconds <= tier.untilSeconds) return tier.window;
  }
  return gameConfig.starvation.minWindow;
}
