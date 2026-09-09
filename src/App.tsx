import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { listReadings } from './lib/readings'
import { registerServiceWorker } from './lib/push'
import { t } from './lib/strings'
import type { Reading } from './lib/types'
import Login from './components/Login'
import EntryTab from './components/EntryTab'
import GraphTab from './components/GraphTab'
import SettingsTab from './components/SettingsTab'

type Tab = 'entry' | 'graph' | 'settings'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [tab, setTab] = useState<Tab>('entry')
  const [readings, setReadings] = useState<Reading[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    // When unconfigured the setup notice renders before authReady is consulted.
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Registered up front so the app is installable and the worker is warm before
  // the user ever opens Settings to switch notifications on.
  useEffect(() => {
    if (import.meta.env.PROD) void registerServiceWorker().catch(() => undefined)
  }, [])

  const refresh = useCallback(async () => {
    try {
      setReadings(await listReadings())
      setLoadError(null)
    } catch {
      setLoadError(t.common.error)
    }
  }, [])

  // Fetching on sign-in is synchronisation with an external system (the
  // database), which is what an effect is for; the lint rule only sees the
  // setState inside refresh().
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (session) void refresh()
  }, [session, refresh])

  if (!isConfigured) {
    return (
      <div className="center-screen">
        <div className="card">
          <h2>{t.appName}</h2>
          <div className="alert error">{t.common.configMissing}</div>
        </div>
      </div>
    )
  }

  if (!authReady) return <div className="center-screen">{t.common.loading}</div>
  if (!session) return <Login />

  const userId = session.user.id

  return (
    <div className="app">
      <header className="topbar">
        <h1>{t.appName}</h1>
      </header>

      <nav className="tabs" role="tablist">
        {(['entry', 'graph', 'settings'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {t.tabs[key]}
          </button>
        ))}
      </nav>

      <main>
        {loadError && <div className="alert error">{loadError}</div>}
        {tab === 'entry' && <EntryTab userId={userId} readings={readings} onChanged={refresh} />}
        {tab === 'graph' && <GraphTab readings={readings} />}
        {tab === 'settings' && <SettingsTab userId={userId} />}
      </main>
    </div>
  )
}
