import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Monitor, CheckCircle, XCircle, Wifi } from 'lucide-react'
import api from '../services/api'
import StatsCard from '../components/StatsCard'
import Table from '../components/Table'
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

const recentColumns = [
  { key: 'id', label: 'Device ID' },
  {
    key: 'hostname',
    label: 'Hostname',
    render: (row) => row.info?.hostname || '-',
  },
  {
    key: 'os',
    label: 'OS',
    render: (row) => row.info?.os || '-',
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
    key: 'created_at',
    label: 'Registered',
    render: (row) => formatDate(row.created_at),
  },
]

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['deviceStats'],
    queryFn: () => api.get('/devices/stats').then((r) => r.data),
  })

  const { data: recentDevices, isLoading: devicesLoading } = useQuery({
    queryKey: ['recentDevices'],
    queryFn: () =>
      api.get('/devices', { params: { per_page: 10, sort_by: 'created_at', sort_order: 'desc' } }).then((r) => {
        return r.data.devices || []
      }),
  })

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={Monitor}
          label="Total Devices"
          value={statsLoading ? '-' : stats?.total_devices ?? 0}
          color="indigo"
        />
        <StatsCard
          icon={Wifi}
          label="Online"
          value={statsLoading ? '-' : stats?.online_devices ?? 0}
          color="emerald"
        />
        <StatsCard
          icon={CheckCircle}
          label="Enabled"
          value={statsLoading ? '-' : stats?.enabled_devices ?? 0}
          color="green"
        />
        <StatsCard
          icon={XCircle}
          label="Disabled"
          value={statsLoading ? '-' : stats?.disabled_devices ?? 0}
          color="red"
        />
      </div>

      {/* Recent devices */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recently Registered Devices</h2>
          <button
            onClick={() => navigate('/devices')}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            View all devices &rarr;
          </button>
        </div>
        <Table
          columns={recentColumns}
          data={recentDevices || []}
          loading={devicesLoading}
          emptyMessage="No devices registered yet."
        />
      </div>
    </div>
  )
}
