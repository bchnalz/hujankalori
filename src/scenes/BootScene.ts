import Phaser from "phaser";
import { DummyDataProvider } from "../data/DummyDataProvider";
import { isEmbedded, parseUserFromToken, readLaperToken } from "../data/laperBridge";
import type { GameUser } from "../data/types";
import { getSavedGender } from "../data/prefs";

/**
 * Resolves the player identity up front, then hands off to Preload.
 * Tries the LAPER token (iframe/URL); falls back to dummy data for now.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  async create(): Promise<void> {
    let user: GameUser | null = null;

    const token = readLaperToken();
    if (token) {
      user = parseUserFromToken(token);
    }
    if (!user) {
      user = await new DummyDataProvider().getUser();
    }

    const saved = getSavedGender();
    if (saved) user = { ...user, gender: saved };

    this.registry.set("user", user);
    this.registry.set("embedded", isEmbedded());
    this.scene.start("Start");
  }
}
