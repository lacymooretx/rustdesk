import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
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

function getDefaultSettings() {
  const defaults = {}
  SETTING_SECTIONS.forEach((section) => {
    section.settings.forEach((s) => {
      defaults[s.key] = s.default
    })
  })
  return defaults
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        value ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SettingsEditor({ settings, onChange }) {
  function updateSetting(key, value) {
    onChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-5">
      {SETTING_SECTIONS.map((section) => (
        <div key={section.label}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {section.label}
          </h4>
          <div className="space-y-3">
            {section.settings.map((s) =>
              s.type === 'toggle' ? (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-700">{s.label}</span>
                  <Toggle
                    value={!!settings[s.key]}
                    onChange={(v) => updateSetting(s.key, v)}
                  />
                </div>
              ) : (
                <div key={s.key}>
                  <label className="mb-1 block text-sm text-slate-700">{s.label}</label>
                  <input
                    type="text"
                    value={settings[s.key] || ''}
                    onChange={(e) => updateSetting(s.key, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder={s.label}
                  />
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

const emptyForm = {
  name: '',
  description: '',
  settings: getDefaultSettings(),
}

export default function Strategies() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [createForm, setCreateForm] = useState({ ...emptyForm, settings: { ...emptyForm.settings } })
  const [editForm, setEditForm] = useState({ name: '', description: '', settings: {} })
  const [formError, setFormError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => api.get('/strategies').then((r) => r.data),
  })

  const strategies = data?.strategies || data || []

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/strategies', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setCreateOpen(false)
      setCreateForm({ ...emptyForm, settings: { ...emptyForm.settings } })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to create strategy.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }) => api.patch(`/strategies/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setEditTarget(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update strategy.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/strategies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(strategy) {
    const merged = { ...getDefaultSettings(), ...(strategy.settings || {}) }
    setEditForm({
      name: strategy.name || '',
      description: strategy.description || '',
      settings: merged,
    })
    setEditTarget(strategy)
    setFormError('')
  }

  function handleCreate(e) {
    e.preventDefault()
    setFormError('')
    createMutation.mutate({
      name: createForm.name,
      description: createForm.description,
      settings: createForm.settings,
    })
  }

  function handleUpdate(e) {
    e.preventDefault()
    setFormError('')
    updateMutation.mutate({
      id: editTarget.id,
      data: {
        name: editForm.name,
        description: editForm.description,
        settings: editForm.settings,
      },
    })
  }

  function settingsCount(strategy) {
    if (!strategy.settings) return 0
    return Object.keys(strategy.settings).length
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <button
          onClick={() => navigate(`/strategies/${row.id}`)}
          className="font-medium text-indigo-600 hover:text-indigo-500"
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => (
        <span className="text-slate-600">{row.description || '-'}</span>
      ),
    },
    {
      key: 'settings_count',
      label: 'Settings',
      render: (row) => (
        <span className="font-mono text-sm">{settingsCount(row)}</span>
      ),
    },
    {
      key: 'assignments',
      label: 'Assignments',
      render: (row) => (
        <span className="text-sm">{row.assignment_count ?? row.assignments_count ?? '-'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            title="Edit strategy"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete strategy"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {strategies.length} strateg{strategies.length !== 1 ? 'ies' : 'y'}
        </p>
        <button
          onClick={() => {
            setCreateForm({ ...emptyForm, settings: { ...getDefaultSettings() } })
            setFormError('')
            setCreateOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Strategy
        </button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={strategies}
        loading={isLoading}
        emptyMessage="No strategies configured."
      />

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Strategy"
        wide
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              type="text"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Strategy name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Settings</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <SettingsEditor
                settings={createForm.settings}
                onChange={(s) => setCreateForm({ ...createForm, settings: s })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Strategy'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Strategy"
        wide
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Settings</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <SettingsEditor
                settings={editForm.settings}
                onChange={(s) => setEditForm({ ...editForm, settings: s })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Strategy"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <span className="font-medium text-slate-900">{deleteTarget?.name}</span>? This action
            cannot be undone.
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
