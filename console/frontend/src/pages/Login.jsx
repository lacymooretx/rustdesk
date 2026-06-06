import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, AlertCircle } from 'lucide-react'
import api from '../services/api'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpRequired, setTotpRequired] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)

  // Check for SSO error from callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'sso_failed') {
      setError('Single sign-on failed. Please try again or use your email and password.')
    }
  }, [])

  // Check if SSO is enabled
  useEffect(() => {
    api.get('/auth/sso/enabled')
      .then((res) => setSsoEnabled(res.data.enabled))
      .catch(() => setSsoEnabled(false))
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, totpRequired ? totpCode : undefined)
    } catch (err) {
      if (err.totp_required) {
        setTotpRequired(true)
        setError('')
      } else {
        setError(
          err.response?.data?.detail || 'Invalid email or password. Please try again.'
        )
        // Reset TOTP state on auth failure
        if (totpRequired) {
          setTotpCode('')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSSOLogin() {
    setSsoLoading(true)
    setError('')
    try {
      const res = await api.get('/auth/sso/authorize')
      window.location.href = res.data.authorize_url
    } catch {
      setError('Could not initiate single sign-on. Please try again.')
      setSsoLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-lg shadow-indigo-600/30">
            AR
          </div>
          <h1 className="text-2xl font-bold text-white">Aspendora Remote Console</h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to manage your remote desktop infrastructure
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Enter your password"
              />
            </div>

            {totpRequired && (
              <div>
                <label
                  htmlFor="totp"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Authenticator Code
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono text-center text-lg tracking-[0.3em]"
                  placeholder="000000"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {ssoEnabled && (
            <>
              {/* OR divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-600" />
                <span className="text-xs font-medium uppercase text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-600" />
              </div>

              {/* Microsoft SSO button */}
              <button
                type="button"
                onClick={handleSSOLogin}
                disabled={ssoLoading}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-600 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ssoLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Aspendora Remote Console &middot; Secure Management Portal
        </p>
      </div>
    </div>
  )
}
