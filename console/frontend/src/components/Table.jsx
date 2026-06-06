import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

function SortIcon({ column, sortKey, sortDir }) {
  if (sortKey !== column) {
    return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 text-slate-300" />
  }
  return sortDir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3.5 w-3.5 text-indigo-500" />
  ) : (
    <ArrowDown className="ml-1 inline h-3.5 w-3.5 text-indigo-500" />
  )
}

function SkeletonRows({ columns, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className="animate-pulse">
      {columns.map((col) => (
        <td key={col.key} className="px-4 py-3">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  ))
}

export default function Table({
  columns,
  data = [],
  sortKey,
  sortDir,
  onSort,
  loading = false,
  emptyMessage = 'No data found.',
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                  col.sortable ? 'cursor-pointer select-none hover:text-slate-700' : ''
                }`}
                onClick={() => col.sortable && onSort && onSort(col.key)}
              >
                {col.label}
                {col.sortable && (
                  <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <SkeletonRows columns={columns} />
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className="hover:bg-slate-50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
