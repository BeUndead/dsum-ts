import { DSUM_RANGE } from "./constants";

export function mod(value: number): number {
  const result = value % DSUM_RANGE;
  return result < 0 ? result + DSUM_RANGE : result;
}

export function modInt(value: number): number {
  return mod(Math.trunc(value));
}

export function circularMean(values: Map<number, number>): number {
  let sumSin = 0;
  let sumCos = 0;
  let count = 0;

  for (const [value, weight] of values) {
    for (let i = 0; i < weight; i++) {
      const angle = (value * Math.PI * 2) / DSUM_RANGE;
      sumSin += Math.sin(angle);
      sumCos += Math.cos(angle);
      count++;
    }
  }

  if (count === 0) {
    return 0;
  }

  return mod((Math.atan2(sumSin, sumCos) * DSUM_RANGE) / (Math.PI * 2));
}

export function circularMinDiff(a: number, b: number): number {
  let diff = a - b;
  if (diff < 0) {
    diff += DSUM_RANGE;
  }
  if (diff > DSUM_RANGE / 2) {
    diff = DSUM_RANGE - diff;
  }
  return diff;
}
