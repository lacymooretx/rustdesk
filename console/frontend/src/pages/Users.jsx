import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
import Badge from '../components/Badge'
import Modal from '../components/Modal'

const roleBadgeVariant = {
  admin: 'red',
  operator: 'yellow',
  viewer: 'blue',
}

const emptyForm = {
  email: '',
  username: '',
  password: '',
  full_name: '',
  role: 'viewer',
}

function UserForm({ form, setForm, onSubmit, loading, isEdit = false }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="space-y-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          placeholder="user@example.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
        <input
          type="text"
          required
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          placeholder="jdoe"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {isEdit ? 'Password (leave blank to keep)' : 'Password'}
        </label>
        <input
          type="password"
          required={!isEdit}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          placeholder={isEdit ? 'Leave blank to keep current' : 'Enter password'}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          placeholder="John Doe"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="viewer">Viewer</option>
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
        </button>
      </div>
    </form>
  )
}

export default function Users() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [createForm, setCreateForm] = useState({ ...emptyForm })
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [formError, setFormError] = useState('')

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () =>
      api.get('/users').then((r) => r.data.users || []),
  })

  const users = rawData || []

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setCreateForm({ ...emptyForm })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to create user.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditTarget(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update user.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
    },
  })

  function openEdit(user) {
    setEditForm({
      email: user.email,
      username: user.username,
      password: '',
      full_name: user.full_name || '',
      role: user.role || 'viewer',
    })
    setEditTarget(user)
    setFormError('')
  }

  function handleCreate() {
    setFormError('')
    createMutation.mutate(createForm)
  }

  function handleUpdate() {
    setFormError('')
    const payload = { ...editForm }
    if (!payload.password) delete payload.password
    updateMutation.mutate({ id: editTarget.id, data: payload })
  }

  const columns = [
    {
      key: 'email',
      label: 'Email',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.email}</span>
      ),
    },
    { key: 'username', label: 'Username' },
    {
      key: 'full_name',
      label: 'Full Name',
      render: (row) => row.full_name || '-',
    },
    {
      key: 'role',
      label: 'Role',
      render: (row) => (
        <Badge variant={roleBadgeVariant[row.role] || 'gray'}>
          {row.role || 'viewer'}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.is_active !== false ? 'green' : 'red'}>
          {row.is_active !== false ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            title="Edit user"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Delete user"
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
          {users.length} user{users.length !== 1 ? 's' : ''} registered
        </p>
        <button
          onClick={() => {
            setCreateForm({ ...emptyForm })
            setFormError('')
            setCreateOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Create User
        </button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={users}
        loading={isLoading}
        emptyMessage="No users found."
      />

      {/* Create user modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New User"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <UserForm
          form={createForm}
          setForm={setCreateForm}
          onSubmit={handleCreate}
          loading={createMutation.isPending}
        />
      </Modal>

      {/* Edit user modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit User"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <UserForm
          form={editForm}
          setForm={setEditForm}
          onSubmit={handleUpdate}
          loading={updateMutation.isPending}
          isEdit
        />
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete user{' '}
            <span className="font-semibold text-slate-900">{deleteTarget?.email}</span>?
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
