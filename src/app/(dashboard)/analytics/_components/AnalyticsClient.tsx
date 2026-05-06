'use client'
import { useState, useMemo, useEffect } from 'react'
import { format } from 'date-fns'
import { DateRangePicker, type DateRange } from '@/components/ui/DateRangePicker'
import { AdSelector } from './AdSelector'
import { KpiCardRow } from './KpiCardRow'
import { AdSummaryTab } from './AdSummaryTab'
import { LeadSummaryTab } from './LeadSummaryTab'
import { CallAnalysisTab } from './CallAnalysisTab'
import { FactorAnalysisTab } from './FactorAnalysisTab'
import {
  aggregateByAd, aggregateByMonth, filterByDateRange, calcKpi, buildCohortData,
} from '../_lib/aggregations'
import { DEFAULT_METRICS, type MetricKey } from '../_lib/metrics'
import type { LeadRow, AdSummaryRow, MonthlyRow, CallRecord } from '../_lib/types'

type MetaInsightRow = {
  adName: string
  impressions: number
  clicks: number
  reach: number
  adSpend: number
  cpm: number
  cpc: number
  ctr: number
  creativeImageUrl: string | null
}

function mergeMetaInsights(rows: AdSummaryRow[], meta: MetaInsightRow[]): AdSummaryRow[] {
  const map = new Map(meta.map((m) => [m.adName, m]))
  return rows.map((row) => {
    const m = map.get(row.adName)
    if (!m) return row
    return {
      ...row,
      creativeImageUrl: m.creativeImageUrl ?? row.creativeImageUrl,
      impressions:  m.impressions,
      clicks:       m.clicks,
      reach:        m.reach,
      adSpend:      m.adSpend,
      cpm:          m.cpm,
      cpc:          m.cpc,
      ctr:          m.ctr,
      cpa:          m.adSpend > 0 && row.leads > 0 ? m.adSpend / row.leads : null,
      cpaPerAppo:   m.adSpend > 0 && row.appo > 0 ? m.adSpend / row.appo : null,
      cpaPerChakuza: m.adSpend > 0 && row.chakuza > 0 ? m.adSpend / row.chakuza : null,
      cpo:          m.adSpend > 0 && row.juchu > 0 ? m.adSpend / row.juchu : null,
      roasTotal:    m.adSpend > 0 && row.totalRevenue > 0 ? (row.totalRevenue / m.adSpend) * 100 : null,
      roasCashflow: m.adSpend > 0 && row.cashflowRevenue > 0 ? (row.cashflowRevenue / m.adSpend) * 100 : null,
    }
  })
}

const TABS = [
  { key: 'ad_summary',    label: '📊 広告サマリー' },
  { key: 'lead_summary',  label: '📈 リードサマリー' },
  { key: 'call_analysis', label: '📞 コール分析' },
  { key: 'funnel',        label: '🔍 ファクター分析' },
] as const

type TabKey = typeof TABS[number]['key']

interface Props {
  rawLeads: LeadRow[]
  initialAdStats: AdSummaryRow[]
  initialMonthlyData: MonthlyRow[]
  rawCalls: CallRecord[]
  adNames: string[]
}

