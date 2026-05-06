'use client'
import { useState } from 'react'
import { AdSummaryTable } from './AdSummaryTable'
import { MonthlyTrendChart } from './MonthlyTrendChart'
import { DynamicChart } from './DynamicChart'
import { MetricSelector } from './MetricSelector'
import type { AdSummaryRow, MonthlyRow } from '../_lib/types'
import type { MetricKey } from '../_lib/metrics'

type SubTab = 'by_ad' | 'by_month'

const subTabBtnStyle = (active: boolean, color = '#0D9488'): React.CSSProperties => ({
  padding: '5px 16px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: active ? 600 : 400,
  background: active ? '#fff' : 'transparent',
  color: active ? color : '#6B7280',
  boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
  transition: 'all .12s',
})

interface Props {
  adStats:          AdSummaryRow[]
  monthlyData:      MonthlyRow[]
  selectedMetrics:  MetricKey[]
  onMetricsChange:  (keys: MetricKey[]) => void
  selectedAds:      string[]
}

export function AdSummaryTab({
  adStats, monthlyData, selectedMetrics, onMetricsChange, selectedAds,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>('by_ad')

  const adChartData = adStats.map((a) => ({
    x: a.adName.length > 12 ? a.adName.slice(0, 12) + '…' : a.adName,
    ...a,
  }))

  return (
    <div>
      {/* サブタブ切替 */}
      <div style={{
        display: 'inline-flex',
        background: '#F1F5F9',
        borderRadius: 8,
        padding: 3,
        gap: 2,
        marginBottom: 16,
      }}>
        {([
          { key: 'by_ad',    label: '広告別' },
          { key: 'by_month', label: '月次推移' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            style={subTabBtnStyle(subTab === t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 指標セレクター（両サブタブ共通） */}
      <MetricSelector selected={selectedMetrics} onChange={onMetricsChange} />

      {subTab === 'by_ad' && (
        <>
          <div style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
            padding: '16px 20px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>広告別指標比較</div>
            <DynamicChart data={adChartData} xKey="x" selectedMetrics={selectedMetrics} />
          </div>
          <AdSummaryTable data={adStats} />
        </>
      )}

      {subTab === 'by_month' && (
        <MonthlyTrendChart data={monthlyData} />
      )}
    </div>
  )
}
