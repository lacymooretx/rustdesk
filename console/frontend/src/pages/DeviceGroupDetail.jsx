import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, Trash2, Search } from 'lucide-react'
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

function OnlineIndicator({ online }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        online ? 'bg-emerald-500' : 'border border-slate-300 bg-slate-200'
      }`}
      title={online ? 'Online' : 'Offline'}
    />
  )
}

export default function DeviceGroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [deviceSearch, setDeviceSearch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [formError, setFormError] = useState('')

  const { data: group, isLoading: groupLoading, error: groupError } = useQuery({
    queryKey: ['deviceGroup', id],
    queryFn: () => api.get(`/device-groups/${id}`).then((r) => r.data),
  })

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['deviceGroupMembers', id],
    queryFn: () =>
      api.get(`/device-groups/${id}/members`).then((r) => r.data.members || r.data || []),
  })

  const { data: searchResults } = useQuery({
    queryKey: ['deviceSearch', deviceSearch],
    queryFn: () =>
      api.get('/devices', { params: { q: deviceSearch, per_page: 10 } }).then((r) => r.data.devices || []),
    enabled: addOpen && deviceSearch.length > 0,
  })

  const addMutation = useMutation({
    mutationFn: (deviceId) =>
      api.post(`/device-groups/${id}/members`, { device_id: deviceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceGroupMembers', id] })
      queryClient.invalidateQueries({ queryKey: ['deviceGroup', id] })
      setAddOpen(false)
      setDeviceSearch('')
      setSelectedDevice(null)
      setFormError('')
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Failed to add device.')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (deviceId) =>
      api.delete(`/device-groups/${id}/members/${deviceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceGroupMembers', id] })
      queryClient.invalidateQueries({ queryKey: ['deviceGroup', id] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/device-groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviceGroup', id] })
      queryClient.invalidateQueries({ queryKey: ['deviceGroups'] })
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

  function handleAddDevice(e) {
    e.preventDefault()
    if (selectedDevice) {
      addMutation.mutate(selectedDevice)
    } else if (deviceSearch.trim()) {
      addMutation.mutate(deviceSearch.trim())
    }
  }

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
        <p className="text-sm text-red-700">Failed to load device group.</p>
        <button
          onClick={() => navigate('/device-groups')}
          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Back to device groups
        </button>
      </div>
    )
  }

  const memberColumns = [
    {
      key: 'id',
      label: 'Device ID',
      render: (row) => (
        <span className="font-mono text-sm">{row.id || row.device_id}</span>
      ),
    },
    {
      key: 'hostname',
      label: 'Hostname',
      render: (row) => (
        <span className="font-medium text-slate-900">
          {row.info?.hostname || row.hostname || '-'}
        </span>
      ),
    },
    {
      key: 'os',
      label: 'OS',
      render: (row) => row.info?.os || row.os || '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge variant={row.status !== 1 ? 'green' : 'red'}>
          {row.status !== 1 ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'online',
      label: 'Online',
      render: (row) => <OnlineIndicator online={row.online} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <button
          onClick={() => removeMutation.mutate(row.id || row.device_id)}
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
        onClick={() => navigate('/device-groups')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Device Groups
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
              setDeviceSearch('')
              setSelectedDevice(null)
              setFormError('')
              setAddOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Device
          </button>
        </div>

        <Table
          columns={memberColumns}
          data={members || []}
          loading={membersLoading}
          emptyMessage="No devices in this group yet."
        />
      </div>

      {/* Add device modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Device to Group"
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleAddDevice} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Search or enter Device ID
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={deviceSearch}
                onChange={(e) => {
                  setDeviceSearch(e.target.value)
                  setSelectedDevice(null)
                }}
                className="w-full rounded-lg border border-slate-300 pl-10 pr-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Type device ID or hostname to search..."
              />
            </div>
          </div>

          {/* Search results */}
          {searchResults && searchResults.length > 0 && !selectedDevice && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
              {searchResults.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => {
                    setSelectedDevice(device.id)
                    setDeviceSearch(device.id)
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <span className="font-mono font-medium text-slate-900">{device.id}</span>
                  <span className="text-slate-500">{device.info?.hostname || '-'}</span>
                  <span className="text-slate-400">{device.info?.os || ''}</span>
                </button>
              ))}
            </div>
          )}

          {selectedDevice && (
            <p className="text-sm text-emerald-600">
              Selected: <span className="font-mono font-medium">{selectedDevice}</span>
            </p>
          )}

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
              disabled={addMutation.isPending || (!selectedDevice && !deviceSearch.trim())}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addMutation.isPending ? 'Adding...' : 'Add Device'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit group modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Device Group"
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
