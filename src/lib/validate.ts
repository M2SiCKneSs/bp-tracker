import { LIMITS } from './bp'
import { t } from './strings'
import { todayISO } from './dates'

/**
 * Client-side validation mirroring the CHECK constraints in the migration, so a
 * mistake is caught with a Hebrew message instead of a Postgres error string.
 * Returns null when the input is valid.
 */
export function validate(input: {
  measured_on: string
  systolic: number | null
  diastolic: number | null
  pulse: number | null
}): string | null {
  const { measured_on, systolic, diastolic, pulse } = input

  if (!measured_on) return t.validation.dateRequired
  if (measured_on > todayISO()) return t.validation.dateFuture

  if (systolic === null || Number.isNaN(systolic) || systolic < LIMITS.systolic.min || systolic > LIMITS.systolic.max)
    return t.validation.systolicRange
  if (
    diastolic === null ||
    Number.isNaN(diastolic) ||
    diastolic < LIMITS.diastolic.min ||
    diastolic > LIMITS.diastolic.max
  )
    return t.validation.diastolicRange
  if (pulse !== null && (Number.isNaN(pulse) || pulse < LIMITS.pulse.min || pulse > LIMITS.pulse.max))
    return t.validation.pulseRange

  if (systolic <= diastolic) return t.validation.order

  return null
}
