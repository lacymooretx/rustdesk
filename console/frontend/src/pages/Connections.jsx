import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, Radio, List } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
import Badge from '../components/Badge'

const PAGE_SIZE = 25

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '-'
  const s = Math.floor(seconds)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return `${m}m ${rs}s`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h ${rm}m`
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const eventTypeBadge = {
  connect: 'green',
  disconnect: 'red',
  file_transfer: 'blue',
}

const eventTypeOptions = [
  { value: '', label: 'All Events' },
  { value: 'connect', label: 'Connect' },
  { value: 'disconnect', label: 'Disconnect' },
  { value: 'file_transfer', label: 'File Transfer' },
]

function ConnectionLog() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['connections', { page, device_id: search, event_type: eventType, date_from: dateFrom, date_to: dateTo }],
    queryFn: () =>
      api
        .get('/connections', {
          params: {
            page,
            per_page: PAGE_SIZE,
            device_id: search || undefined,
            event_type: eventType || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
          },
        })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  const events = useMemo(() => {
    if (!rawData) return []
    return rawData.events || []
  }, [rawData])

  const totalPages = useMemo(() => {
    if (!rawData) return 1
    return rawData.pages || 1
  }, [rawData])

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      render: (row) => (
        <span className="text-slate-500 tabular-nums">
          {formatDate(row.timestamp || row.created_at)}
        </span>
      ),
    },
    {
      key: 'session_id',
      label: 'Session ID',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600" title={row.session_id}>
          {row.session_id ? row.session_id.slice(0, 12) + '...' : '-'}
        </span>
      ),
    },
    {
      key: 'device_id',
      label: 'Device',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.device_id || '-'}</span>
      ),
    },
    {
      key: 'peer_id',
      label: 'Peer',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.peer_id || '-'}</span>
      ),
    },
    {
      key: 'event_type',
      label: 'Type',
      render: (row) => (
        <Badge variant={eventTypeBadge[row.event_type] || 'gray'}>
          {row.event_type || '-'}
        </Badge>
      ),
    },
    {
      key: 'user_host',
      label: 'User / Host',
      render: (row) => (
        <span className="text-slate-600 text-sm">
          {row.peer_username || '-'} / {row.peer_hostname || '-'}
        </span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (row) => (
        <span className="text-slate-500 tabular-nums">
          {row.event_type === 'disconnect' ? formatDuration(row.duration_seconds) : '-'}
        </span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP Address',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {row.ip_address || '-'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by device ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Event Type</label>
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            {eventTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={events}
        loading={isLoading}
        emptyMessage="No connection events found."
      />

      {/* File transfer info rows */}
      {events.some((e) => e.event_type === 'file_transfer') && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">File Transfer Details</h4>
          <div className="space-y-1">
            {events
              .filter((e) => e.event_type === 'file_transfer')
              .map((e) => (
                <div key={e.id || e.session_id} className="flex items-center gap-4 text-sm text-slate-600">
                  <span className="font-mono text-xs text-slate-400">{e.session_id ? e.session_id.slice(0, 12) : '-'}</span>
                  <span className="font-medium">{e.file_name || 'unknown file'}</span>
                  <span className="text-slate-400">{formatFileSize(e.file_size)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActiveSessions() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['connectionsActive'],
    queryFn: () => api.get('/connections/active').then((r) => r.data),
    refetchInterval: 30000,
  })

  const sessionList = useMemo(() => {
    if (!sessions) return []
    return Array.isArray(sessions) ? sessions : sessions.sessions || []
  }, [sessions])

  const columns = [
    {
      key: 'device_id',
      label: 'Device',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.device_id || '-'}</span>
      ),
    },
    {
      key: 'peer_id',
      label: 'Peer',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.peer_id || '-'}</span>
      ),
    },
    {
      key: 'user_host',
      label: 'User / Host',
      render: (row) => (
        <span className="text-slate-600 text-sm">
          {row.peer_username || '-'} / {row.peer_hostname || '-'}
        </span>
      ),
    },
    {
      key: 'ip_address',
      label: 'IP Address',
      render: (row) => (
        <span className="font-mono text-xs text-slate-500">
          {row.ip_address || '-'}
        </span>
      ),
    },
    {
      key: 'connected_at',
      label: 'Connected At',
      render: (row) => (
        <span className="text-slate-500">{relativeTime(row.connected_at)}</span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (row) => {
        if (!row.connected_at) return <span className="text-slate-400">-</span>
        const seconds = Math.floor((Date.now() - new Date(row.connected_at).getTime()) / 1000)
        return <span className="text-slate-500 tabular-nums">{formatDuration(seconds)}</span>
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {sessionList.length} active session{sessionList.length !== 1 ? 's' : ''}
          <span className="ml-2 text-xs text-slate-400">(auto-refreshes every 30s)</span>
        </p>
      </div>

      <Table
        columns={columns}
        data={sessionList}
        loading={isLoading}
        emptyMessage="No active sessions."
      />
    </div>
  )
}

export default function Connections() {
  const [activeTab, setActiveTab] = useState('log')

  const tabs = [
    { key: 'log', label: 'Connection Log', icon: List },
    { key: 'active', label: 'Active Sessions', icon: Radio },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-b-2 border-indigo-500 bg-white text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'log' && <ConnectionLog />}
      {activeTab === 'active' && <ActiveSessions />}
    </div>
  )
}
