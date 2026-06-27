import type { EncounterExitStrategy, Game, RouteData, SelectionConfig } from "../model/types";

export const FRAME_RATE = 59.7275;
export const ONE_FRAME_MS = 1000 / FRAME_RATE;
export const DSUM_RANGE = 256;
export const YELLOW_PIKA_LEAD_PAUSE_FRAMES = 36;

interface TimingConstants {
  OVERWORLD_WITHOUT_NPC_CYCLE_FRAMES: number;
  OVERWORLD_CYCLE_FRAMES: number;
  IN_BATTLE_CYCLE_FRAMES: number;
  HORIZONTAL_BLINDS_FRAMES: number;
  VERTICAL_BLINDS_FRAMES: number;
  SPLIT_SPIRAL_FRAMES: number;
  FULL_SPIRAL_FRAMES: number;
  BATTLE_ENTRY_OVERWORLD_FRAMES: number;
  EXIT_FRAMES: Record<EncounterExitStrategy, number>;
}

const RED_BLUE_TIMING_CONSTANTS: TimingConstants = {
  OVERWORLD_WITHOUT_NPC_CYCLE_FRAMES: 373.4160401,
  OVERWORLD_CYCLE_FRAMES: 373.4160401,
  IN_BATTLE_CYCLE_FRAMES: 791.5555556,
  HORIZONTAL_BLINDS_FRAMES: 70,
  VERTICAL_BLINDS_FRAMES: 64,
  SPLIT_SPIRAL_FRAMES: 110,
  FULL_SPIRAL_FRAMES: 142,
  BATTLE_ENTRY_OVERWORLD_FRAMES: 8,
  EXIT_FRAMES: {
    PLAYER_GOT_AWAY: 37,
    POKEMON_RAN: 77,
    POKEMON_SENT_TO_BOX: 22,
    POKEMON_JOINED_PARTY: 37,
    POKEMON_NICKNAMED_JOINED_PARTY: 30,
  },
};

const YELLOW_TIMING_CONSTANTS: TimingConstants = {
  OVERWORLD_WITHOUT_NPC_CYCLE_FRAMES: 682.1879699,
  // Usage note:
  // In Viridian Forest, aim for Pikachu following, with no NPC on screen.
  // In Safari Zone (East), aim for being on the bike.
  OVERWORLD_CYCLE_FRAMES: 805.3501906,
  IN_BATTLE_CYCLE_FRAMES: 783.1091954,
  HORIZONTAL_BLINDS_FRAMES: 70,
  VERTICAL_BLINDS_FRAMES: 64,
  SPLIT_SPIRAL_FRAMES: 148,
  FULL_SPIRAL_FRAMES: 177,
  BATTLE_ENTRY_OVERWORLD_FRAMES: 8,
  EXIT_FRAMES: {
    PLAYER_GOT_AWAY: 46,
    POKEMON_RAN: 84,
    POKEMON_SENT_TO_BOX: 29,
    POKEMON_JOINED_PARTY: 44,
    POKEMON_NICKNAMED_JOINED_PARTY: 44,
  },
};

function timingConstantsForGame(game: Game): TimingConstants {
  if (game !== "YELLOW") {
    return RED_BLUE_TIMING_CONSTANTS;
  }
  return YELLOW_TIMING_CONSTANTS;
}

export function timingConstantsForConfig(config: SelectionConfig): TimingConstants {
  return timingConstantsForGame(config.game);
}

export function overworldCycleFramesForConfig(config: SelectionConfig, route: RouteData): number {
  if (route.isSafari) {
    const constants = timingConstantsForConfig(config);
    return constants.OVERWORLD_CYCLE_FRAMES;
  }

  if (config.game === "YELLOW" && route.yellowOverworldCycleFrames) {
    const yFrames = route.yellowOverworldCycleFrames;
    if (config.pikaFollow) {
      return config.npcOnScreen ? yFrames.npcOnPikaFollow : yFrames.npcOffPikaFollow;
    }
    return config.npcOnScreen ? yFrames.npcOn : yFrames.npcOff;
  }

  const constants = timingConstantsForConfig(config);
  return config.npcOnScreen ? constants.OVERWORLD_CYCLE_FRAMES : constants.OVERWORLD_WITHOUT_NPC_CYCLE_FRAMES;
}

export function encounterRateForConfig(config: SelectionConfig, route: RouteData): number {
  const encounterRate = route.encounterRates[config.game];
  if (encounterRate == null) {
    throw new Error(`${route.name} has no encounter rate for ${config.game}.`);
  }
  return encounterRate;
}
