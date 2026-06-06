import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Monitor,
  Key,
  Fingerprint,
  Calendar,
  Save,
  ToggleLeft,
  ToggleRight,
  Wifi,
  Clock,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import api from '../services/api'
import Badge from '../components/Badge'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function relativeTime(dateStr) {
  if (!dateStr) return '-'
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  return formatDate(dateStr)
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm text-slate-900 break-all">{value || '-'}</p>
      </div>
    </div>
  )
}

export default function DeviceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState('')
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const { data: device, isLoading, error } = useQuery({
    queryKey: ['device', id],
    queryFn: () =>
      api.get(`/devices/${id}`).then((r) => {
        const d = r.data
        if (!notesLoaded) {
          setNotes(d.note || '')
          setNotesLoaded(true)
        }
        return d
      }),
  })

  const toggleMutation = useMutation({
    mutationFn: () =>
      api.patch(`/devices/${id}`, { status: device?.status !== 1 ? 1 : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })

  const notesMutation = useMutation({
    mutationFn: () => api.patch(`/devices/${id}`, { note: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] })
    },
  })

  const passwordMutation = useMutation({
    mutationFn: (password) => api.patch(`/devices/${id}`, { managed_password: password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setEditingPassword(false)
      setNewPassword('')
    },
  })

  const copyPassword = () => {
    if (device?.managed_password) {
      navigator.clipboard.writeText(device.managed_password)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">
          Failed to load device. It may have been deleted.
        </p>
        <button
          onClick={() => navigate('/devices')}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Back to devices
        </button>
      </div>
    )
  }

  const info = device?.info || {}
  const isEnabled = device?.status !== 1

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/devices')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Devices
        </button>
        <div className="flex items-center gap-3">
          {device?.online && (
            <button
              onClick={() => window.open(`rustdesk://connection/new/${device.id}`, '_self')}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              title="Remote connect"
            >
              <Monitor className="h-4 w-4" />
              Connect
            </button>
          )}
        <button
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${
            isEnabled
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {isEnabled ? (
            <>
              <ToggleLeft className="h-4 w-4" />
              Disable Device
            </>
          ) : (
            <>
              <ToggleRight className="h-4 w-4" />
              Enable Device
            </>
          )}
        </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — device info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Device info card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Device Information
              </h2>
              <Badge variant={isEnabled ? 'green' : 'red'}>
                {isEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <div className="divide-y divide-slate-100">
              <InfoRow icon={Monitor} label="Device ID" value={device?.id} />
              <InfoRow icon={Monitor} label="Hostname" value={info.hostname} />
              <InfoRow icon={Monitor} label="Username" value={info.username} />
              <InfoRow icon={Monitor} label="Operating System" value={info.os} />
              <div className="flex items-start gap-3 py-3 border-b border-slate-100">
                <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Online Status</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        device?.online ? 'bg-emerald-500' : 'border border-slate-300 bg-slate-200'
                      }`}
                    />
                    <span className="text-sm text-slate-900">
                      {device?.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
              <InfoRow
                icon={Clock}
                label="Last Seen"
                value={device?.last_seen ? relativeTime(device.last_seen) : '-'}
              />
              <InfoRow icon={Fingerprint} label="UUID" value={device?.uuid} />
              <InfoRow icon={Key} label="Public Key" value={device?.pk} />
              <InfoRow icon={Calendar} label="Created" value={formatDate(device?.created_at)} />
              <InfoRow
                icon={Calendar}
                label="Registered"
                value={formatDate(device?.created_at)}
              />
            </div>
          </div>

          {/* Notes card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this device..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => notesMutation.mutate()}
                disabled={notesMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                {notesMutation.isPending ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
            {notesMutation.isSuccess && (
              <p className="mt-2 text-right text-xs text-emerald-600">Notes saved successfully.</p>
            )}
          </div>
        </div>

        {/* Right column — quick info */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Quick Info
            </h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs text-slate-400">Device ID</dt>
                <dd className="mt-0.5 text-lg font-bold text-slate-900 font-mono">{device?.id}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Status</dt>
                <dd className="mt-1">
                  <Badge variant={isEnabled ? 'green' : 'red'}>
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Hostname</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-700">
                  {info.hostname || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">OS</dt>
                <dd className="mt-0.5 text-sm text-slate-700">{info.os || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Online</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      device?.online ? 'bg-emerald-500' : 'border border-slate-300 bg-slate-200'
                    }`}
                  />
                  <span className="text-sm text-slate-700">
                    {device?.online ? 'Online' : 'Offline'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Last Seen</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {device?.last_seen ? relativeTime(device.last_seen) : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Managed Password
                </dt>
                <dd className="mt-1">
                  {device?.managed_password ? (
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {showPassword ? device.managed_password : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                      </code>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title={showPassword ? 'Hide' : 'Show'}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={copyPassword}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Copy password"
                      >
                        {passwordCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Not set</span>
                  )}
                  {!editingPassword ? (
                    <button
                      onClick={() => { setEditingPassword(true); setNewPassword(device?.managed_password || '') }}
                      className="mt-1 text-xs text-indigo-600 hover:text-indigo-500"
                    >
                      {device?.managed_password ? 'Change' : 'Set password'}
                    </button>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                      />
                      <button
                        onClick={() => passwordMutation.mutate(newPassword)}
                        disabled={passwordMutation.isPending || !newPassword}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingPassword(false); setNewPassword('') }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Registered</dt>
                <dd className="mt-0.5 text-sm text-slate-700">
                  {formatDate(device?.created_at)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
