import type { CallEfficiencyData } from '../_lib/types'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: 'var(--color-white)', border: '1px solid var(--color-gray-200)' }}
    >
      <p className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>{label}</p>
      <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-gray-900)' }}>{value}</p>
      {sub && <p className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>{sub}</p>}
    </div>
  )
}

export function CallEfficiencyPanel({ data }: { data: CallEfficiencyData }) {
  const totalCalls = data.callCountAppo.reduce((s, r) => s + r.total, 0)
  const totalAppo = data.callCountAppo.reduce((s, r) => s + r.appo, 0)
  const overallRate = totalCalls > 0 ? ((totalAppo / totalCalls) * 100).toFixed(1) : '-'

  return (
    <div className="space-y-4">
      {!data.hasNewData && (
        <div
          className="rounded-lg px-4 py-3 text-[12px]"
          style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
        >
          ※ 架電効率は新規Webhook流入データ（source=meta_ads）のみを対象とします。過去データ（約2,817件）はlead_id未紐づけのため除外されています。
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="架電総数" value={totalCalls.toLocaleString()} sub="新規流入のみ" />
        <StatCard label="アポ獲得数" value={totalAppo.toLocaleString()} />
        <StatCard label="架電アポ率" value={totalCalls > 0 ? overallRate + '%' : '-'} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-gray-200)' }}>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-gray-900)' }}>コール回数別アポ率</p>
        </div>
        {data.callCountAppo.length === 0 ? (
          <div className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
            データがありません
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: 'var(--color-gray-50)' }}>
                {['コール回数', '架電数', 'アポ数', 'アポ率'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-medium text-right first:text-left" style={{ color: 'var(--color-gray-600)', borderBottom: '1px solid var(--color-gray-200)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.callCountAppo.map((row) => (
                <tr key={row.callCount} style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                  <td className="px-4 py-2 text-[12px] tabular-nums" style={{ color: 'var(--color-gray-900)' }}>{row.callCount}回目</td>
                  <td className="px-4 py-2 text-[12px] tabular-nums text-right" style={{ color: 'var(--color-gray-900)' }}>{row.total.toLocaleString()}</td>
                  <td className="px-4 py-2 text-[12px] tabular-nums text-right" style={{ color: 'var(--color-blue)' }}>{row.appo.toLocaleString()}</td>
                  <td className="px-4 py-2 text-[12px] tabular-nums text-right" style={{ color: row.appoRate >= 20 ? 'var(--color-success)' : 'var(--color-gray-900)' }}>
                    {row.appoRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
