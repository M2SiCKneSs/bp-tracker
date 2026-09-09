import { t } from './strings'

export type Category = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis'

export const LIMITS = {
  systolic: { min: 50, max: 300 },
  diastolic: { min: 30, max: 200 },
  pulse: { min: 20, max: 250 },
} as const

/** Reference lines drawn on the graph. */
export const REFERENCE = { normalSystolic: 120, normalDiastolic: 80, highSystolic: 140, highDiastolic: 90 } as const

/**
 * AHA categories. The higher of the two readings decides, which is why every
 * test is an OR and they are checked worst-first.
 */
export function classify(systolic: number, diastolic: number): Category {
  if (systolic >= 180 || diastolic >= 120) return 'crisis'
  if (systolic >= 140 || diastolic >= 90) return 'stage2'
  if (systolic >= 130 || diastolic >= 80) return 'stage1'
  if (systolic >= 120) return 'elevated'
  return 'normal'
}

export const categoryLabel = (c: Category) => t.category[c]

/** Maps to the --cat-* custom properties in styles.css. */
export const categoryTone = (c: Category): 'good' | 'warn' | 'bad' =>
  c === 'normal' ? 'good' : c === 'elevated' || c === 'stage1' ? 'warn' : 'bad'