function exportCsv(rows: AdSummaryRow[]) {
  const headers = [
    '広告名', 'リスト数', 'アポOK', 'NG', '対象外', '重複', '完了', '新規', '留守',
    '見込みA', '見込みB', '見込みC', '未完了',
    '対リストアポ率', '対完了アポ率', 'リスト完了率',
    'クリック', 'リーチ', 'インプ', 'CPA(1L単価)', 'CTR', 'CPC', 'CPM', '広告費',
    '1A単価', '総受注額', 'ROAS(総受注)', 'ROAS(入金額)',
  ]
  const csv = [
    headers,
    ...rows.map((r) => [
      r.adName, r.leads, r.appo, r.ng, r.taishogai, r.duplicateCount, r.kanryo,
      r.miCall, r.rusu, r.mikomiA, r.mikomiB, r.mikomiC, r.mikanryo,
      r.appoRate?.toFixed(1) ?? '', r.appoRateKanryo?.toFixed(1) ?? '', r.kanryoRate?.toFixed(1) ?? '',
      r.clicks ?? '', r.reach ?? '', r.impressions ?? '',
      r.cpa?.toFixed(0) ?? '', r.ctr?.toFixed(2) ?? '', r.cpc?.toFixed(0) ?? '', r.cpm?.toFixed(0) ?? '',
      r.adSpend ?? '', r.cpaPerAppo?.toFixed(0) ?? '', r.totalRevenue,
      r.roasTotal?.toFixed(1) ?? '', r.roasCashflow?.toFixed(1) ?? '',
    ]),
  ]
    .map((row) => row.join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analytics_${format(new Date(), 'yyyyMMdd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function AnalyticsClient({
  rawLeads,
  initialAdStats,
  initialMonthlyData,
  rawCalls,
  adNames,
}: Props) {
  const [dateRange, setDateRange]             = useState<DateRange>({ from: null, to: null })
  const [selectedAds, setSelectedAds]         = useState<string[]>([])
  const [activeTab, setActiveTab]             = useState<TabKey>('ad_summary')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(DEFAULT_METRICS)
  const [metaInsights, setMetaInsights]       = useState<MetaInsightRow[]>([])
  const [excludeNoAd, setExcludeNoAd]         = useState(false)

  const isDefaultFilter = !dateRange.from && !dateRange.to && selectedAds.length === 0 && !excludeNoAd

  useEffect(() => {
    fetch('/api/meta-ads/insights')
      .then((r) => r.ok ? r.json() : null)
      .then((json: { data?: MetaInsightRow[] } | null) => {
        if (json?.data) setMetaInsights(json.data)
      })
      .catch((err) => console.error('[AnalyticsClient] meta-ads/insights:', err))
  }, [])

  const dateFilteredLeads = useMemo(() => {
    if (isDefaultFilter) return rawLeads
    let leads = filterByDateRange(rawLeads, dateRange)
    if (excludeNoAd) leads = leads.filter((l) => l.ad_name && l.ad_name.trim() !== '')
    return leads
  }, [rawLeads, dateRange, excludeNoAd, isDefaultFilter])

  const filteredLeads = useMemo(() => {
    if (isDefaultFilter) return rawLeads
    if (selectedAds.length === 0) return dateFilteredLeads
    return dateFilteredLeads.filter((l) => selectedAds.includes(l.ad_name ?? '広告名未設定'))
  }, [rawLeads, dateFilteredLeads, selectedAds, isDefaultFilter])

  const allRawAdStats = useMemo(
    () => isDefaultFilter ? initialAdStats : aggregateByAd(dateFilteredLeads),
    [isDefaultFilter, initialAdStats, dateFilteredLeads],
  )
  const allAdStats = useMemo(() => mergeMetaInsights(allRawAdStats, metaInsights), [allRawAdStats, metaInsights])

  const rawAdStats = useMemo(
    () => isDefaultFilter && selectedAds.length === 0 ? initialAdStats : aggregateByAd(filteredLeads),
    [isDefaultFilter, initialAdStats, filteredLeads, selectedAds.length],
  )
  const adStats = useMemo(() => mergeMetaInsights(rawAdStats, metaInsights), [rawAdStats, metaInsights])

  const monthlyData: MonthlyRow[] = useMemo(
    () => isDefaultFilter && selectedAds.length === 0 ? initialMonthlyData : aggregateByMonth(filteredLeads),
    [isDefaultFilter, initialMonthlyData, filteredLeads, selectedAds.length],
  )

  const cohortData = useMemo(
    () => buildCohortData(filteredLeads, rawCalls, selectedAds),
    [filteredLeads, rawCalls, selectedAds],
  )

  const kpi = useMemo(() => calcKpi(adStats), [adStats])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F5F7FA' }}>
      {/* ページヘッダー */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ padding: '16px 24px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 2 }}>アナリティクス</h1>
            <p style={{ fontSize: 11.5, color: '#9CA3AF' }}>
              広告 → リード → 受注 パフォーマンス分析
              <span style={{ marginLeft: 8, color: '#D1FAE5', background: '#065F46', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                {rawLeads.length.toLocaleString()}件
              </span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={excludeNoAd}
                onChange={(e) => setExcludeNoAd(e.target.checked)}
                style={{ accentColor: '#0D9488', width: 13, height: 13 }}
              />
              広告名未設定を除外
            </label>
            <button
              type="button"
              onClick={() => exportCsv(adStats)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
                background: '#fff', fontSize: 12, cursor: 'pointer',
              }}
            >
              CSV
            </button>
          </div>
        </div>

        <KpiCardRow kpi={kpi} excludeNoAd={excludeNoAd} />

        {/* タブバー */}
        <div style={{ display: 'flex', borderTop: '1px solid #E5E7EB', padding: '0 24px' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 16px', fontSize: 12.5, fontWeight: 500, border: 'none',
                background: 'none', cursor: 'pointer',
                color: activeTab === t.key ? '#0D9488' : '#9CA3AF',
                borderBottom: activeTab === t.key ? '2px solid #0D9488' : '2px solid transparent',
                transition: 'all .12s', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツエリア */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {/* 広告選択パネル（全タブ共通） */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            広告クリエイティブ選択（複数選択で比較）
          </div>
          <AdSelector ads={allAdStats} selected={selectedAds} onChange={setSelectedAds} />
        </div>

        {activeTab === 'ad_summary' && (
          <AdSummaryTab
            adStats={adStats}
            monthlyData={monthlyData}
            selectedMetrics={selectedMetrics}
            onMetricsChange={setSelectedMetrics}
            selectedAds={selectedAds}
          />
        )}
        {activeTab === 'lead_summary' && (
          <LeadSummaryTab cohortData={cohortData} allAdNames={adNames} />
        )}
        {activeTab === 'call_analysis' && (
          <CallAnalysisTab calls={rawCalls} dateRange={dateRange} />
        )}
        {activeTab === 'funnel' && (
          <FactorAnalysisTab adStats={adStats} />
        )}
      </div>
    </div>
  )
}
