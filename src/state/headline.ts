// Turns the percentage reduction from curve.ts into the big number and the sentence under it.
// Whole percents only: the model is not precise enough for decimals.

export type HeadlineKind = 'fewer' | 'more' | 'same' | 'unknown'

export interface Headline {
  kind: HeadlineKind
  big: string // the big number, for example "58%"
  sentence: string // what it means, shown under the number
}

export function headlineFor(percentReduction: number | null): Headline {
  if (percentReduction === null || !Number.isFinite(percentReduction)) {
    return {
      kind: 'unknown',
      big: 'n/a',
      sentence: 'The do-nothing run had no infections, so there is nothing to compare with.',
    }
  }

  let rounded = Math.round(percentReduction)
  // 99.6 must not show as 100%: that would say every infection was prevented.
  if (percentReduction < 100 && rounded >= 100) rounded = 99

  if (rounded === 0) {
    return { kind: 'same', big: '0%', sentence: 'No clear difference in infections compared with doing nothing.' }
  }
  if (rounded > 0) {
    return { kind: 'fewer', big: `${rounded}%`, sentence: 'fewer infections than doing nothing' }
  }
  return { kind: 'more', big: `${-rounded}%`, sentence: 'more infections than doing nothing' }
}