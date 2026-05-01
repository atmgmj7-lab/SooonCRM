'use client'

import { useState } from 'react'

export interface CohortRow {
  cohort_month: string   // 'YYYY-MM'
  platform: string
  spend: number
  leads_count: number
  apo_count: number
  won_count: number
  won_amount: number
}

const EXCLUDED_PLATFORMS = new Set(['tiktok', 'line'])

type MetricKey = 'won_count' | 'apo_count' | 'won_amount'

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'won_count',  label: '受注数' },
  { key: 'apo_count',  label: 'アポ数' },
  { key: 'won_amount', label: '受注額' },
]

function heatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'var(--color-gray-100)'
  const ratio = Math.min(value / max, 1)
  const r = Math.round(239 - ratio * (239 - 37))
  const g = Math.round(246 - ratio * (246 - 99))
  const b = Math.round(255 - ratio * (255 - 235))
  return `rgb(${r},${g},${b})`
}

function formatCohortMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}/${m}`
}

interface CohortViewProps {
  data: CohortRow[]
}

export function CohortView({ data }: CohortViewProps) {
  const [metric, setMetric] = useState<MetricKey>('won_count')

  const months = Array.from(new Set(data.map((r) => r.cohort_month))).sort()
  const platforms = Array.from(new Set(data.map((r) => r.platform)))
    .filter((p) => !EXCLUDED_PLATFORMS.has(p.toLowerCase()))
    .sort()

  const getValue = (platform: string, month: string): number =>
    data
      .filter((r) => r.platform === platform && r.cohort_month === month)
      .reduce((s, r) => s + (r[metric] as number), 0)

  const allValues = months.flatMap((mo) => platforms.map((pl) => getValue(pl, mo)))
  const max = Math.max(...allValues, 1)

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border flex items-center justify-center py-12 text-[13px]"
        style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-gray-400)' }}
      >
        データがありません
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)' }}>
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-gray-50)' }}
      >
        <span className="text-[13px] font-medium" style={{ color: 'var(--color-gray-900)' }}>
          コホート分析
        </span>
        <div className="flex gap-1">
          {METRIC_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setMetric(o.key)}
              className="px-3 py-1 rounded-lg text-[12px] font-medium transition-colors duration-150"
              style={{
                background: metric === o.key ? 'var(--color-blue)' : 'var(--color-white)',
                color: metric === o.key ? 'var(--color-white)' : 'var(--color-gray-600)',
                border: `1px solid ${metric === o.key ? 'var(--color-blue)' : 'var(--color-gray-200)'}`,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-[12px] border-collapse w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
              <th
                className="text-left px-4 py-2 font-medium sticky left-0 bg-white"
                style={{ color: 'var(--color-gray-600)', minWidth: '80px' }}
              >
                媒体
              </th>
              {months.map((mo) => (
                <th
                  key={mo}
                  className="text-center px-2 py-2 font-medium tabular-nums"
                  style={{ color: 'var(--color-gray-600)', minWidth: '72px' }}
                >
                  {formatCohortMonth(mo)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((pl) => (
              <tr key={pl} style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                <td
                  className="px-4 py-2 font-medium sticky left-0 bg-white"
                  style={{ color: 'var(--color-gray-900)' }}
                >
                  {pl}
                </td>
                {months.map((mo) => {
                  const val = getValue(pl, mo)
                  return (
                    <td
                      key={mo}
                      className="text-center px-2 py-2 tabular-nums"
                      style={{
                        background: heatColor(val, max),
                        color: 'var(--color-gray-900)',
                      }}
                    >
                      {val === 0 ? '—' : val.toLocaleString('ja-JP')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
