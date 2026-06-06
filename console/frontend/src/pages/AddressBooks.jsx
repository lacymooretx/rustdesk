import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, Lock } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
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

function BookCard({ book, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-left hover:border-indigo-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-900">{book.name}</h3>
        </div>
        <Badge variant={book.is_personal || book.book_type === 'personal' ? 'indigo' : 'blue'}>
          {book.is_personal || book.book_type === 'personal' ? 'Personal' : 'Shared'}
        </Badge>
      </div>
      {book.description && (
        <p className="mt-2 text-sm text-slate-500 line-clamp-2">{book.description}</p>
      )}
      <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-slate-400">
        <span>{book.entry_count ?? book.entries_count ?? 0} entries</span>
        <span>{formatDate(book.created_at)}</span>
      </div>
    </button>
  )
}

export default function AddressBooks() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '' })
  const [createType, setCreateType] = useState('personal')
  const [formError, setFormError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['addressBooks'],
    queryFn: () => api.get('/address-books').then((r) => r.data),
  })

  const books = data?.books || data || []
  const personalBooks = books.filter(
    (b) => b.is_personal || b.book_type === 'personal'
  )
  const sharedBooks = books.filter(
    (b) => !b.is_personal && b.book_type !== 'personal'
  )

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/address-books', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addressBooks'] })
      setCreateOpen(false)
      setCreateForm({ name: '', description: '' })
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to create address book.')
    },
  })

  function handleCreate(e) {
    e.preventDefault()
    setFormError('')
    createMutation.mutate({
      name: createForm.name,
      description: createForm.description,
      is_personal: createType === 'personal',
      book_type: createType,
    })
  }

  function openCreatePersonal() {
    setCreateType('personal')
    setCreateForm({ name: 'My Address Book', description: '' })
    setFormError('')
    setCreateOpen(true)
  }

  function openCreateShared() {
    setCreateType('shared')
    setCreateForm({ name: '', description: '' })
    setFormError('')
    setCreateOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* My Address Book */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">My Address Book</h3>
          {personalBooks.length === 0 && (
            <button
              onClick={openCreatePersonal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Personal Book
            </button>
          )}
        </div>

        {personalBooks.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <Lock className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              You don&apos;t have a personal address book yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personalBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => navigate(`/address-books/${book.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Shared Address Books */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Shared Address Books ({sharedBooks.length})
          </h3>
          {isAdmin && (
            <button
              onClick={openCreateShared}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Shared Book
            </button>
          )}
        </div>

        {sharedBooks.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">No shared address books yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => navigate(`/address-books/${book.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={createType === 'personal' ? 'Create Personal Address Book' : 'Create Shared Address Book'}
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
              placeholder="Address book name"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-y"
              placeholder="Optional description"
            />
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
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
