import { useEffect, useState } from 'react'

export default function SSOCallback() {
  const [error, setError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const userJson = params.get('user')

    if (token && userJson) {
      try {
        // Validate that user JSON is parseable
        JSON.parse(userJson)
        localStorage.setItem('auth_token', token)
        localStorage.setItem('auth_user', userJson)
        window.location.href = '/dashboard'
      } catch {
        setError(true)
        window.location.href = '/login?error=sso_failed'
      }
    } else {
      setError(true)
      window.location.href = '/login?error=sso_failed'
    }
  }, [])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="text-center">
          <p className="text-sm text-red-400">Sign in failed. Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-slate-400">Completing sign in...</p>
      </div>
    </div>
  )
}
