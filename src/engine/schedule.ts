// Step 1 of the day: which households are scheduled to clean today, and which take part.
// Each household gets a fixed random offset inside its interval (staggered days).
// An interval of 0 or less means that household never cleans.

import type { Rng } from './rng'

// Offset for each household: a random whole number from 0 to interval - 1.
export function makeCleaningOffsets(intervals: ArrayLike<number>, rng: Rng): Int32Array {
  const offsets = new Int32Array(intervals.length)
  for (let h = 0; h < intervals.length; h++) {
    const n = intervals[h]
    offsets[h] = n > 0 ? Math.min(n - 1, Math.floor(rng.next() * n)) : 0
  }
  return offsets
}

// Fills `out[h]` with 1 if household h cleans on `day`, else 0. Returns how many clean.
// A household is due when (day - offset) is a multiple of its interval. Only due
// households roll against compliance, so who cleans is re-rolled each scheduled day.
// `day` may be negative (spin-up).
export function pickCleaning(
  day: number,
  intervals: ArrayLike<number>,
  offsets: ArrayLike<number>,
  compliance: ArrayLike<number>,
  rng: Rng,
  out: Uint8Array,
): number {
  let count = 0
  for (let h = 0; h < out.length; h++) {
    out[h] = 0
    const n = intervals[h]
    if (n <= 0) continue
    const due = (((day - offsets[h]) % n) + n) % n === 0
    if (due && rng.next() < compliance[h]) {
      out[h] = 1
      count++
    }
  }
  return count
}