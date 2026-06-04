import type { EncounterExitStrategy, RouteData, SelectionConfig } from "../model/types";
import { DSUM_RANGE, YELLOW_PIKA_LEAD_PAUSE_FRAMES, timingConstantsForConfig } from "./constants";
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

export function onBattleEntry(config: SelectionConfig, route: RouteData, dsum: number): BattleEntry {
  const constants = timingConstantsForConfig(config);
  const animationFrames = route.isBlinds ? constants.HORIZONTAL_BLINDS_FRAMES : constants.SPLIT_SPIRAL_FRAMES;
  const inBattleFrames = animationFrames - constants.BATTLE_ENTRY_OVERWORLD_FRAMES;
  const sign = config.game === "YELLOW" ? 1 : -1;

  const simDeltaFromOverworld = ((sign * animationFrames) / constants.OVERWORLD_CYCLE_FRAMES) * DSUM_RANGE;
  const dsumAtBattleEntry = dsum - simDeltaFromOverworld;

  const deltaFromOverworld =
    ((sign * constants.BATTLE_ENTRY_OVERWORLD_FRAMES) / constants.OVERWORLD_CYCLE_FRAMES) * DSUM_RANGE;
  const deltaFromBattle = (inBattleFrames / constants.IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE;
  const pikaLeadPauseDelta =
    config.game === "YELLOW" && config.pikaLead
      ? (YELLOW_PIKA_LEAD_PAUSE_FRAMES / constants.IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE
      : 0;
  const dsumNow = dsumAtBattleEntry + deltaFromOverworld + deltaFromBattle - pikaLeadPauseDelta;

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
  config: SelectionConfig,
  route: RouteData,
  leadLevel: number,
  calibratedSlot: number,
  exit: EncounterExitStrategy,
): BattleExit {
  const constants = timingConstantsForConfig(config);
  const encounter = route.encounters[config.game]?.[calibratedSlot];
  const assumedEntryFrames = route.isBlinds ? constants.HORIZONTAL_BLINDS_FRAMES : constants.SPLIT_SPIRAL_FRAMES;
  const actualEntryFrames =
    encounter && leadLevel <= encounter.level - 3
      ? route.isBlinds
        ? constants.VERTICAL_BLINDS_FRAMES
        : constants.FULL_SPIRAL_FRAMES
      : assumedEntryFrames;
  const entryDSumDelta =
    ((actualEntryFrames - assumedEntryFrames) / constants.IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE;
  const calibrationForSlot = calibrationRangeForSlot(calibratedSlot, config, route);
  const inBattleExitFrames = constants.EXIT_FRAMES[exit];
  const rateForBattleCycle = (1 / constants.IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE;
  const sign = config.game === "YELLOW" ? 1 : -1;
  const simDeltaFromBattleExit =
    (inBattleExitFrames - 1) *
    (rateForBattleCycle - (sign / constants.OVERWORLD_CYCLE_FRAMES) * DSUM_RANGE);
  const mean = circularMean(calibrationForSlot);

  return {
    newDSum: mod(mean + entryDSumDelta + simDeltaFromBattleExit),
    suggestions: calibrationForSlot,
    entryDelta: entryDSumDelta,
    mean,
  };
}
