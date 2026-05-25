import type { EncounterExitStrategy, Game, RouteData, SelectionConfig } from "../model/types";
import { DSUM_RANGE } from "./constants";
import { getSuggestionRange, inBattleDelta, overlapOrUseNewRange, overworldDelta } from "./dsumUtilities";
import { circularMean, circularMinDiff, mod } from "./math";
import { applyOffsetToKeys, onBattleEntry, onBattleExit, type BattleEntry } from "./rotationUtilities";
import { DSumSlotComputer } from "./DSumSlotComputer";

export class DSumDriver {
  dsum = 0;
  uncertainty = 1;
  firstCalibration = true;
  paused = false;
  suggested: Map<number, number> | null = null;
  exitStrategy: EncounterExitStrategy = "PLAYER_GOT_AWAY";

  private dsumAtBattleStart: number | null = null;
  private dsumCalibrationRange: Map<number, number> | null = null;
  private dsumRangeAtBattleStart: Map<number, number> | null = null;
  private battleEntrySlotProbabilities: number[] | null = null;
  private targetProbabilities: number | null = null;
  private slotProbCacheCenter = Number.MIN_SAFE_INTEGER;
  private slotProbCacheCalibrationRef: Map<number, number> | null = null;
  private slotProbCacheU = -1;
  private slotProbCache = Array(10).fill(0);

  readonly slotComputer: DSumSlotComputer;

  constructor(
    private config: SelectionConfig,
    private getRoute: (routeId: string) => RouteData,
  ) {
    this.slotComputer = new DSumSlotComputer(this.route);
  }

  get route(): RouteData {
    return this.getRoute(this.config.routeId);
  }

  get game(): Game {
    return this.config.game;
  }

  setRoute(routeId: string) {
    this.config.routeId = routeId;
    this.slotComputer.setRoute(this.route);
    this.invalidateProbabilityCache();
  }

  update(ms: number) {
    this.targetProbabilities = null;
    if (this.paused) {
      return;
    }

    const delta = this.isInBattle() ? inBattleDelta(ms) : overworldDelta(ms, this.game);
    this.dsum = mod(this.dsum + delta);
  }

  togglePause() {
    this.paused = !this.paused;
  }

  step(signum: number) {
    if (!this.paused) {
      return;
    }
    const dsum = Math.round(this.dsum);
    this.dsum = mod(dsum + (signum > 0 ? -1 : 1));
    this.invalidateProbabilityCache();
  }

  battleEntered() {
    if (this.isInBattle()) {
      return;
    }

    const dsum = mod(Math.round(this.dsum));
    const battleEntry = onBattleEntry(this.game, this.route, dsum);
    this.dsum = battleEntry.atNow;
    this.dsumAtBattleStart = battleEntry.atGeneration;

    if (this.dsumCalibrationRange == null) {
      this.dsumRangeAtBattleStart = new Map([[this.dsumAtBattleStart, 1]]);
    } else {
      this.dsumRangeAtBattleStart = this.hypothesisMapForBattleEntry(battleEntry);
    }

    this.suggested = getSuggestionRange(this.dsumRangeAtBattleStart, this.route);
    this.battleEntrySlotProbabilities = normalizeSuggestionWeightsToSlotProbabilities(this.suggested);
    this.invalidateProbabilityCache();
  }

  calibrateOn(slot: number) {
    if (!this.isInBattle() || this.dsumAtBattleStart == null) {
      return;
    }

    const diffFromBattle = this.dsum - this.dsumAtBattleStart;
    const battleExit = onBattleExit(this.game, this.route, this.config.leadLevel, slot, this.exitStrategy);
    const updatedCalibrationRange =
      !this.firstCalibration && this.dsumRangeAtBattleStart != null
        ? overlapOrUseNewRange(applyOffsetToKeys(this.dsumRangeAtBattleStart, battleExit.entryDelta), battleExit.suggestions)
        : battleExit.suggestions;

    this.dsumCalibrationRange = updatedCalibrationRange;
    this.dsum = mod(battleExit.newDSum + diffFromBattle);
    this.uncertainty = calculateUncertainty(updatedCalibrationRange);
    this.dsumAtBattleStart = null;
    this.dsumRangeAtBattleStart = null;
    this.battleEntrySlotProbabilities = null;
    this.exitStrategy = "PLAYER_GOT_AWAY";
    this.suggested = null;
    this.firstCalibration = false;
    this.invalidateProbabilityCache();
  }

