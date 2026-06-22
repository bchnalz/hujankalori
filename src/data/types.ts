export type Gender = "male" | "female";

export interface GameUser {
  id: string;
  username: string;
  gender: Gender;
}

export interface SessionResult {
  survivalSeconds: number;
  reason?: "hp" | "starve";
}
