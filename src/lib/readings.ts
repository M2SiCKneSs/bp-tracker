import { supabase } from './supabase'
import type { Reading, ReadingInput, ReminderSettings } from './types'

export { validate } from './validate'

const COLUMNS = 'id,user_id,measured_on,time_of_day,systolic,diastolic,pulse,note,created_at'

export async function listReadings(): Promise<Reading[]> {
  const { data, error } = await supabase
    .from('readings')
    .select(COLUMNS)
    .order('measured_on', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Reading[]
}

export async function createReading(userId: string, input: ReadingInput): Promise<Reading> {
  const { data, error } = await supabase
    .from('readings')
    .insert({ ...input, user_id: userId })
    .select(COLUMNS)
    .single()
  if (error) throw error
  return data as Reading
}

export async function updateReading(id: string, input: ReadingInput): Promise<Reading> {
  const { data, error } = await supabase
    .from('readings')
    .update(input)
    .eq('id', id)
    .select(COLUMNS)
    .single()
  if (error) throw error
  return data as Reading
}

export async function deleteReading(id: string): Promise<void> {
  const { error } = await supabase.from('readings').delete().eq('id', id)
  if (error) throw error
}

const DEFAULT_SETTINGS = { daily_reminder_hour: 8, missed_day_hour: 20 }

/** Reads the row, creating it with sane defaults on first run. */
export async function loadSettings(userId: string, timezone: string): Promise<ReminderSettings> {
  const { data, error } = await supabase
    .from('reminder_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (data) return data as ReminderSettings

  const { data: created, error: insertError } = await supabase
    .from('reminder_settings')
    .insert({ user_id: userId, timezone, ...DEFAULT_SETTINGS })
    .select('*')
    .single()
  if (insertError) throw insertError
  return created as ReminderSettings
}

export async function saveSettings(
  userId: string,
  patch: Pick<ReminderSettings, 'timezone' | 'daily_reminder_hour' | 'missed_day_hour'>,
): Promise<ReminderSettings> {
  const { data, error } = await supabase
    .from('reminder_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as ReminderSettings
}
