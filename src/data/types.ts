export type Gender = "male" | "female";

export interface GameUser {
  id: string;
  username: string;
  gender: Gender;
}

export interface SessionResult {
  survivalSeconds: number;
  reason?: "hp" | "starve";
  /** Server run-session id (null when offline). */
  sid?: Promise<string | null>;
  /** item key -> times caught this run (for the share card). */
  caught?: Record<string, number>;
}
