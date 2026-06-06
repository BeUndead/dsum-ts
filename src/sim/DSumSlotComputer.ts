import type { RouteData, SelectionConfig } from "../model/types";
import { DSUM_RANGE, encounterRateForConfig } from "./constants";
import { getSuggestionRange } from "./dsumUtilities";

export class DSumSlotComputer {
  private readonly slots: number[][];
  private encounterRate: number;

  constructor(
    private config: SelectionConfig,
    private route: RouteData,
  ) {
    this.slots = Array.from({ length: DSUM_RANGE }, () => Array(10).fill(0));
    this.encounterRate = encounterRateForConfig(config, route);
    this.recomputeSlots();
  }

  setRoute(route: RouteData) {
    this.route = route;
    this.recomputeSlotsIfEncounterRateChanged();
  }

  private recomputeSlotsIfEncounterRateChanged() {
    const encounterRate = encounterRateForConfig(this.config, this.route);
    if (this.encounterRate === encounterRate) {
      return;
    }
    this.encounterRate = encounterRate;
    this.recomputeSlots();
  }

  getSlotProbability(dsum: number): readonly number[] {
    const idx = (Math.round(dsum) | 0) & (DSUM_RANGE - 1);
    return this.slots[idx];
  }

  snapshot(): number[][] {
    return this.slots.map((row) => [...row]);
  }

  private recomputeSlots() {
    for (let dsum = 0; dsum < DSUM_RANGE; dsum++) {
      const row = this.slots[dsum];
      row.fill(0);
      const suggestions = getSuggestionRange(dsum, this.encounterRate);
      let sum = 0;
      for (const frequency of suggestions.values()) {
        sum += frequency;
      }
      if (sum === 0) {
        continue;
      }
      for (const [slot, frequency] of suggestions) {
        row[slot] = frequency / sum;
      }
    }
  }
}
