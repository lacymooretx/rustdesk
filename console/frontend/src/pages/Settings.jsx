import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Shield, ShieldCheck, ShieldOff, Eye, EyeOff, Copy, Check } from 'lucide-react'
import api from '../services/api'
import Badge from '../components/Badge'

export default function Settings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Change password state
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  // TOTP state
  const [totpStep, setTotpStep] = useState(null) // null | 'setup' | 'verify' | 'disable'
  const [totpData, setTotpData] = useState(null) // { secret, qr_base64 }
  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const [totpSuccess, setTotpSuccess] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [secretCopied, setSecretCopied] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)
  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Change password mutation
  const changePwMutation = useMutation({
    mutationFn: (payload) => api.post('/auth/change-password', payload),
    onSuccess: (res) => {
      setPwForm({ current_password: '', new_password: '', confirm: '' })
      setPwError('')
      setPwSuccess('Password changed successfully.')
      showToast('Password changed successfully.')
      // Update stored user data
      localStorage.setItem('auth_user', JSON.stringify(res.data))
    },
    onError: (err) => {
      setPwError(err.response?.data?.detail || 'Failed to change password.')
      setPwSuccess('')
    },
  })

  function handleChangePassword(e) {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')
    if (pwForm.new_password !== pwForm.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    if (pwForm.new_password.length < 6) {
      setPwError('New password must be at least 6 characters.')
      return
    }
    changePwMutation.mutate({
      current_password: pwForm.current_password,
      new_password: pwForm.new_password,
    })
  }

  // TOTP setup mutation
  const totpSetupMutation = useMutation({
    mutationFn: () => api.post('/auth/totp/setup'),
    onSuccess: (res) => {
      setTotpData(res.data)
      setTotpStep('verify')
      setTotpError('')
    },
    onError: (err) => {
      setTotpError(err.response?.data?.detail || 'Failed to start TOTP setup.')
    },
  })

  // TOTP verify mutation
  const totpVerifyMutation = useMutation({
    mutationFn: (code) => api.post('/auth/totp/verify', { code }),
    onSuccess: () => {
      setTotpStep(null)
      setTotpData(null)
      setTotpCode('')
      setTotpError('')
      setTotpSuccess('Two-factor authentication enabled successfully.')
      showToast('Two-factor authentication enabled.')
      // Refresh user data to get updated totp_enabled
      api.get('/auth/me').then((res) => {
        localStorage.setItem('auth_user', JSON.stringify(res.data))
        window.location.reload()
      })
    },
    onError: (err) => {
      setTotpError(err.response?.data?.detail || 'Invalid TOTP code. Please try again.')
    },
  })

  // TOTP disable mutation
  const totpDisableMutation = useMutation({
    mutationFn: (current_password) => api.post('/auth/totp/disable', { current_password }),
    onSuccess: () => {
      setTotpStep(null)
      setDisablePassword('')
      setTotpError('')
      setTotpSuccess('Two-factor authentication disabled.')
      showToast('Two-factor authentication disabled.')
      api.get('/auth/me').then((res) => {
        localStorage.setItem('auth_user', JSON.stringify(res.data))
        window.location.reload()
      })
    },
    onError: (err) => {
      setTotpError(err.response?.data?.detail || 'Failed to disable TOTP.')
    },
  })

  function handleTotpSetup() {
    setTotpError('')
    setTotpSuccess('')
    setTotpStep('setup')
    totpSetupMutation.mutate()
  }

  function handleTotpVerify(e) {
    e.preventDefault()
    setTotpError('')
    totpVerifyMutation.mutate(totpCode)
  }

  function handleTotpDisable(e) {
    e.preventDefault()
    setTotpError('')
    totpDisableMutation.mutate(disablePassword)
  }

  function copySecret() {
    if (totpData?.secret) {
      navigator.clipboard.writeText(totpData.secret)
      setSecretCopied(true)
      setTimeout(() => setSecretCopied(false), 2000)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Profile Info */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Profile Information</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Email</dt>
            <dd className="mt-1 text-sm text-slate-900">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Username</dt>
            <dd className="mt-1 text-sm text-slate-900">{user?.username}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Full Name</dt>
            <dd className="mt-1 text-sm text-slate-900">{user?.full_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Role</dt>
            <dd className="mt-1">
              <Badge variant={user?.role === 'admin' ? 'indigo' : user?.role === 'operator' ? 'blue' : 'gray'}>
                {user?.role}
              </Badge>
            </dd>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Change Password</h3>
        {pwError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
            {pwSuccess}
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                required
                value={pwForm.current_password}
                onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                required
                minLength={6}
                value={pwForm.new_password}
                onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={changePwMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {changePwMutation.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-slate-500" />
            <h3 className="text-base font-semibold text-slate-900">Two-Factor Authentication</h3>
          </div>
          <Badge variant={user?.totp_enabled ? 'green' : 'gray'}>
            {user?.totp_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        {totpError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {totpError}
          </div>
        )}
        {totpSuccess && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
            {totpSuccess}
          </div>
        )}

        {/* TOTP not enabled — show enable button or setup flow */}
        {!user?.totp_enabled && totpStep === null && (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Add an extra layer of security to your account by enabling two-factor authentication
              with an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
            </p>
            <button
              onClick={handleTotpSetup}
              disabled={totpSetupMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              {totpSetupMutation.isPending ? 'Setting up...' : 'Enable Two-Factor Authentication'}
            </button>
          </div>
        )}

        {/* TOTP setup — loading */}
        {totpStep === 'setup' && !totpData && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span className="text-sm text-slate-500">Generating QR code...</span>
          </div>
        )}

        {/* TOTP verify — show QR code and verification input */}
        {totpStep === 'verify' && totpData && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              Scan this QR code with your authenticator app, then enter the 6-digit code to verify.
            </p>

            <div className="flex flex-col items-center gap-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <img
                  src={`data:image/png;base64,${totpData.qr_base64}`}
                  alt="TOTP QR Code"
                  className="h-48 w-48"
                />
              </div>

              <div className="w-full max-w-sm">
                <p className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Manual entry key
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-xs font-mono text-slate-700 select-all break-all">
                    {totpData.secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    title="Copy secret"
                  >
                    {secretCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <form onSubmit={handleTotpVerify} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 font-mono text-center text-lg tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTotpStep(null)
                    setTotpData(null)
                    setTotpCode('')
                    setTotpError('')
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={totpVerifyMutation.isPending || totpCode.length !== 6}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {totpVerifyMutation.isPending ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TOTP enabled — show disable option */}
        {user?.totp_enabled && totpStep === null && (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Two-factor authentication is active on your account. You will be asked for a code
              from your authenticator app when signing in.
            </p>
            <button
              onClick={() => {
                setTotpStep('disable')
                setTotpError('')
                setTotpSuccess('')
                setDisablePassword('')
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
            >
              <ShieldOff className="h-4 w-4" />
              Disable Two-Factor Authentication
            </button>
          </div>
        )}

        {/* TOTP disable — confirm with password */}
        {totpStep === 'disable' && (
          <form onSubmit={handleTotpDisable} className="space-y-4">
            <p className="text-sm text-slate-600">
              Enter your current password to disable two-factor authentication.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
              <input
                type="password"
                required
                autoFocus
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setTotpStep(null)
                  setDisablePassword('')
                  setTotpError('')
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={totpDisableMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {totpDisableMutation.isPending ? 'Disabling...' : 'Disable 2FA'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
