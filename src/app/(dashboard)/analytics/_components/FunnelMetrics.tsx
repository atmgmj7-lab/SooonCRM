import type { AdSummaryRow } from '../_lib/types'

function FunnelStep({
  label,
  count,
  rate,
  color,
}: {
  label: string
  count: number
  rate?: number
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-full rounded-lg flex flex-col items-center justify-center py-4"
        style={{ background: color, minHeight: 64 }}
      >
        <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-gray-900)' }}>
          {count.toLocaleString()}
        </p>
        <p className="text-[11px] font-medium" style={{ color: 'var(--color-gray-600)' }}>{label}</p>
      </div>
      {rate !== undefined && (
        <p className="text-[11px] tabular-nums" style={{ color: 'var(--color-gray-400)' }}>
          ↓ {rate.toFixed(1)}%
        </p>
      )}
    </div>
  )
}

export function FunnelMetrics({ rows }: { rows: AdSummaryRow[] }) {
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0)
  const totalAppo = rows.reduce((s, r) => s + r.appo, 0)
  const totalMikomi = rows.reduce((s, r) => s + r.mikomi, 0)
  const totalKanryo = rows.reduce((s, r) => s + r.kanryo, 0)
  const totalDeals = rows.reduce((s, r) => s + r.deals, 0)

  const steps = [
    { label: 'リード', count: totalLeads, color: 'var(--color-blue-light)', rate: undefined },
    { label: 'アポ', count: totalAppo, color: '#DBEAFE', rate: totalLeads > 0 ? (totalAppo / totalLeads) * 100 : 0 },
    { label: '見込み', count: totalMikomi, color: '#E0F2FE', rate: totalAppo > 0 ? (totalMikomi / totalAppo) * 100 : 0 },
    { label: '完了', count: totalKanryo, color: 'var(--color-success-bg)', rate: totalMikomi > 0 ? (totalKanryo / totalMikomi) * 100 : 0 },
    { label: '受注', count: totalDeals, color: '#D1FAE5', rate: totalKanryo > 0 ? (totalDeals / totalKanryo) * 100 : 0 },
  ]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-gray-200)' }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-gray-900)' }}>ファネル分析</p>
      </div>
      <div className="p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {steps.map((step) => (
            <FunnelStep
              key={step.label}
              label={step.label}
              count={step.count}
              rate={step.rate}
              color={step.color}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
            <p className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>リード→アポ率</p>
            <p className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--color-blue)' }}>
              {totalLeads > 0 ? ((totalAppo / totalLeads) * 100).toFixed(1) : '-'}%
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
            <p className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>アポ→受注率</p>
            <p className="text-[18px] font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>
              {totalAppo > 0 ? ((totalDeals / totalAppo) * 100).toFixed(1) : '-'}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
