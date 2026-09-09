// Reminder sender. Invoked hourly by pg_cron with the service-role key, and
// on demand by the app with the signed-in user's JWT and ?test=1.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:reminder@example.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TEXT = {
  daily: { title: 'מעקב לחץ דם', body: 'הגיע הזמן למדוד לחץ דם', tag: 'bp-daily' },
  missed: { title: 'מעקב לחץ דם', body: 'לא נרשמה מדידה היום', tag: 'bp-missed' },
  test: { title: 'מעקב לחץ דם', body: 'התראת בדיקה — הכול עובד', tag: 'bp-test' },
}

interface Settings {
  user_id: string
  timezone: string
  daily_reminder_hour: number | null
  missed_day_hour: number | null
}

/**
 * The user's local date and hour. Using Intl rather than a stored UTC offset
 * means DST transitions are handled by the timezone database, not by us.
 */
function localNow(timezone: string, now = new Date()): { date: string; hour: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now)
  } catch {
    // An invalid timezone string must not take the whole cron run down.
    return localNow('UTC', now)
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    // Some ICU versions render midnight as hour "24" under hour12:false.
    hour: Number(get('hour')) % 24,
  }
}

async function pushToUser(userId: string, payload: { title: string; body: string; tag: string }) {
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .eq('user_id', userId)
  if (error) throw error
  if (!subs?.length) return { sent: 0, pruned: 0 }

  let sent = 0
  let pruned = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 404/410 mean the browser dropped the subscription — stop pushing to it.
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        pruned++
      } else {
        console.error('push failed', status, (err as Error).message)
      }
    }
  }
  return { sent, pruned }
}

async function hasReadingOn(userId: string, date: string): Promise<boolean> {
  const { count, error } = await admin
    .from('readings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('measured_on', date)
  if (error) throw error
  return (count ?? 0) > 0
}

/** Resolves the caller's user id from their JWT, for the ?test=1 path. */
async function callerUserId(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error) return null
  return data.user?.id ?? null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const isTest = new URL(request.url).searchParams.get('test') === '1'

    if (isTest) {
      const userId = await callerUserId(request)
      if (!userId) return json({ error: 'unauthorized' }, 401)
      return json(await pushToUser(userId, TEXT.test))
    }

    const { data: rows, error } = await admin
      .from('reminder_settings')
      .select('user_id,timezone,daily_reminder_hour,missed_day_hour')
    if (error) throw error

    const results: Record<string, unknown>[] = []

    for (const s of (rows ?? []) as Settings[]) {
      const { date, hour } = localNow(s.timezone)

      if (s.daily_reminder_hour !== null && hour === s.daily_reminder_hour) {
        results.push({ user: s.user_id, kind: 'daily', ...(await pushToUser(s.user_id, TEXT.daily)) })
      }

      if (s.missed_day_hour !== null && hour === s.missed_day_hour) {
        if (await hasReadingOn(s.user_id, date)) {
          results.push({ user: s.user_id, kind: 'missed', skipped: 'already measured' })
        } else {
          results.push({
            user: s.user_id,
            kind: 'missed',
            ...(await pushToUser(s.user_id, TEXT.missed)),
          })
        }
      }
    }

    return json({ ran: new Date().toISOString(), results })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})
