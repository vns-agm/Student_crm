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
  const [showPassword, setShowPassword] = useState(false)
  // Fall back to the animated board if the video can't play or motion is reduced.
  const [useVideo, setUseVideo] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

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
      {useVideo ? (
        <video
          className="login-video"
          src="/login-background.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          onError={() => setUseVideo(false)}
        />
      ) : null}
      <div className="login-overlay" aria-hidden="true" />

      <div className="login-hero">
        {useVideo ? null : <ChessLoginScene />}
        <div className="login-hero-copy">
          <p className="login-kicker">Chess academy management</p>
          <h1 className="login-hero-title">Student CRM</h1>
          <p className="login-hero-sub">
            Attendance, fees, renewals and tournaments for every young player, all in one place.
          </p>
        </div>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <h2>Welcome back</h2>
            <p className="muted">Sign in to your academy CRM</p>
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
          <span className="login-password">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((show) => !show)}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="submit" className="btn primary login-submit" disabled={saving}>
          {saving ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </div>
  )
}
