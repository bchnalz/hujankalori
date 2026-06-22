import type { GameUser } from "./types";

/**
 * Abstraction over the source of player data.
 *
 * First pass uses {@link DummyDataProvider}. Once the LAPER integration
 * contract is available, a LaperDataProvider will implement this same
 * interface (identity from the signed iframe/URL token; game records from a
 * separate Supabase project). No gameplay code changes required.
 */
export interface DataProvider {
  getUser(): Promise<GameUser>;
}
