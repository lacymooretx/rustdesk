import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../services/api'
import Table from '../components/Table'
import Badge from '../components/Badge'
import Modal from '../components/Modal'

const roleBadgeVariant = {
  admin: 'red',
  operator: 'yellow',
  viewer: 'blue',
}

export default function UserGroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [selectedUser, setSelectedUser] = useState('')
  const [formError, setFormError] = useState('')

  const { data: group, isLoading: groupLoading, error: groupError } = useQuery({
    queryKey: ['userGroup', id],
    queryFn: () => api.get(`/user-groups/${id}`).then((r) => r.data),
  })

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['userGroupMembers', id],
    queryFn: () =>
      api.get(`/user-groups/${id}/members`).then((r) => r.data.members || r.data || []),
  })

  const { data: allUsers } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => api.get('/users').then((r) => r.data.users || []),
    enabled: addOpen,
  })

  const addMutation = useMutation({
    mutationFn: (userId) =>
      api.post(`/user-groups/${id}/members`, { user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGroupMembers', id] })
      queryClient.invalidateQueries({ queryKey: ['userGroup', id] })
      setAddOpen(false)
      setSelectedUser('')
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to add user.')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId) =>
      api.delete(`/user-groups/${id}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGroupMembers', id] })
      queryClient.invalidateQueries({ queryKey: ['userGroup', id] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/user-groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGroup', id] })
      queryClient.invalidateQueries({ queryKey: ['userGroups'] })
      setEditOpen(false)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update group.')
    },
  })

  function openEditModal() {
    setEditForm({ name: group?.name || '', description: group?.description || '' })
    setFormError('')
    setEditOpen(true)
  }

  function handleUpdate(e) {
    e.preventDefault()
    setFormError('')
    updateMutation.mutate(editForm)
  }

  function handleAddUser(e) {
    e.preventDefault()
    if (selectedUser) {
      addMutation.mutate(selectedUser)
    }
  }

  // Filter out users already in the group
  const availableUsers = (allUsers || []).filter((u) => {
    const memberIds = (members || []).map((m) => m.id || m.user_id)
    return !memberIds.includes(u.id)
  })

  if (groupLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (groupError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">Failed to load user group.</p>
        <button
          onClick={() => navigate('/user-groups')}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Back to user groups
        </button>
      </div>
    )
  }

  const memberColumns = [
    {
      key: 'email',
      label: 'Email',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.email}</span>
      ),
    },
    {
      key: 'username',
      label: 'Username',
      render: (row) => row.username || '-',
    },
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
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          onClick={() => removeMutation.mutate(row.id || row.user_id)}
          disabled={removeMutation.isPending}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remove from group"
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
        onClick={() => navigate('/user-groups')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to User Groups
      </button>

      {/* Group info header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{group?.name}</h2>
            {group?.description && (
              <p className="mt-1 text-sm text-slate-500">{group.description}</p>
            )}
          </div>
          <button
            onClick={openEditModal}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Members section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Members ({(members || []).length})
          </h3>
          <button
            onClick={() => {
              setSelectedUser('')
              setFormError('')
              setAddOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>

        <Table
          columns={memberColumns}
          data={members || []}
          loading={membersLoading}
          emptyMessage="No users in this group yet."
        />
      </div>

      {/* Add user modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add User to Group"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Select User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Choose a user...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.full_name || u.username})
                </option>
              ))}
            </select>
            {availableUsers.length === 0 && allUsers && (
              <p className="mt-2 text-xs text-slate-400">
                All users are already members of this group.
              </p>
            )}
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
              disabled={addMutation.isPending || !selectedUser}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addMutation.isPending ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit group modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit User Group"
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
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditOpen(false)}
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
    </div>
  )
}
