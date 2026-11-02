import type { Gender } from "./types";
import { BACKDROP_CHOICES, type BackdropChoice } from "../config/theme";

/** Small per-device preferences kept in localStorage (safe if unavailable). */

const GENDER_KEY = "hk_gender";
const TUTORIAL_KEY = "hk_tutorial_done";
const BACKDROP_KEY = "hk_backdrop";

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export function getSavedGender(): Gender | null {
  const v = get(GENDER_KEY);
  return v === "male" || v === "female" ? v : null;
}

export function saveGender(g: Gender): void {
  set(GENDER_KEY, g);
}

export function isTutorialDone(): boolean {
  return get(TUTORIAL_KEY) === "1";
}

export function markTutorialDone(): void {
  set(TUTORIAL_KEY, "1");
}

export function getBackdropChoice(): BackdropChoice {
  const v = get(BACKDROP_KEY) as BackdropChoice | null;
  return v && BACKDROP_CHOICES.includes(v) ? v : "auto";
}

export function saveBackdropChoice(c: BackdropChoice): void {
  set(BACKDROP_KEY, c);
}
