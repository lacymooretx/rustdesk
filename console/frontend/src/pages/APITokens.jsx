import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Copy, Check, AlertTriangle } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
import Modal from '../components/Modal'
import Badge from '../components/Badge'

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

const expiryOptions = [
  { value: '', label: 'Never' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
]

export default function APITokens() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [createdToken, setCreatedToken] = useState(null)
  const [copied, setCopied] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', scopes: '', expires_in_days: '' })
  const [editForm, setEditForm] = useState({ name: '', scopes: '', is_active: true })
  const [formError, setFormError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['apiTokens'],
    queryFn: () => api.get('/api-tokens').then((r) => r.data),
  })

  const tokens = data?.tokens || []
  const total = data?.total || 0

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/api-tokens', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['apiTokens'] })
      setCreateOpen(false)
      setCreateForm({ name: '', scopes: '', expires_in_days: '' })
      setFormError('')
      setCreatedToken(res.data.plaintext_token)
      setCopied(false)
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to create API token.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }) => api.patch(`/api-tokens/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiTokens'] })
      setEditTarget(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update API token.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/api-tokens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiTokens'] })
      setDeleteTarget(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/api-tokens/${id}`, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiTokens'] })
    },
  })

  function openEdit(token) {
    setEditForm({
      name: token.name || '',
      scopes: token.scopes || '',
      is_active: token.is_active,
    })
    setEditTarget(token)
    setFormError('')
  }

  function handleCreate(e) {
    e.preventDefault()
    setFormError('')
    const payload = {
      name: createForm.name,
      scopes: createForm.scopes || null,
      expires_in_days: createForm.expires_in_days ? parseInt(createForm.expires_in_days, 10) : null,
    }
    createMutation.mutate(payload)
  }

  function handleUpdate(e) {
    e.preventDefault()
    setFormError('')
    updateMutation.mutate({
      id: editTarget.id,
      data: {
        name: editForm.name,
        scopes: editForm.scopes || null,
        is_active: editForm.is_active,
      },
    })
  }

  function handleCopy() {
    if (createdToken) {
      navigator.clipboard.writeText(createdToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
      key: 'token_prefix',
      label: 'Prefix',
      render: (row) => (
        <span className="font-mono text-sm text-slate-600">{row.token_prefix}...</span>
      ),
    },
    {
      key: 'scopes',
      label: 'Scopes',
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.scopes ? row.scopes : <span className="text-slate-400 italic">all</span>}
        </span>
      ),
    },
    {
      key: 'expires_at',
      label: 'Expires',
      render: (row) => {
        if (!row.expires_at) return <span className="text-slate-400">Never</span>
        const expired = new Date(row.expires_at) < new Date()
        return (
          <span className={expired ? 'text-red-600' : 'text-slate-600'}>
            {formatDate(row.expires_at)}
            {expired && ' (expired)'}
          </span>
        )
      },
    },
    {
      key: 'last_used_at',
      label: 'Last Used',
      render: (row) => (
        <span className="text-sm text-slate-500">{formatDate(row.last_used_at)}</span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'green' : 'red'}>
          {row.is_active ? 'Active' : 'Revoked'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleMutation.mutate({ id: row.id, is_active: !row.is_active })}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              row.is_active
                ? 'text-red-600 hover:bg-red-50'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
            title={row.is_active ? 'Revoke token' : 'Activate token'}
          >
            {row.is_active ? 'Revoke' : 'Activate'}
          </button>
          <button
            onClick={() => openEdit(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            title="Edit token"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete token"
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
          {total} token{total !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => {
            setCreateForm({ name: '', scopes: '', expires_in_days: '' })
            setFormError('')
            setCreateOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Token
        </button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={tokens}
        loading={isLoading}
        emptyMessage="No API tokens created yet."
      />

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create API Token"
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
              placeholder="e.g. ImmyBot Integration"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Scopes</label>
            <input
              type="text"
              value={createForm.scopes}
              onChange={(e) => setCreateForm({ ...createForm, scopes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="e.g. devices:read,devices:write,connections:read"
            />
            <p className="mt-1 text-xs text-slate-400">Comma-separated scopes. Leave empty for full access.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Expiry</label>
            <select
              value={createForm.expires_in_days}
              onChange={(e) => setCreateForm({ ...createForm, expires_in_days: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              {expiryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
              {createMutation.isPending ? 'Creating...' : 'Create Token'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Token created dialog */}
      <Modal
        open={!!createdToken}
        onClose={() => setCreatedToken(null)}
        title="Token Created"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              This token will only be shown once. Copy it now and store it securely.
            </p>
          </div>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={createdToken || ''}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 pr-20 font-mono text-sm text-slate-700"
            />
            <button
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-md bg-white border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setCreatedToken(null)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit API Token"
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Scopes</label>
            <input
              type="text"
              value={editForm.scopes}
              onChange={(e) => setEditForm({ ...editForm, scopes: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="e.g. devices:read,devices:write"
            />
            <p className="mt-1 text-xs text-slate-400">Comma-separated scopes. Leave empty for full access.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Active</label>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                editForm.is_active ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  editForm.is_active ? 'translate-x-5' : 'translate-x-0'
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
        title="Delete API Token"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete the token{' '}
            <span className="font-medium text-slate-900">{deleteTarget?.name}</span>? Any
            integrations using this token will stop working immediately.
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
