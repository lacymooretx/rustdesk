import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
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

const actionPrefixColors = {
  device: 'blue',
  user: 'indigo',
  device_group: 'green',
  user_group: 'yellow',
  access_rule: 'red',
  auth: 'gray',
}

function actionBadgeVariant(action) {
  if (!action) return 'gray'
  for (const [prefix, color] of Object.entries(actionPrefixColors)) {
    if (action.startsWith(prefix)) return color
  }
  return 'gray'
}

const actionTypeOptions = [
  { value: '', label: 'All Actions' },
  { value: 'device', label: 'device.*' },
  { value: 'user', label: 'user.*' },
  { value: 'device_group', label: 'device_group.*' },
  { value: 'user_group', label: 'user_group.*' },
  { value: 'access_rule', label: 'access_rule.*' },
  { value: 'auth', label: 'auth.*' },
]

const resourceTypeOptions = [
  { value: '', label: 'All Resources' },
  { value: 'device', label: 'Device' },
  { value: 'user', label: 'User' },
  { value: 'device_group', label: 'Device Group' },
  { value: 'user_group', label: 'User Group' },
  { value: 'access_rule', label: 'Access Rule' },
]

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['auditLogs', { page, action: actionFilter, resource_type: resourceFilter, date_from: dateFrom, date_to: dateTo, search }],
    queryFn: () =>
      api
        .get('/audit-logs', {
          params: {
            page,
            per_page: PAGE_SIZE,
            action: actionFilter || undefined,
            resource_type: resourceFilter || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            q: search || undefined,
          },
        })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  const logs = useMemo(() => {
    if (!rawData) return []
    return rawData.logs || []
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
      key: 'user_email',
      label: 'User',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.user_email || '-'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <Badge variant={actionBadgeVariant(row.action)}>
          {row.action || '-'}
        </Badge>
      ),
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.resource_type ? `${row.resource_type}:${row.resource_id || '-'}` : '-'}
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
      key: 'details',
      label: 'Details',
      render: (row) => {
        const details = typeof row.details === 'object' ? JSON.stringify(row.details) : row.details || ''
        const truncated = details.length > 60 ? details.slice(0, 60) + '...' : details
        return (
          <span className="text-slate-500 text-xs" title={details}>
            {truncated || '-'}
          </span>
        )
      },
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
            placeholder="Search by action keyword..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Action Type</label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            {actionTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Resource Type</label>
          <select
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            {resourceTypeOptions.map((opt) => (
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
        data={logs}
        loading={isLoading}
        emptyMessage="No audit log entries found."
      />

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
