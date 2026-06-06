import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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

const permissionBadgeVariant = {
  view: 'blue',
  control: 'yellow',
  full: 'green',
}

const emptyForm = {
  user_group_id: '',
  device_group_id: '',
  permission: 'view',
}

export default function AccessRules() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [createForm, setCreateForm] = useState({ ...emptyForm })
  const [editForm, setEditForm] = useState({ permission: 'view' })
  const [formError, setFormError] = useState('')

  const { data: rules, isLoading } = useQuery({
    queryKey: ['accessRules'],
    queryFn: () => api.get('/access-rules').then((r) => r.data.rules || r.data || []),
  })

  const { data: userGroups } = useQuery({
    queryKey: ['userGroups'],
    queryFn: () => api.get('/user-groups').then((r) => r.data.groups || r.data || []),
  })

  const { data: deviceGroups } = useQuery({
    queryKey: ['deviceGroups'],
    queryFn: () => api.get('/device-groups').then((r) => r.data.groups || r.data || []),
  })

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/access-rules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessRules'] })
      setCreateOpen(false)
      setCreateForm({ ...emptyForm })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to create access rule.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/access-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessRules'] })
      setEditTarget(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update access rule.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/access-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessRules'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(rule) {
    setEditForm({ permission: rule.permission || 'view' })
    setEditTarget(rule)
    setFormError('')
  }

  function handleCreate(e) {
    e.preventDefault()
    setFormError('')
    createMutation.mutate(createForm)
  }

  function handleUpdate(e) {
    e.preventDefault()
    setFormError('')
    updateMutation.mutate({ id: editTarget.id, data: editForm })
  }

  // Lookup helpers for group names
  function getUserGroupName(groupId) {
    const g = (userGroups || []).find((ug) => ug.id === groupId)
    return g?.name || groupId
  }

  function getDeviceGroupName(groupId) {
    const g = (deviceGroups || []).find((dg) => dg.id === groupId)
    return g?.name || groupId
  }

  const columns = [
    {
      key: 'user_group',
      label: 'User Group',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.user_group_name || getUserGroupName(row.user_group_id)}
        </span>
      ),
    },
    {
      key: 'device_group',
      label: 'Device Group',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.device_group_name || getDeviceGroupName(row.device_group_id)}
        </span>
      ),
    },
    {
      key: 'permission',
      label: 'Permission',
      render: (row) => (
        <Badge variant={permissionBadgeVariant[row.permission] || 'gray'}>
          {row.permission || 'view'}
        </Badge>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {(rules || []).length} access rule{(rules || []).length !== 1 ? 's' : ''}
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

      {/* Table */}
      <Table
        columns={columns}
        data={rules || []}
        loading={isLoading}
        emptyMessage="No access rules configured."
      />

      {/* Create rule modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Access Rule"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">User Group</label>
            <select
              required
              value={createForm.user_group_id}
              onChange={(e) => setCreateForm({ ...createForm, user_group_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Select user group...</option>
              {(userGroups || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Device Group</label>
            <select
              required
              value={createForm.device_group_id}
              onChange={(e) => setCreateForm({ ...createForm, device_group_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Select device group...</option>
              {(deviceGroups || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Permission</label>
            <select
              value={createForm.permission}
              onChange={(e) => setCreateForm({ ...createForm, permission: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="view">View</option>
              <option value="control">Control</option>
              <option value="full">Full</option>
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
              {createMutation.isPending ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit rule modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Access Rule"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">
              <span className="font-medium text-slate-700">
                {editTarget?.user_group_name || getUserGroupName(editTarget?.user_group_id)}
              </span>
              {' -> '}
              <span className="font-medium text-slate-700">
                {editTarget?.device_group_name || getDeviceGroupName(editTarget?.device_group_id)}
              </span>
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Permission</label>
            <select
              value={editForm.permission}
              onChange={(e) => setEditForm({ ...editForm, permission: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="view">View</option>
              <option value="control">Control</option>
              <option value="full">Full</option>
            </select>
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
        title="Delete Access Rule"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this access rule? This action cannot be undone.
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
