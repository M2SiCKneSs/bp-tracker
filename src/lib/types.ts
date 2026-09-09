export type TimeOfDay = 'morning' | 'evening' | 'other'

export interface Reading {
  id: string
  user_id: string
  /** Local calendar date, YYYY-MM-DD. Stored as a DATE, never a timestamp. */
  measured_on: string
  time_of_day: TimeOfDay
  systolic: number
  diastolic: number
  pulse: number | null
  note: string | null
  created_at: string
}

export type ReadingInput = Pick<
  Reading,
  'measured_on' | 'time_of_day' | 'systolic' | 'diastolic' | 'pulse' | 'note'
>

export interface ReminderSettings {
  user_id: string
  timezone: string
  /** 0-23, or null to switch that reminder off. */
  daily_reminder_hour: number | null
  missed_day_hour: number | null
  updated_at: string
}
