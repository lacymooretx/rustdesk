import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
import Badge from '../components/Badge'
import Modal from '../components/Modal'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const SETTING_SECTIONS = [
  {
    label: 'Connections',
    settings: [
      { key: 'allow_incoming', label: 'Allow incoming connections', type: 'toggle', default: true },
      { key: 'allow_outgoing', label: 'Allow outgoing connections', type: 'toggle', default: true },
    ],
  },
  {
    label: 'Permissions',
    settings: [
      { key: 'allow_file_transfer', label: 'Allow file transfer', type: 'toggle', default: true },
      { key: 'allow_clipboard', label: 'Allow clipboard sharing', type: 'toggle', default: true },
      { key: 'allow_audio', label: 'Allow audio', type: 'toggle', default: true },
      { key: 'allow_tcp_tunnel', label: 'Allow TCP tunneling', type: 'toggle', default: true },
    ],
  },
  {
    label: 'Security',
    settings: [
      { key: 'require_password', label: 'Require password for connections', type: 'toggle', default: false },
      { key: 'lock_after_disconnect', label: 'Lock screen after disconnect', type: 'toggle', default: false },
    ],
  },
  {
    label: 'Display',
    settings: [
      { key: 'show_remote_cursor', label: 'Show remote cursor', type: 'toggle', default: true },
      { key: 'show_quality_monitor', label: 'Show quality monitor', type: 'toggle', default: false },
    ],
  },
  {
    label: 'Server',
    settings: [
      { key: 'custom_rendezvous_server', label: 'Custom rendezvous server', type: 'text', default: '' },
      { key: 'custom_relay_server', label: 'Custom relay server', type: 'text', default: '' },
    ],
  },
]

const targetTypeBadge = {
  device: 'blue',
  user: 'indigo',
  device_group: 'green',
}

const targetTypeLabels = {
  device: 'Device',
  user: 'User',
  device_group: 'Device Group',
}

export default function StrategyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ target_type: 'device', target_id: '', priority: 0 })
  const [formError, setFormError] = useState('')

  const { data: strategy, isLoading, error } = useQuery({
    queryKey: ['strategy', id],
    queryFn: () => api.get(`/strategies/${id}`).then((r) => r.data),
  })

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['strategyAssignments', id],
    queryFn: () =>
      api.get(`/strategies/${id}/assignments`).then((r) => r.data.assignments || r.data || []),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data.users || r.data || []),
    enabled: addOpen && addForm.target_type === 'user',
  })

  const { data: deviceGroups } = useQuery({
    queryKey: ['deviceGroups'],
    queryFn: () => api.get('/device-groups').then((r) => r.data.groups || r.data || []),
    enabled: addOpen && addForm.target_type === 'device_group',
  })

  const addMutation = useMutation({
    mutationFn: (payload) => api.post(`/strategies/${id}/assignments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategyAssignments', id] })
      queryClient.invalidateQueries({ queryKey: ['strategy', id] })
      setAddOpen(false)
      setAddForm({ target_type: 'device', target_id: '', priority: 0 })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to add assignment.')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (assignmentId) =>
      api.delete(`/strategies/${id}/assignments/${assignmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategyAssignments', id] })
      queryClient.invalidateQueries({ queryKey: ['strategy', id] })
    },
  })

  function handleAdd(e) {
    e.preventDefault()
    setFormError('')
    addMutation.mutate({
      target_type: addForm.target_type,
      target_id: addForm.target_id,
      priority: Number(addForm.priority) || 0,
    })
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
        <p className="text-sm text-red-700">Failed to load strategy.</p>
        <button
          onClick={() => navigate('/strategies')}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Back to strategies
        </button>
      </div>
    )
  }

  const settings = strategy?.settings || {}

  const assignmentColumns = [
    {
      key: 'target_type',
      label: 'Target Type',
      render: (row) => (
        <Badge variant={targetTypeBadge[row.target_type] || 'gray'}>
          {targetTypeLabels[row.target_type] || row.target_type}
        </Badge>
      ),
    },
    {
      key: 'target',
      label: 'Target',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.target_name || row.target_id}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row) => (
        <span className="font-mono text-sm">{row.priority ?? 0}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          onClick={() => removeMutation.mutate(row.id)}
          disabled={removeMutation.isPending}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remove assignment"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/strategies')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Strategies
      </button>

      {/* Strategy info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">{strategy?.name}</h2>
          {strategy?.description && (
            <p className="mt-1 text-sm text-slate-500">{strategy.description}</p>
          )}
        </div>

        {/* Settings display */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SETTING_SECTIONS.map((section) => (
            <div key={section.label}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {section.label}
              </h4>
              <div className="space-y-1.5">
                {section.settings.map((s) => {
                  const value = settings[s.key]
                  if (s.type === 'toggle') {
                    const enabled = value !== undefined ? !!value : s.default
                    return (
                      <div key={s.key} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-600">{s.label}</span>
                        <Badge variant={enabled ? 'green' : 'red'}>
                          {enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    )
                  }
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-600">{s.label}</span>
                      <span className="font-mono text-xs text-slate-700">
                        {value || '-'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Assignments section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Assignments ({(assignments || []).length})
          </h3>
          <button
            onClick={() => {
              setAddForm({ target_type: 'device', target_id: '', priority: 0 })
              setFormError('')
              setAddOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Assignment
          </button>
        </div>

        <Table
          columns={assignmentColumns}
          data={assignments || []}
          loading={assignmentsLoading}
          emptyMessage="No assignments yet."
        />
      </div>

      {/* Add assignment modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Assignment"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Target Type</label>
            <select
              value={addForm.target_type}
              onChange={(e) =>
                setAddForm({ ...addForm, target_type: e.target.value, target_id: '' })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="device">Device</option>
              <option value="user">User</option>
              <option value="device_group">Device Group</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Target</label>
            {addForm.target_type === 'device' && (
              <input
                type="text"
                required
                value={addForm.target_id}
                onChange={(e) => setAddForm({ ...addForm, target_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Enter device ID"
              />
            )}
            {addForm.target_type === 'user' && (
              <select
                required
                value={addForm.target_id}
                onChange={(e) => setAddForm({ ...addForm, target_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select user...</option>
                {(users || []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.username} ({u.username})
                  </option>
                ))}
              </select>
            )}
            {addForm.target_type === 'device_group' && (
              <select
                required
                value={addForm.target_id}
                onChange={(e) => setAddForm({ ...addForm, target_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Select device group...</option>
                {(deviceGroups || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
            <input
              type="number"
              value={addForm.priority}
              onChange={(e) => setAddForm({ ...addForm, priority: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="0"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addMutation.isPending ? 'Adding...' : 'Add Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
