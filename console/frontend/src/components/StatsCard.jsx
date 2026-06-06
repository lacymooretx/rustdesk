const accentColors = {
  indigo: 'border-indigo-500 bg-indigo-50',
  green: 'border-emerald-500 bg-emerald-50',
  emerald: 'border-emerald-500 bg-emerald-50',
  red: 'border-red-500 bg-red-50',
  blue: 'border-blue-500 bg-blue-50',
  yellow: 'border-amber-500 bg-amber-50',
  gray: 'border-slate-400 bg-slate-50',
}

const iconColors = {
  indigo: 'text-indigo-600',
  green: 'text-emerald-600',
  emerald: 'text-emerald-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
  yellow: 'text-amber-600',
  gray: 'text-slate-600',
}

export default function StatsCard({ icon: Icon, label, value, color = 'indigo' }) {
  return (
    <div
      className={`rounded-lg border-l-4 bg-white p-5 shadow-sm ${accentColors[color] || accentColors.indigo}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        {Icon && (
          <div className={`rounded-lg p-3 ${iconColors[color] || iconColors.indigo}`}>
            <Icon className="h-7 w-7" />
          </div>
        )}
      </div>
    </div>
  )
}
