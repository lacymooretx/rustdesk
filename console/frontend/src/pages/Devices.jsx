import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Eye, Monitor, ToggleLeft, ToggleRight, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
import Badge from '../components/Badge'
import Modal from '../components/Modal'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  // Ensure plain date strings (no timezone) are treated as UTC
  let str = dateStr
  if (!str.endsWith('Z') && !str.includes('+') && !/\d{2}:\d{2}$/.test(str.slice(-6))) {
    str = str.replace(' ', 'T') + 'Z'
  }
  const d = new Date(str)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const PAGE_SIZE = 20

export default function Devices() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('id')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['devices', { page, sort: sortKey, order: sortDir, search }],
    queryFn: () =>
      api
        .get('/devices', {
          params: {
            page,
            per_page: PAGE_SIZE,
            sort_by: sortKey,
            sort_order: sortDir,
            q: search || undefined,
          },
        })
        .then((r) => r.data),
    keepPreviousData: true,
  })

  const devices = useMemo(() => {
    if (!rawData) return []
    return rawData.devices || []
  }, [rawData])

  const totalPages = useMemo(() => {
    if (!rawData) return 1
    return rawData.pages || 1
  }, [rawData])

  const toggleMutation = useMutation({
    mutationFn: ({ id, currentStatus }) =>
      api.patch(`/devices/${id}`, { status: currentStatus !== 1 ? 1 : 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setDeleteTarget(null)
    },
  })

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const columns = [
    { key: 'id', label: 'ID', sortable: true },
    {
      key: 'ip',
      label: 'IP Address',
      sortable: false,
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.info?.ip || '-'}
        </span>
      ),
    },
    {
      key: 'user',
      label: 'User',
      sortable: false,
      render: (row) => row.user || '-',
    },
    {
      key: 'hostname',
      label: 'Hostname',
      sortable: false,
      render: (row) => row.info?.hostname || '-',
    },
    {
      key: 'os',
      label: 'Platform',
      sortable: false,
      render: (row) => row.info?.platform || row.info?.os || '-',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={row.status !== 1 ? 'green' : 'red'}>
          {row.status !== 1 ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'online',
      label: 'Online',
      sortable: false,
      render: (row) => (
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            row.online ? 'bg-emerald-500' : 'border border-slate-300 bg-slate-200'
          }`}
          title={row.online ? 'Online' : 'Offline'}
        />
      ),
    },
    {
      key: 'last_seen',
      label: 'Last Seen',
      sortable: true,
      render: (row) => formatDate(row.last_seen || row.created_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.online && (
            <button
              onClick={() => window.open(`rustdesk://connection/new/${row.id}`, '_self')}
              className="rounded-md p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
              title="Remote connect"
            >
              <Monitor className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => navigate(`/devices/${row.id}`)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() =>
              toggleMutation.mutate({ id: row.id, currentStatus: row.status })
            }
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600 transition-colors"
            title={row.status !== 1 ? 'Disable' : 'Enable'}
          >
            {row.status !== 1 ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete device"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, IP, note, or user..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={devices}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        loading={isLoading}
        emptyMessage="No devices found."
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

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Device"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete device{' '}
            <span className="font-semibold text-slate-900">{deleteTarget?.id}</span>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
