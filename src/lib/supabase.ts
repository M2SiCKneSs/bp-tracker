import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False when the build has no Supabase credentials; App renders a setup notice. */
export const isConfigured = Boolean(url && anonKey)

// Created against empty strings when unconfigured so importing this module never
// throws — a thrown error at import time would render a blank white page with
// nothing explaining why.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export const functionsUrl = (name: string) => `${url}/functions/v1/${name}`
