import { useState } from 'react'

// Static credentials. Set VITE_APP_USER / VITE_APP_PASS in .env (or Netlify env) to change them.
const USER = import.meta.env.VITE_APP_USER || 'admin'
const PASS = import.meta.env.VITE_APP_PASS || 'humanize2026'

export default function Login({ onSuccess }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setTimeout(() => {
      if (user.trim() === USER && pass === PASS) {
        onSuccess()
      } else {
        setError('Wrong username or password.')
        setBusy(false)
      }
    }, 250)
  }

  return (
    <div className="login-wrap">
      <form className="glass login-card" onSubmit={submit}>
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="20" height="20">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Trustpoint<span>Xposure</span> <span className="aeo-pill">AEO Certified</span></div>
            <div className="brand-sub">The First AEO-Certified PR Agency · AI Email Engine</div>
          </div>
        </div>

        <div className="field">
          <label htmlFor="user">Username</label>
          <input
            id="user"
            className="input"
            autoComplete="username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="admin"
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="pass">Password</label>
          <input
            id="pass"
            className="input"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button className="btn block" type="submit" disabled={busy || !user || !pass}>
          {busy ? <span className="spin" /> : 'Sign in'}
        </button>
        <div className="hint">Private tool. Access by invitation only.</div>
      </form>
    </div>
  )
}
