import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AuthUser } from '../types'
import { ChessLoginScene } from './ChessLoginScene'

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<AuthUser>
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      setSaving(true)
      await onLogin(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-hero">
        <ChessLoginScene />
        <div className="login-hero-copy">
          <h1 className="login-hero-title">Agm-Chess Classes</h1>
        </div>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h2>Welcome back</h2>
            <p className="muted">Sign in to continue</p>
          </div>
        </div>

        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="btn primary login-submit" disabled={saving}>
          {saving ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  )
}
