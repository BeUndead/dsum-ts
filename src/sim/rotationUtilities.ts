import type { EncounterExitStrategy, Game, RouteData } from "../model/types";
import {
  BATTLE_ENTRY_OVERWORLD_FRAMES,
  DSUM_RANGE,
  EXIT_FRAMES,
  FULL_SPIRAL_FRAMES,
  HORIZONTAL_BLINDS_FRAMES,
  IN_BATTLE_CYCLE_FRAMES,
  OVERWORLD_CYCLE_FRAMES,
  SPLIT_SPIRAL_FRAMES,
  VERTICAL_BLINDS_FRAMES,
} from "./constants";
import { calibrationRangeForSlot } from "./dsumUtilities";
import { circularMean, mod, modInt } from "./math";

export interface BattleEntry {
  atGeneration: number;
  atNow: number;
}

export interface BattleExit {
  newDSum: number;
  suggestions: Map<number, number>;
  entryDelta: number;
  mean: number;
}

export function onBattleEntry(game: Game, route: RouteData, dsum: number): BattleEntry {
  const animationFrames = route.isBlinds ? HORIZONTAL_BLINDS_FRAMES : SPLIT_SPIRAL_FRAMES;
  const inBattleFrames = animationFrames - BATTLE_ENTRY_OVERWORLD_FRAMES;
  const sign = game === "YELLOW" ? 1 : -1;

  const simDeltaFromOverworld = ((sign * animationFrames) / OVERWORLD_CYCLE_FRAMES) * DSUM_RANGE;
  const dsumAtBattleEntry = dsum - simDeltaFromOverworld;

  const deltaFromOverworld = ((sign * BATTLE_ENTRY_OVERWORLD_FRAMES) / OVERWORLD_CYCLE_FRAMES) * DSUM_RANGE;
  const deltaFromBattle = (inBattleFrames / IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE;
  const dsumNow = dsumAtBattleEntry + deltaFromOverworld + deltaFromBattle;

  return {
    atGeneration: modInt(dsumAtBattleEntry),
    atNow: modInt(dsumNow),
  };
}

export function applyOffsetToKeys(dsumRange: Map<number, number>, offset: number): Map<number, number> {
  if (offset === 0) {
    return dsumRange;
  }

  const result = new Map<number, number>();
  for (const [key, value] of dsumRange) {
    result.set(modInt(key + offset), value);
  }
  return result;
}

export function onBattleExit(
  game: Game,
  route: RouteData,
  leadLevel: number,
  calibratedSlot: number,
  exit: EncounterExitStrategy,
): BattleExit {
  const encounter = route.encounters[game][calibratedSlot];
  const assumedEntryFrames = route.isBlinds ? HORIZONTAL_BLINDS_FRAMES : SPLIT_SPIRAL_FRAMES;
  const actualEntryFrames =
    encounter && leadLevel <= encounter.level - 3
      ? route.isBlinds
        ? VERTICAL_BLINDS_FRAMES
        : FULL_SPIRAL_FRAMES
      : assumedEntryFrames;
  const entryDSumDelta = ((actualEntryFrames - assumedEntryFrames) / IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE;
  const calibrationForSlot = calibrationRangeForSlot(calibratedSlot, route);
  const inBattleExitFrames = EXIT_FRAMES[exit];
  const rateForBattleCycle = (1 / IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE;
  const sign = game === "YELLOW" ? 1 : -1;
  const simDeltaFromBattleExit =
    (inBattleExitFrames - 1) * (rateForBattleCycle - (sign / OVERWORLD_CYCLE_FRAMES) * DSUM_RANGE);
  const mean = circularMean(calibrationForSlot);

  return {
    newDSum: mod(mean + entryDSumDelta + simDeltaFromBattleExit),
    suggestions: calibrationForSlot,
    entryDelta: entryDSumDelta,
    mean,
  };
}
