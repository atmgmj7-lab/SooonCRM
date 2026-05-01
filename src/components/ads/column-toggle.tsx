'use client'

import { useState } from 'react'
import { Settings2 } from 'lucide-react'

export type MetricUnit = '円' | '%' | '件' | ''

export interface MetricDef {
  key: string
  label: string
  unit: MetricUnit
  defaultVisible: boolean
  isCalculated?: boolean
}

export const METRIC_DEFS: MetricDef[] = [
  { key: 'spend',       label: '広告費',   unit: '円', defaultVisible: true },
  { key: 'leads_count', label: 'リード数', unit: '件', defaultVisible: true },
  { key: 'clicks',      label: 'クリック数', unit: '件', defaultVisible: true },
  { key: 'reach',       label: 'リーチ数', unit: '件', defaultVisible: true },
  { key: 'impressions', label: 'インプ数', unit: '件', defaultVisible: true },
  { key: 'ctr',         label: 'CTR',    unit: '%',  defaultVisible: true },
  { key: 'cpc',         label: 'CPC',    unit: '円', defaultVisible: true },
  { key: 'cpm',         label: 'CPM',    unit: '円', defaultVisible: true },
  { key: 'cpa',         label: 'CPA',    unit: '円', defaultVisible: true, isCalculated: true },
  { key: 'cpo',         label: 'CPO',    unit: '円', defaultVisible: true, isCalculated: true },
  { key: 'roas',        label: 'ROAS',   unit: '%',  defaultVisible: true, isCalculated: true },
  { key: 'apo_rate',    label: 'アポ率',  unit: '%',  defaultVisible: false, isCalculated: true },
  { key: 'won_rate',    label: '受注率',  unit: '%',  defaultVisible: false, isCalculated: true },
]

export function formatMetric(value: number | null | undefined, unit: MetricUnit): string {
  if (value == null || isNaN(value)) return '—'
  if (unit === '円') return `¥${value.toLocaleString('ja-JP')}`
  if (unit === '%')  return `${value.toFixed(1)}%`
  return value.toLocaleString('ja-JP')
}

interface ColumnToggleProps {
  visible: Set<string>
  onChange: (next: Set<string>) => void
}

export function ColumnToggle({ visible, onChange }: ColumnToggleProps) {
  const [open, setOpen] = useState(false)

  function toggle(key: string) {
    const next = new Set(visible)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(next)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg border transition-colors duration-150"
        style={{
          borderColor: 'var(--color-gray-200)',
          color: 'var(--color-gray-600)',
          background: 'var(--color-white)',
        }}
      >
        <Settings2 size={14} />
        列の表示
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-9 z-20 w-48 rounded-xl border shadow-lg py-2"
            style={{
              background: 'var(--color-white)',
              borderColor: 'var(--color-gray-200)',
            }}
          >
            {METRIC_DEFS.map((m) => (
              <label
                key={m.key}
                className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-[var(--color-gray-50)] text-[13px]"
                style={{
                  color: 'var(--color-gray-900)',
                  ...(m.isCalculated ? { background: '#FFF3E0' } : {}),
                }}
              >
                <input
                  type="checkbox"
                  checked={visible.has(m.key)}
                  onChange={() => toggle(m.key)}
                  className="accent-[var(--color-blue)]"
                />
                {m.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
