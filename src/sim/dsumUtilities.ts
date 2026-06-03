import { ENCOUNTER_SLOTS, type SelectionConfig, type RouteData } from "../model/types";
import {
  DSUM_RANGE,
  ONE_FRAME_MS,
  timingConstantsForConfig,
} from "./constants";
import { mod, modInt } from "./math";

export function slotForHRandomAdd(hRandomAdd: number): number | null {
  const value = modInt(hRandomAdd);
  const slot = ENCOUNTER_SLOTS.find((s) => value >= s.min && value <= s.max);
  return slot?.id ?? null;
}

export function calibrationRangeForSlot(slotId: number, route: RouteData): Map<number, number> {
  const slot = ENCOUNTER_SLOTS[slotId];
  const result = new Map<number, number>();

  for (let dsum = slot.min; dsum < slot.max + route.encounterRate; dsum++) {
    const frequency =
      Math.max(
        0,
        Math.min(route.encounterRate - 1, dsum - slot.min) - Math.max(0, dsum - slot.max) + 1,
      );
    result.set(modInt(dsum), frequency);
  }

  return result;
}

export function getSuggestionRange(dsum: number, encounterRate: number): Map<number, number>;
export function getSuggestionRange(dsum: Map<number, number>, route: RouteData): Map<number, number>;
export function getSuggestionRange(
  dsumOrRange: number | Map<number, number>,
  routeOrRate: RouteData | number,
): Map<number, number> {
  if (typeof dsumOrRange === "number") {
    const encounterRate = typeof routeOrRate === "number" ? routeOrRate : routeOrRate.encounterRate;
    const result = new Map<number, number>();
    const hRandomAddMin = dsumOrRange - encounterRate + 1;
    for (let hRandomAdd = hRandomAddMin; hRandomAdd <= dsumOrRange; hRandomAdd++) {
      const slot = slotForHRandomAdd(hRandomAdd);
      if (slot != null) {
        result.set(slot, (result.get(slot) ?? 0) + 1);
      }
    }
    return result;
  }

  if (typeof routeOrRate === "number") {
    throw new Error("A route is required when getting suggestions for a weighted DSum range.");
  }

  const result = new Map<number, number>();
  for (const [dsum, dsumFrequency] of dsumOrRange) {
    const dsumResult = getSuggestionRange(dsum, routeOrRate.encounterRate);
    for (const [slot, frequency] of dsumResult) {
      result.set(slot, (result.get(slot) ?? 0) + frequency * dsumFrequency);
    }
  }
  return result;
}

export function overlapOrUseNewRange(previous: Map<number, number> | null, next: Map<number, number>): Map<number, number> {
  if (next.size === 0) {
    return new Map();
  }
  if (previous == null || previous.size === 0) {
    return new Map(next);
  }

  const overlap = new Map<number, number>();
  let divisor = 0;
  for (const [key, previousFrequency] of previous) {
    const nextFrequency = next.get(key);
    if (nextFrequency == null) {
      continue;
    }
    const weightedFrequency = previousFrequency + nextFrequency;
    if (weightedFrequency <= 0) {
      continue;
    }
    overlap.set(key, weightedFrequency);
    divisor = divisor === 0 ? weightedFrequency : gcd(divisor, weightedFrequency);
  }

  if (overlap.size === 0) {
    return new Map(next);
  }

  if (divisor <= 1) {
    return overlap;
  }

  const reduced = new Map<number, number>();
  for (const [key, value] of overlap) {
    reduced.set(key, Math.max(1, Math.trunc(value / divisor)));
  }
  return reduced;
}

export function overworldDelta(ms: number, config: SelectionConfig): number {
  const constants = timingConstantsForConfig(config);
  const sign = config.game === "YELLOW" ? 1 : -1;
  const frames = ms / ONE_FRAME_MS;
  return (frames / constants.OVERWORLD_CYCLE_FRAMES) * DSUM_RANGE * sign;
}

export function inBattleDelta(ms: number, config: SelectionConfig): number {
  const constants = timingConstantsForConfig(config);
  const frames = ms / ONE_FRAME_MS;
  return (frames / constants.IN_BATTLE_CYCLE_FRAMES) * DSUM_RANGE;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}
