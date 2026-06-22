import type { Gender } from "../data/types";

export interface PlayerBaseDef {
  key: string;
  asset: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
}

export const PLAYER_BASES: Record<Gender, PlayerBaseDef> = {
  male: {
    key: "player_base_male",
    asset: "assets/player/base_male.png",
    frameWidth: 128,
    frameHeight: 128,
    frames: 4,
  },
  female: {
    key: "player_base_female",
    asset: "assets/player/base_female.png",
    frameWidth: 128,
    frameHeight: 128,
    frames: 4,
  },
};
