import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
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

function TagBadges({ tags }) {
  if (!tags) return <span className="text-slate-400">-</span>
  const tagList = typeof tags === 'string' ? tags.split(',').map((t) => t.trim()).filter(Boolean) : tags
  if (tagList.length === 0) return <span className="text-slate-400">-</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tagList.map((tag, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

export default function AddressBookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()

  const [editBookOpen, setEditBookOpen] = useState(false)
  const [editBookForm, setEditBookForm] = useState({ name: '', description: '' })
  const [addEntryOpen, setAddEntryOpen] = useState(false)
  const [addEntryForm, setAddEntryForm] = useState({ device_id: '', alias: '', tags: '' })
  const [editEntryTarget, setEditEntryTarget] = useState(null)
  const [editEntryForm, setEditEntryForm] = useState({ alias: '', tags: '' })
  const [addPermOpen, setAddPermOpen] = useState(false)
  const [addPermForm, setAddPermForm] = useState({ user_group_id: '', permission: 'read' })
  const [formError, setFormError] = useState('')

  const { data: book, isLoading, error } = useQuery({
    queryKey: ['addressBook', id],
    queryFn: () => api.get(`/address-books/${id}`).then((r) => r.data),
  })

  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ['addressBookPermissions', id],
    queryFn: () =>
      api.get(`/address-books/${id}/permissions`).then((r) => r.data.permissions || r.data || []),
    enabled: isAdmin && !!(book && !book.is_personal && book.book_type !== 'personal'),
  })

  const { data: userGroups } = useQuery({
    queryKey: ['userGroups'],
    queryFn: () => api.get('/user-groups').then((r) => r.data.groups || r.data || []),
    enabled: addPermOpen,
  })

  const entries = book?.entries || []
  const isShared = book && !book.is_personal && book.book_type !== 'personal'

  // Mutations
  const updateBookMutation = useMutation({
    mutationFn: (data) => api.patch(`/address-books/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBook', id] })
      queryClient.invalidateQueries({ queryKey: ['addressBooks'] })
      setEditBookOpen(false)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update address book.')
    },
  })

  const addEntryMutation = useMutation({
    mutationFn: (data) => api.post(`/address-books/${id}/entries`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBook', id] })
      setAddEntryOpen(false)
      setAddEntryForm({ device_id: '', alias: '', tags: '' })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to add entry.')
    },
  })

  const editEntryMutation = useMutation({
    mutationFn: ({ entryId, data }) =>
      api.patch(`/address-books/${id}/entries/${entryId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBook', id] })
      setEditEntryTarget(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to update entry.')
    },
  })

  const removeEntryMutation = useMutation({
    mutationFn: (entryId) => api.delete(`/address-books/${id}/entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBook', id] })
    },
  })

  const addPermMutation = useMutation({
    mutationFn: (data) => api.post(`/address-books/${id}/permissions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBookPermissions', id] })
      setAddPermOpen(false)
      setAddPermForm({ user_group_id: '', permission: 'read' })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to add permission.')
    },
  })

  const removePermMutation = useMutation({
    mutationFn: (permId) => api.delete(`/address-books/${id}/permissions/${permId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBookPermissions', id] })
    },
  })

  // Handlers
  function openEditBook() {
    setEditBookForm({ name: book?.name || '', description: book?.description || '' })
    setFormError('')
    setEditBookOpen(true)
  }

  function handleUpdateBook(e) {
    e.preventDefault()
    setFormError('')
    updateBookMutation.mutate(editBookForm)
  }

  function handleAddEntry(e) {
    e.preventDefault()
    setFormError('')
    const tagsStr = addEntryForm.tags
      ? addEntryForm.tags.split(',').map((t) => t.trim()).filter(Boolean).join(',')
      : undefined
    addEntryMutation.mutate({
      device_id: addEntryForm.device_id,
      alias: addEntryForm.alias || undefined,
      tags: tagsStr,
    })
  }

  function openEditEntry(entry) {
    const tagsStr = Array.isArray(entry.tags) ? entry.tags.join(', ') : entry.tags || ''
    setEditEntryForm({ alias: entry.alias || '', tags: tagsStr })
    setEditEntryTarget(entry)
    setFormError('')
  }

  function handleEditEntry(e) {
    e.preventDefault()
    setFormError('')
    const tagsStr = editEntryForm.tags
      ? editEntryForm.tags.split(',').map((t) => t.trim()).filter(Boolean).join(',')
      : undefined
    editEntryMutation.mutate({
      entryId: editEntryTarget.id,
      data: { alias: editEntryForm.alias || undefined, tags: tagsStr },
    })
  }

  function handleAddPerm(e) {
    e.preventDefault()
    setFormError('')
    addPermMutation.mutate({
      user_group_id: addPermForm.user_group_id,
      permission: addPermForm.permission,
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
        <p className="text-sm text-red-700">Failed to load address book.</p>
        <button
          onClick={() => navigate('/address-books')}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Back to address books
        </button>
      </div>
    )
  }

  const entryColumns = [
    {
      key: 'device_id',
      label: 'Device ID',
      render: (row) => (
        <span className="font-mono text-sm">{row.device_id}</span>
      ),
    },
    {
      key: 'alias',
      label: 'Alias',
      render: (row) => (
        <span className="font-medium text-slate-900">{row.alias || '-'}</span>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (row) => <TagBadges tags={row.tags} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEditEntry(row)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            title="Edit entry"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => removeEntryMutation.mutate(row.id)}
            disabled={removeEntryMutation.isPending}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Remove entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const permissionColumns = [
    {
      key: 'user_group',
      label: 'User Group',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.user_group_name || row.user_group_id}
        </span>
      ),
    },
    {
      key: 'permission',
      label: 'Permission',
      render: (row) => (
        <Badge variant={row.permission === 'write' ? 'green' : 'blue'}>
          {row.permission}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          onClick={() => removePermMutation.mutate(row.id)}
          disabled={removePermMutation.isPending}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remove permission"
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
        onClick={() => navigate('/address-books')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Address Books
      </button>

      {/* Book info header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{book?.name}</h2>
              <Badge variant={book?.is_personal || book?.book_type === 'personal' ? 'indigo' : 'blue'}>
                {book?.is_personal || book?.book_type === 'personal' ? 'Personal' : 'Shared'}
              </Badge>
            </div>
            {book?.description && (
              <p className="mt-1 text-sm text-slate-500">{book.description}</p>
            )}
          </div>
          <button
            onClick={openEditBook}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Entries section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Entries ({entries.length})
          </h3>
          <button
            onClick={() => {
              setAddEntryForm({ device_id: '', alias: '', tags: '' })
              setFormError('')
              setAddEntryOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Device
          </button>
        </div>

        <Table
          columns={entryColumns}
          data={entries}
          loading={false}
          emptyMessage="No devices in this address book."
        />
      </div>

      {/* Permissions section (shared books, admin only) */}
      {isShared && isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">
              Permissions ({(permissions || []).length})
            </h3>
            <button
              onClick={() => {
                setAddPermForm({ user_group_id: '', permission: 'read' })
                setFormError('')
                setAddPermOpen(true)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Permission
            </button>
          </div>

          <Table
            columns={permissionColumns}
            data={permissions || []}
            loading={permsLoading}
            emptyMessage="No permissions configured."
          />
        </div>
      )}

      {/* Edit book modal */}
      <Modal
        open={editBookOpen}
        onClose={() => setEditBookOpen(false)}
        title="Edit Address Book"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleUpdateBook} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              type="text"
              required
              value={editBookForm.name}
              onChange={(e) => setEditBookForm({ ...editBookForm, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={editBookForm.description}
              onChange={(e) => setEditBookForm({ ...editBookForm, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditBookOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateBookMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {updateBookMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add entry modal */}
      <Modal
        open={addEntryOpen}
        onClose={() => setAddEntryOpen(false)}
        title="Add Device"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Device ID</label>
            <input
              type="text"
              required
              value={addEntryForm.device_id}
              onChange={(e) => setAddEntryForm({ ...addEntryForm, device_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Enter device ID"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Alias</label>
            <input
              type="text"
              value={addEntryForm.alias}
              onChange={(e) => setAddEntryForm({ ...addEntryForm, alias: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Optional alias"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
            <input
              type="text"
              value={addEntryForm.tags}
              onChange={(e) => setAddEntryForm({ ...addEntryForm, tags: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Comma-separated tags"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddEntryOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addEntryMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addEntryMutation.isPending ? 'Adding...' : 'Add Device'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit entry modal */}
      <Modal
        open={!!editEntryTarget}
        onClose={() => setEditEntryTarget(null)}
        title="Edit Entry"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleEditEntry} className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">
              Device: <span className="font-mono font-medium text-slate-700">{editEntryTarget?.device_id}</span>
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Alias</label>
            <input
              type="text"
              value={editEntryForm.alias}
              onChange={(e) => setEditEntryForm({ ...editEntryForm, alias: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Optional alias"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tags</label>
            <input
              type="text"
              value={editEntryForm.tags}
              onChange={(e) => setEditEntryForm({ ...editEntryForm, tags: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Comma-separated tags"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditEntryTarget(null)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editEntryMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {editEntryMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add permission modal */}
      <Modal
        open={addPermOpen}
        onClose={() => setAddPermOpen(false)}
        title="Add Permission"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleAddPerm} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">User Group</label>
            <select
              required
              value={addPermForm.user_group_id}
              onChange={(e) => setAddPermForm({ ...addPermForm, user_group_id: e.target.value })}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Permission</label>
            <select
              value={addPermForm.permission}
              onChange={(e) => setAddPermForm({ ...addPermForm, permission: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddPermOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPermMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addPermMutation.isPending ? 'Adding...' : 'Add Permission'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
