import type { EncounterExitStrategy } from "../model/types";

export const FRAME_RATE = 59.7275;
export const ONE_FRAME_MS = 1000 / FRAME_RATE;
export const DSUM_RANGE = 256;

export const OVERWORLD_CYCLE_FRAMES = 373.4160401;
export const IN_BATTLE_CYCLE_FRAMES = 791.5555556;

export const HORIZONTAL_BLINDS_FRAMES = 70;
export const VERTICAL_BLINDS_FRAMES = 64;
export const SPLIT_SPIRAL_FRAMES = 110;
export const FULL_SPIRAL_FRAMES = 142;
export const BATTLE_ENTRY_OVERWORLD_FRAMES = 8;

export const EXIT_FRAMES: Record<EncounterExitStrategy, number> = {
  PLAYER_GOT_AWAY: 37,
  POKEMON_RAN: 77,
  POKEMON_SENT_TO_BOX: 22,
  POKEMON_JOINED_PARTY: 37,
  POKEMON_NICKNAMED_JOINED_PARTY: 30,
};
