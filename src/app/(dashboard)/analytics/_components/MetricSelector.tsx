'use client'
import { useState } from 'react'
import { ALL_METRICS, type MetricKey } from '../_lib/metrics'

const CATEGORIES = [
  { key: 'list', label: 'リスト集計' },
  { key: 'rate', label: '率指標' },
  { key: 'ad',   label: '広告指標' },
] as const

interface Props {
  selected: MetricKey[]
  onChange: (keys: MetricKey[]) => void
}

export function MetricSelector({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const toggle = (key: MetricKey) => {
    onChange(
      selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key]
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* ヘッダー行（クリックで展開/折りたたみ） */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          background: '#F8FAFC',
          border: '1px solid #E5E7EB',
          borderRadius: open ? '8px 8px 0 0' : 8,
          padding: '10px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          グラフ指標を選択
          <span style={{ fontSize: 11, fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
            ({selected.length}件選択中)
          </span>
        </span>
        <span style={{ fontSize: 12, color: '#9CA3AF', transition: 'transform .15s', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>
          ▼
        </span>
      </button>

      {/* 展開パネル */}
      {open && (
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #E5E7EB',
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: '12px 16px',
          }}
        >
          {CATEGORIES.map((cat) => (
            <div key={cat.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                {cat.label}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_METRICS.filter((m) => m.category === cat.key).map((metric) => {
                  const on = selected.includes(metric.key)
                  return (
                    <button
                      key={metric.key}
                      type="button"
                      onClick={() => toggle(metric.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                        fontSize: 11.5,
                        background: on ? '#0D9488' : '#fff',
                        color: on ? '#fff' : '#6B7280',
                        fontWeight: on ? 600 : 400,
                        border: on ? '1px solid #0D9488' : '1px solid #E5E7EB',
                        transition: 'all .1s',
                      }}
                    >
                      <span style={{ fontSize: 9 }}>
                        {metric.chartType === 'line' ? '↗' : '▊'}
                      </span>
                      {metric.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
