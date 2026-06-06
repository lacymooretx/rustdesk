import { useQuery } from '@tanstack/react-query'
import { Download, Monitor, Apple, Terminal, Package, ExternalLink } from 'lucide-react'
import api from '../services/api'

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const platformIcon = {
  Windows: Monitor,
  macOS: Apple,
  Linux: Terminal,
}

export default function Downloads() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['downloads'],
    queryFn: async () => (await api.get('/update/downloads')).data,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Download Aspendora Remote</h2>
          <p className="mt-1 text-sm text-slate-500">
            Install the remote desktop client. These builds are code-signed and
            pre-configured for your Aspendora server.
          </p>
        </div>
        {data?.version && (
          <div className="text-right">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
              v{data.version}
            </span>
            {data.released_at && (
              <p className="mt-1 text-xs text-slate-400">Released {formatDate(data.released_at)}</p>
            )}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Loading available downloads…
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 shadow-sm">
          Could not load the download list. The release server may be unavailable — try again shortly.
        </div>
      )}

      {data && data.groups?.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No installers are published yet. Check back after the next build completes.
        </div>
      )}

      {/* Platform groups */}
      {data?.groups?.map((group) => {
        const Icon = platformIcon[group.platform] || Package
        return (
          <div key={group.platform} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
              <Icon className="h-5 w-5 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">{group.platform}</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.files.map((file) => (
                <li key={file.filename} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{file.kind}</p>
                    <p className="truncate text-xs text-slate-400">
                      {file.arch} · {formatFileSize(file.size)} · {file.filename}
                    </p>
                  </div>
                  <a
                    href={file.url}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {data?.release_url && (
        <a
          href={data.release_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600"
        >
          View all release assets <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}
