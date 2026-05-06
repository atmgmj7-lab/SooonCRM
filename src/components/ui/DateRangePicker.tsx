'use client'
import { useState } from 'react'
import { subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from 'date-fns'

export type DateRange = { from: Date | null; to: Date | null }

type Preset = {
  label: string
  key: string
  getRange: () => DateRange
}

const PRESETS: Preset[] = [
  { label: '今日',   key: 'today',  getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: '昨日',   key: 'yday',   getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: '7日',    key: '7d',     getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: '30日',   key: '30d',    getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: '90日',   key: '90d',    getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: '今月',   key: 'thisM',  getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: '先月',   key: 'lastM',  getRange: () => { const m = subMonths(new Date(), 1); return { from: startOfMonth(m), to: endOfMonth(m) } } },
  { label: '全期間', key: 'all',    getRange: () => ({ from: null, to: null }) },
  { label: 'カスタム', key: 'custom', getRange: () => ({ from: null, to: null }) },
]

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangePicker({ value, onChange }: Props) {
  const [activeKey, setActiveKey] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const handlePreset = (p: Preset) => {
    setActiveKey(p.key)
    if (p.key !== 'custom') {
      onChange(p.getRange())
    }
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({ from: new Date(customFrom), to: new Date(customTo) })
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 7, padding: 3, gap: 2 }}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => handlePreset(p)}
            style={{
              padding: '4px 10px',
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              background: activeKey === p.key ? '#fff' : 'transparent',
              color: activeKey === p.key ? '#0D9488' : '#6B7280',
              fontWeight: activeKey === p.key ? 600 : 400,
              boxShadow: activeKey === p.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              transition: 'all .12s',
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {activeKey === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12 }}
          />
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>〜</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12 }}
          />
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, background: '#0D9488', color: '#fff', fontWeight: 500,
            }}
          >
            適用
          </button>
        </div>
      )}
    </div>
  )
}