  primeEncounterExitStrategy(strategy: EncounterExitStrategy) {
    this.exitStrategy = this.exitStrategy === strategy ? "PLAYER_GOT_AWAY" : strategy;
  }

  reset() {
    this.firstCalibration = true;
    this.dsumAtBattleStart = null;
    this.dsumRangeAtBattleStart = null;
    this.dsumCalibrationRange = null;
    this.uncertainty = 1;
    this.battleEntrySlotProbabilities = null;
    this.exitStrategy = "PLAYER_GOT_AWAY";
    this.suggested = null;
    this.invalidateProbabilityCache();
  }

  isInBattle(): boolean {
    return this.dsumAtBattleStart != null;
  }

  isUncalibrated(): boolean {
    return !this.isInBattle() && this.firstCalibration;
  }

  getCurrentEncounterSlotProbabilities(): number[] {
    if (this.isInBattle() && this.battleEntrySlotProbabilities != null) {
      return [...this.battleEntrySlotProbabilities];
    }

    const modCenter = mod(Math.round(this.dsum));
    const uKey = Math.max(1, this.uncertainty);
    if (
      modCenter !== this.slotProbCacheCenter ||
      uKey !== this.slotProbCacheU ||
      this.dsumCalibrationRange !== this.slotProbCacheCalibrationRef
    ) {
      const guess = this.hypothesisMapForBattleEntry({ atGeneration: modCenter, atNow: modCenter });
      const probabilities = normalizeSuggestionWeightsToSlotProbabilities(getSuggestionRange(guess, this.route));
      this.slotProbCache = probabilities ?? [...this.slotComputer.getSlotProbability(modCenter)];
      this.slotProbCacheCenter = modCenter;
      this.slotProbCacheCalibrationRef = this.dsumCalibrationRange;
      this.slotProbCacheU = uKey;
    }

    return [...this.slotProbCache];
  }

  getTargetCumulativeProbability(): number {
    if (this.targetProbabilities != null) {
      return this.targetProbabilities;
    }

    const slotP = this.getCurrentEncounterSlotProbabilities();
    let total = 0;
    for (const target of this.config.targets) {
      total += slotP[target] ?? 0;
    }
    this.targetProbabilities = total;
    return total;
  }

  stateText(): string {
    return this.isInBattle() ? "Battle" : "Overworld";
  }

  stateSubText(): string {
    if (!this.isInBattle()) {
      if (this.firstCalibration) {
        return "[Uncalibrated]";
      }
      return this.getTargetCumulativeProbability() >= this.config.threshold ? "[Search]" : "[Wait]";
    }

    switch (this.exitStrategy) {
      case "POKEMON_RAN":
        return "[R] Pokemon Ran";
      case "POKEMON_JOINED_PARTY":
        return "[T] Joined Party";
      case "POKEMON_SENT_TO_BOX":
        return "[B] Sent to Box";
      case "POKEMON_NICKNAMED_JOINED_PARTY":
        return "[N] Nicknamed";
      default:
        return "Player Ran";
    }
  }

  private hypothesisMapForBattleEntry(battleEntry: BattleEntry): Map<number, number> {
    const atGeneration = battleEntry.atGeneration;
    if (this.dsumCalibrationRange == null) {
      return new Map([[atGeneration, 1]]);
    }

    const calibrationMean = circularMean(this.dsumCalibrationRange);
    return applyOffsetToKeys(this.dsumCalibrationRange, atGeneration - calibrationMean);
  }

  private invalidateProbabilityCache() {
    this.targetProbabilities = null;
    this.slotProbCacheCenter = Number.MIN_SAFE_INTEGER;
  }
}

function normalizeSuggestionWeightsToSlotProbabilities(weights: Map<number, number>): number[] | null {
  let sum = 0;
  for (const value of weights.values()) {
    sum += value;
  }
  if (sum <= 0) {
    return null;
  }

  const probabilities = Array(10).fill(0);
  for (const [slot, weight] of weights) {
    probabilities[slot] = weight / sum;
  }
  return probabilities;
}

function calculateUncertainty(dsumRange: Map<number, number> | null): number {
  if (dsumRange == null || dsumRange.size === 0) {
    return 1;
  }

  const mean = circularMean(dsumRange);
  let maxDifference = 1;
  for (const key of dsumRange.keys()) {
    maxDifference = Math.max(maxDifference, circularMinDiff(mean, key));
  }
  return Math.max(1, Math.ceil(maxDifference));
}
