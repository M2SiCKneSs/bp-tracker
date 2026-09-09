import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/strings'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) setError(t.login.failed)
    setBusy(false)
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={onSubmit}>
        <h2>{t.login.title}</h2>
        <p className="hint" style={{ marginBlockStart: 0, marginBlockEnd: 14 }}>
          {t.login.subtitle}
        </p>

        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label htmlFor="email">{t.login.email}</label>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">{t.login.password}</label>
          <input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn" type="submit" disabled={busy}>
          {busy ? t.login.working : t.login.submit}
        </button>
      </form>
    </div>
  )
}
