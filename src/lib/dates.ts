import type { TimeOfDay } from './types'

/**
 * Local calendar date as YYYY-MM-DD.
 *
 * Deliberately not toISOString().slice(0,10): that converts to UTC first, so in
 * Israel (UTC+2/+3) every reading entered after 21:00/22:00 would be filed under
 * the previous day.
 */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD as local midnight (new Date('2026-09-09') would be UTC midnight). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function shiftISO(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

const short = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric' })
const full = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' })

export const formatShort = (iso: string) => short.format(parseISO(iso))
export const formatFull = (iso: string) => full.format(parseISO(iso))

export function defaultTimeOfDay(d: Date = new Date()): TimeOfDay {
  const h = d.getHours()
  if (h < 12) return 'morning'
  if (h >= 17) return 'evening'
  return 'other'
}

/** Browser's IANA timezone, used as the default for reminder scheduling. */
export function detectTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem'
}
