import type { DataProvider } from "./DataProvider";
import type { GameUser, Gender } from "./types";

const DUMMY_NAMES = ["Pemain Demo", "Budi", "Sari", "Andi", "Rina"];

/**
 * Local stand-in for real LAPER/Supabase data so the game can be played and
 * reviewed before backend integration. Returns a random username + gender.
 */
export class DummyDataProvider implements DataProvider {
  async getUser(): Promise<GameUser> {
    const genders: Gender[] = ["male", "female"];
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const username = DUMMY_NAMES[Math.floor(Math.random() * DUMMY_NAMES.length)];
    return { id: "dummy-001", username, gender };
  }
}
