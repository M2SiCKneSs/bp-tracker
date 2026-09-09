import { useCallback, useEffect, useState } from 'react'
import { detectTimezone } from '../lib/dates'
import { disablePush, enablePush, getStatus, pushConfigured, pushSupported } from '../lib/push'
import type { PushStatus } from '../lib/push'
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
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'success' | 'info'; text: string } | null>(
    null,
  )

  const supported = pushSupported() && pushConfigured()

  const refreshStatus = useCallback(async () => {
    setStatus(await getStatus().catch(() => null))
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        setSettings(await loadSettings(userId, detectTimezone()))
      } catch {
        setNotice({ kind: 'error', text: t.common.error })
      }
      await refreshStatus()
    })()
  }, [userId, refreshStatus])

  async function toggleNotifications(next: boolean) {
    setBusy(true)
    setNotice(null)
    try {
      if (next) {
        const result = await enablePush(userId)
        if (result === 'denied') setNotice({ kind: 'error', text: t.settings.denied })
        else if (result !== 'ok') setNotice({ kind: 'error', text: t.settings.unsupported })
      } else {
        await disablePush()
      }
    } catch (err) {
      setNotice({ kind: 'error', text: `${t.common.error} ${(err as Error).message}` })
    } finally {
      await refreshStatus()
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
      const payload = (await response.json().catch(() => null)) as
        | { sent?: number; pruned?: number; error?: string; detail?: string }
        | null

      if (!response.ok) {
        const reason = payload?.detail ?? payload?.error ?? `HTTP ${response.status}`
        setNotice({ kind: 'error', text: `${t.settings.testFailed} ${reason}` })
        return
      }

      // A 200 with sent:0 means the function ran but found no device row — the
      // old code reported that as success, which is why nothing arrived.
      if (!payload?.sent) {
        setNotice({ kind: 'error', text: t.settings.testNoDevice })
        await refreshStatus()
        return
      }

      setNotice({ kind: 'success', text: t.settings.testSent })
    } catch (err) {
      setNotice({ kind: 'error', text: `${t.settings.testFailed} ${(err as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <div className="card">{t.common.loading}</div>

  const permissionLabel =
    status?.permission === 'granted'
      ? t.settings.permGranted
      : status?.permission === 'denied'
        ? t.settings.permDenied
        : t.settings.permDefault

  const subscriptionLabel = status?.stale
    ? t.settings.subStale
    : status?.subscribed
      ? t.settings.subActive
      : t.settings.subNone

  return (
    <>
      <div className="card">
        <h2>{t.settings.notifications}</h2>

        {notice && <div className={`alert ${notice.kind}`}>{notice.text}</div>}
        {status?.stale && <div className="alert error">{t.settings.staleWarning}</div>}

        {!supported ? (
          <div className="alert info">{t.settings.unsupported}</div>
        ) : (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={status?.subscribed ?? false}
                disabled={busy}
                onChange={(e) => void toggleNotifications(e.target.checked)}
              />
              {t.settings.enable}
            </label>

            <dl className="status">
              <dt>{t.settings.statusPermission}</dt>
              <dd>{permissionLabel}</dd>
              <dt>{t.settings.statusSubscription}</dt>
              <dd>{subscriptionLabel}</dd>
            </dl>

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
            disabled={busy}
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
