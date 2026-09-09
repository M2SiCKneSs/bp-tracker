import { useEffect, useState } from 'react'
import { detectTimezone } from '../lib/dates'
import { disablePush, enablePush, isSubscribed, pushConfigured, pushSupported } from '../lib/push'
import { loadSettings, saveSettings } from '../lib/readings'
import { functionsUrl, supabase } from '../lib/supabase'
import { t } from '../lib/strings'
import type { ReminderSettings } from '../lib/types'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const TIMEZONES = [
  'Asia/Jerusalem',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

/** '' is the <select> representation of a null (switched-off) reminder hour. */
const toHour = (v: string) => (v === '' ? null : Number(v))
const fromHour = (h: number | null) => (h === null ? '' : String(h))

export default function SettingsTab({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<ReminderSettings | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(
    null,
  )

  const supported = pushSupported() && pushConfigured()

  useEffect(() => {
    void (async () => {
      try {
        const tz = detectTimezone()
        setSettings(await loadSettings(userId, tz))
      } catch {
        setNotice({ kind: 'error', text: t.common.error })
      }
      if (pushSupported()) setSubscribed(await isSubscribed().catch(() => false))
    })()
  }, [userId])

  async function toggleNotifications(next: boolean) {
    setBusy(true)
    setNotice(null)
    try {
      if (next) {
        const result = await enablePush(userId)
        if (result === 'ok') {
          setSubscribed(true)
        } else if (result === 'denied') {
          setNotice({ kind: 'error', text: t.settings.denied })
        } else {
          setNotice({ kind: 'error', text: t.settings.unsupported })
        }
      } else {
        await disablePush()
        setSubscribed(false)
      }
    } catch {
      setNotice({ kind: 'error', text: t.common.error })
    } finally {
      setBusy(false)
    }
  }

  async function onSave() {
    if (!settings) return
    setBusy(true)
    setNotice(null)
    try {
      const next = await saveSettings(userId, {
        timezone: settings.timezone,
        daily_reminder_hour: settings.daily_reminder_hour,
        missed_day_hour: settings.missed_day_hour,
      })
      setSettings(next)
      setNotice({ kind: 'success', text: t.settings.saved })
    } catch {
      setNotice({ kind: 'error', text: t.common.error })
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setNotice(null)
    try {
      const { data } = await supabase.auth.getSession()
      const response = await fetch(`${functionsUrl('send-reminder')}?test=1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session?.access_token ?? ''}`,
        },
      })
      if (!response.ok) throw new Error(String(response.status))
      setNotice({ kind: 'success', text: t.settings.testSent })
    } catch {
      setNotice({ kind: 'error', text: t.settings.testFailed })
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <div className="card">{t.common.loading}</div>

  return (
    <>
      <div className="card">
        <h2>{t.settings.notifications}</h2>

        {notice && <div className={`alert ${notice.kind}`}>{notice.text}</div>}

        {!supported ? (
          <div className="alert info">{t.settings.unsupported}</div>
        ) : (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={subscribed}
                disabled={busy}
                onChange={(e) => void toggleNotifications(e.target.checked)}
              />
              {t.settings.enable}
            </label>
            <p className="hint">{t.settings.installHint}</p>
          </>
        )}

        <div className="field" style={{ marginBlockStart: 16 }}>
          <label htmlFor="tz">{t.settings.timezone}</label>
          <select
            id="tz"
            value={settings.timezone}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
          >
            {(TIMEZONES.includes(settings.timezone)
              ? TIMEZONES
              : [settings.timezone, ...TIMEZONES]
            ).map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="daily">{t.settings.dailyHour}</label>
          <select
            id="daily"
            dir="ltr"
            value={fromHour(settings.daily_reminder_hour)}
            onChange={(e) =>
              setSettings({ ...settings, daily_reminder_hour: toHour(e.target.value) })
            }
          >
            <option value="">{t.settings.off}</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="missed">{t.settings.missedHour}</label>
          <select
            id="missed"
            dir="ltr"
            value={fromHour(settings.missed_day_hour)}
            onChange={(e) => setSettings({ ...settings, missed_day_hour: toHour(e.target.value) })}
          >
            <option value="">{t.settings.off}</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>

        <div className="btn-row">
          <button className="btn" type="button" disabled={busy} onClick={() => void onSave()}>
            {t.settings.save}
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={busy || !subscribed}
            onClick={() => void sendTest()}
          >
            {t.settings.test}
          </button>
        </div>
      </div>

      <div className="card">
        <button
          className="btn secondary"
          type="button"
          onClick={() => void supabase.auth.signOut()}
        >
          {t.settings.signOut}
        </button>
      </div>
    </>
  )
}
