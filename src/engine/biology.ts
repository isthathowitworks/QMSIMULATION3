// Temperature rules for mosquitoes, copied from the earlier Python engine (all are assumptions).

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

// Rounds .5 to the nearest even number, like Python's round(), so results match the old engine.
export function roundHalfEven(x: number): number {
  const r = Math.round(x)
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r
}

// Days from egg to adult. Cooler weather means a longer wait (6 to 20 days).
export function devDays(tempC: number): number {
  return clamp(roundHalfEven(9 + 0.8 * Math.max(0, 29 - tempC)), 6, 20)
}

// Days for the virus to become infectious inside a mosquito (5 to 15 days). Cooler means longer.
export function eipDays(tempC: number): number {
  return clamp(roundHalfEven(10 - 0.4 * (tempC - 28)), 5, 15)
}

// Chance an adult mosquito dies on a given day. Lowest near 27 C, at most 0.5.
export function adultMortality(tempC: number): number {
  return clamp(0.06 + 0.0025 * (tempC - 27) ** 2, 0.06, 0.5)
}

// Female eggs laid per adult per day. None below 18 C or above 36 C, best near 29 C.
export function eggRate(tempC: number, eggRateMax = 0.8): number {
  if (tempC < 18 || tempC > 36) return 0
  return eggRateMax * Math.max(0, 1 - ((tempC - 29) / 11) ** 2)
}