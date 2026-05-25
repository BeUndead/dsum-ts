import type { RouteData } from "../model/types";
import { DSUM_RANGE } from "./constants";
import { getSuggestionRange } from "./dsumUtilities";

export class DSumSlotComputer {
  private readonly slots: number[][];

  constructor(private route: RouteData) {
    this.slots = Array.from({ length: DSUM_RANGE }, () => Array(10).fill(0));
    this.recomputeSlots();
  }

  setRoute(route: RouteData) {
    if (this.route.encounterRate === route.encounterRate) {
      this.route = route;
      return;
    }
    this.route = route;
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
      const suggestions = getSuggestionRange(dsum, this.route.encounterRate);
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
