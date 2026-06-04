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

  getSlotProbability(dsum: number): number[] {
    return this.slots[((Math.round(dsum) % DSUM_RANGE) + DSUM_RANGE) % DSUM_RANGE];
  }

  snapshot(): number[][] {
    return this.slots.map((row) => [...row]);
  }

  private recomputeSlots() {
    for (let dsum = 0; dsum < DSUM_RANGE; dsum++) {
      this.slots[dsum].fill(0);
      const suggestions = getSuggestionRange(dsum, this.encounterRate);
      let sum = 0;
      for (const frequency of suggestions.values()) {
        sum += frequency;
      }
      if (sum === 0) {
        continue;
      }
      for (const [slot, frequency] of suggestions) {
        this.slots[dsum][slot] = frequency / sum;
      }
    }
  }
}
