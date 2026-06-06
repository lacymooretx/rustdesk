import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Send } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'

const eventTypeOptions = [
  { value: 'new_device', label: 'New Device' },
  { value: 'device_offline', label: 'Device Offline' },
  { value: 'connection_started', label: 'Connection Started' },
  { value: 'connection_ended', label: 'Connection Ended' },
  { value: 'new_user', label: 'New User' },
]

function eventTypeLabel(value) {
  const opt = eventTypeOptions.find((o) => o.value === value)
  return opt ? opt.label : value
}

function eventTypeBadgeVariant(value) {
  const map = {
    new_device: 'blue',
    device_offline: 'red',
    connection_started: 'green',
    connection_ended: 'yellow',
    new_user: 'indigo',
  }
  return map[value] || 'gray'
}

const emptyForm = {
  name: '',
  event_type: 'new_device',
  recipients: '',
  enabled: true,
}

export default function Notifications() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [createForm, setCreateForm] = useState({ ...emptyForm })
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Fetch SMTP settings
  const { data: smtpData } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: () => api.get('/notifications/smtp-settings').then((r) => r.data),
  })

  // Fetch notification rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['notification-rules'],
    queryFn: () => api.get('/notifications/rules').then((r) => r.data),
  })

  const rules = rulesData?.rules || []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/notifications/rules', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
      setCreateOpen(false)
      setCreateForm({ ...emptyForm })
      setFormError('')
      showToast('Notification rule created.')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to create rule.')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }) => api.patch(`/notifications/rules/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
      setEditTarget(null)
      setFormError('')
      showToast('Notification rule updated.')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update rule.')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/notifications/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
      setDeleteTarget(null)
      showToast('Notification rule deleted.')
    },
  })

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (id) => api.post(`/notifications/test/${id}`),
    onSuccess: () => {
      showToast('Test email sent successfully.')
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to send test email.', 'error')
    },
  })

  function openEdit(rule) {
    setEditForm({
      name: rule.name || '',
      event_type: rule.event_type || 'new_device',
      recipients: rule.recipients || '',
      enabled: rule.enabled ?? true,
    })
    setEditTarget(rule)
    setFormError('')
  }

  function handleCreate(e) {
    e.preventDefault()
    setFormError('')
    createMutation.mutate({
      name: createForm.name,
      event_type: createForm.event_type,
      recipients: createForm.recipients,
      enabled: createForm.enabled,
    })
  }

  function handleUpdate(e) {
    e.preventDefault()
    setFormError('')
    updateMutation.mutate({
      id: editTarget.id,
      data: {
        name: editForm.name,
        event_type: editForm.event_type,
        recipients: editForm.recipients,
        enabled: editForm.enabled,
      },
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.name}</span>
      ),
    },
    {
      key: 'event_type',
      label: 'Event Type',
      render: (row) => (
        <Badge variant={eventTypeBadgeVariant(row.event_type)}>
          {eventTypeLabel(row.event_type)}
        </Badge>
      ),
    },
    {
      key: 'recipients',
      label: 'Recipients',
      render: (row) => (
        <span className="text-slate-600 max-w-[200px] truncate block" title={row.recipients}>
          {row.recipients}
        </span>
      ),
    },
    {
      key: 'enabled',
      label: 'Enabled',
      render: (row) => (
        <Badge variant={row.enabled ? 'green' : 'gray'}>
          {row.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => testMutation.mutate(row.id)}
            disabled={testMutation.isPending}
            className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Send test email"
          >
            <Send className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEdit(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            title="Edit rule"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete rule"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* SMTP Settings card */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-4">SMTP Settings</h3>
        <p className="mb-4 text-xs text-slate-500">
          SMTP settings are configured via environment variables.
        </p>
        {smtpData ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Host</dt>
              <dd className="mt-1 text-sm text-slate-900">{smtpData.smtp_host || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Port</dt>
              <dd className="mt-1 text-sm text-slate-900">{smtpData.smtp_port}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">From Email</dt>
              <dd className="mt-1 text-sm text-slate-900">{smtpData.smtp_from_email || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">From Name</dt>
              <dd className="mt-1 text-sm text-slate-900">{smtpData.smtp_from_name || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">TLS</dt>
              <dd className="mt-1">
                <Badge variant={smtpData.smtp_use_tls ? 'green' : 'gray'}>
                  {smtpData.smtp_use_tls ? 'Enabled' : 'Disabled'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">SMTP Status</dt>
              <dd className="mt-1">
                <Badge variant={smtpData.smtp_enabled ? 'green' : 'red'}>
                  {smtpData.smtp_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </dd>
            </div>
          </div>
        ) : (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="h-4 w-32 rounded bg-slate-200" />
          </div>
        )}
      </div>

      {/* Notification Rules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {rules.length} notification rule{rules.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => {
              setCreateForm({ ...emptyForm })
              setFormError('')
              setCreateOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Rule
          </button>
        </div>

        <Table
          columns={columns}
          data={rules}
          loading={isLoading}
          emptyMessage="No notification rules configured."
        />
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Notification Rule"
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
              placeholder="e.g., New Device Alert"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Event Type</label>
            <select
              value={createForm.event_type}
              onChange={(e) => setCreateForm({ ...createForm, event_type: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              {eventTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Recipients</label>
            <textarea
              required
              value={createForm.recipients}
              onChange={(e) => setCreateForm({ ...createForm, recipients: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
              placeholder="Comma-separated email addresses"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Enabled</label>
            <button
              type="button"
              onClick={() => setCreateForm({ ...createForm, enabled: !createForm.enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                createForm.enabled ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  createForm.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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
              {createMutation.isPending ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Notification Rule"
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Event Type</label>
            <select
              value={editForm.event_type}
              onChange={(e) => setEditForm({ ...editForm, event_type: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              {eventTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Recipients</label>
            <textarea
              required
              value={editForm.recipients}
              onChange={(e) => setEditForm({ ...editForm, recipients: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
              placeholder="Comma-separated email addresses"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Enabled</label>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, enabled: !editForm.enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                editForm.enabled ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  editForm.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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
        title="Delete Notification Rule"
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
