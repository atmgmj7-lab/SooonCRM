'use client'

import { useEffect, useState } from 'react'
import { ManagerTable } from '@/components/ads/manager-table'
import { CohortView } from '@/components/ads/cohort-view'
import { ColumnToggle, METRIC_DEFS, formatMetric } from '@/components/ads/column-toggle'
import type { AdSetDayRow, CreativeRow } from '@/components/ads/manager-table'
import type { CohortRow } from '@/components/ads/cohort-view'

const PERIOD_OPTIONS = [
  { label: '今月',  value: 'this_month' },
  { label: '先月',  value: 'last_month'  },
  { label: '90日',  value: '90d'         },
  { label: '180日', value: '180d'        },
]

/** 初期表示はこの媒体のみ（TikTok 等の手入力・旧データを画面から隠す） */
const PRIMARY_PLATFORMS = new Set(['meta', 'google'])

const PLATFORM_TABS: { value: 'all' | 'meta' | 'google'; label: string }[] = [
  { value: 'all', label: '全体' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
]

function normPlatform(p: string): string {
  return p.trim().toLowerCase()
}

function getPeriodDates(value: string): { since: string; until: string } {
  const now = new Date()
  const until = now.toISOString().slice(0, 10)
  if (value === 'this_month') {
    return { since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), until }
  }
  if (value === 'last_month') {
    return {
      since: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
      until: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10),
    }
  }
  const days = parseInt(value.replace('d', ''), 10)
  return { since: new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10), until }
}

export default function AdsPage() {
  const [period, setPeriod] = useState('this_month')
  const [activePlatform, setActivePlatform] = useState<'all' | 'meta' | 'google'>('all')
  const [roiData, setRoiData] = useState<AdSetDayRow[]>([])
  const [cohortData, setCohortData] = useState<CohortRow[]>([])
  const [creatives, setCreatives] = useState<CreativeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(METRIC_DEFS.filter((m) => m.defaultVisible).map((m) => m.key))
  )
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [checkedAdSets, setCheckedAdSets] = useState<Set<string>>(() => new Set())

  async function handleSync(mode: 'incremental' | 'full' = 'incremental') {
    if (syncing) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`/api/admin/sync-ads?mode=${mode}`, { method: 'POST' })
      if (res.ok) {
        const json = await res.json()
        if (json.message === 'Already up to date') {
          setSyncResult('最新です')
        } else {
          setSyncResult(mode === 'full' ? '全期間同期完了' : '同期完了（差分）')
          await new Promise((r) => setTimeout(r, 2000))
          window.location.reload()
          return
        }
      } else {
        let detail = '同期失敗'
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error) detail = `同期失敗: ${j.error}`
        } catch {
          /* ignore */
        }
        setSyncResult(detail)
      }
    } catch {
      setSyncResult('同期失敗')
    }
    await new Promise((r) => setTimeout(r, 3000))
    setSyncResult(null)
    setSyncing(false)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { since, until } = getPeriodDates(period)
        let res = await fetch(`/api/ads/roi?since=${since}&until=${until}`, { cache: 'no-store' })
        let json = await res.json()

        if (json.noTenant) {
          await fetch('/api/admin/setup-tenant', { method: 'POST' })
          res = await fetch(`/api/ads/roi?since=${since}&until=${until}`, { cache: 'no-store' })
          json = await res.json()
        }

        if (!cancelled) {
          const campaignMetaMap = new Map<string, { id: string; visible: boolean }>(
            (json.campaignMeta ?? []).map((c: { external_id: string; id: string; visible: boolean }) => [
              c.external_id,
              { id: c.id, visible: c.visible },
            ])
          )
          const enrichedRoi: AdSetDayRow[] = (json.roi ?? []).map((r: AdSetDayRow) => {
            const meta = campaignMetaMap.get(r.campaign_id)
            return { ...r, campaign_db_id: meta?.id ?? r.campaign_db_id, visible: meta?.visible ?? true }
          })
          setRoiData(enrichedRoi)
          setCohortData(json.cohort ?? [])
          setCreatives(json.creatives ?? [])
        }
      } catch (err) {
        console.error('Failed to load ads data:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [period])

  useEffect(() => {
    if (roiData.length === 0) return
    setCheckedAdSets(new Set())
  }, [roiData])

  const primaryRoiData = roiData.filter((r) => PRIMARY_PLATFORMS.has(normPlatform(r.platform)))

  const filteredRoiData =
    activePlatform === 'all'
      ? primaryRoiData
      : primaryRoiData.filter((r) => normPlatform(r.platform) === activePlatform)

  const tableEmptyMessage =
    primaryRoiData.length > 0 && filteredRoiData.length === 0
      ? 'この媒体の期間内データはありません'
      : undefined

  const adSetOptions: { id: string; name: string }[] = []
  const seenAdSet = new Set<string>()
  for (const r of filteredRoiData) {
    if (!seenAdSet.has(r.ad_set_id)) {
      seenAdSet.add(r.ad_set_id)
      adSetOptions.push({ id: r.ad_set_id, name: r.ad_set_name })
    }
  }
  adSetOptions.sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  const totalSpend = filteredRoiData.reduce((s, r) => s + r.spend, 0)
  const totalLeads = filteredRoiData.reduce((s, r) => s + r.leads_count, 0)
  const totalWon = filteredRoiData.reduce((s, r) => s + r.won_count, 0)
  const totalWonAmount = filteredRoiData.reduce((s, r) => s + r.won_amount, 0)
  const avgRoas = totalSpend > 0 ? (totalWonAmount / totalSpend) * 100 : 0
  const avgCpo = totalWon > 0 ? totalSpend / totalWon : 0

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
          広告マネージャー
        </h1>
        <div className="flex items-center gap-3">
          <div
            className="flex rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--color-gray-200)' }}
          >
            {PERIOD_OPTIONS.map((o, i) => (
              <button
                key={o.value}
                onClick={() => setPeriod(o.value)}
                className="px-4 py-1.5 text-[13px] font-medium transition-colors duration-150"
                style={{
                  background: period === o.value ? 'var(--color-blue)' : 'var(--color-white)',
                  color: period === o.value ? 'var(--color-white)' : 'var(--color-gray-600)',
                  borderRight: i < PERIOD_OPTIONS.length - 1 ? '1px solid var(--color-gray-200)' : 'none',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <ColumnToggle visible={visibleCols} onChange={setVisibleCols} />
          {syncResult != null && (
            <span className="text-[12px]" style={{ color: 'var(--color-gray-600)' }}>{syncResult}</span>
          )}
          <button
            type="button"
            onClick={() => handleSync('full')}
            disabled={syncing}
            className="rounded-lg px-4 py-2 text-[13px] font-medium border transition-colors duration-150 disabled:cursor-not-allowed"
            style={{
              borderColor: 'var(--color-gray-200)',
              background: syncing ? 'var(--color-gray-100)' : 'var(--color-white)',
              color: syncing ? 'var(--color-gray-400)' : 'var(--color-gray-700)',
            }}
          >
            全期間同期
          </button>
          <button
            type="button"
            onClick={() => handleSync('incremental')}
            disabled={syncing}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed"
            style={{
              background: syncing ? 'var(--color-gray-400)' : 'var(--color-blue)',
            }}
          >
            {syncing ? '同期中…' : '手動同期'}
          </button>
        </div>
      </div>

      {/* 媒体タブ（全体 / Meta / Google 固定） */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex gap-1 flex-wrap">
          {PLATFORM_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActivePlatform(tab.value)}
              className="px-4 py-1.5 text-[13px] font-medium rounded-lg transition-colors duration-150"
              style={{
                background: activePlatform === tab.value ? 'var(--color-blue)' : 'transparent',
                color: activePlatform === tab.value ? 'var(--color-white)' : 'var(--color-gray-600)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '広告費',  value: formatMetric(totalSpend, '円') },
          { label: 'リード数', value: formatMetric(totalLeads, '件') },
          { label: 'ROAS',    value: formatMetric(avgRoas, '%') },
          { label: 'CPO',     value: formatMetric(avgCpo, '円') },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border p-4"
            style={{ background: 'var(--color-white)', borderColor: 'var(--color-gray-200)' }}
          >
            <p className="text-[12px] mb-1" style={{ color: 'var(--color-gray-400)' }}>
              {kpi.label}
            </p>
            <p className="text-[22px] font-bold tabular-nums" style={{ color: 'var(--color-gray-900)' }}>
              {loading ? (
                <span
                  className="inline-block w-24 h-6 rounded animate-pulse"
                  style={{ background: 'var(--color-gray-100)' }}
                />
              ) : (
                kpi.value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Manager table */}
      <div className="mb-6">
        {!loading && adSetOptions.length > 0 && (
          <div className='rounded-xl border mb-4 px-4 py-3' style={{ background: 'var(--color-white)', borderColor: 'var(--color-gray-200)' }}>
            <div className='flex items-center gap-3 mb-2'>
              <span className='text-[13px] font-semibold' style={{ color: 'var(--color-gray-900)' }}>表示する広告を選択</span>
              <button type='button' className='px-2.5 py-1 text-[12px] rounded border transition-colors duration-150' style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-600)' }} onClick={() => setCheckedAdSets(new Set(adSetOptions.map((o) => o.id)))}>すべて選択</button>
              <button type='button' className='px-2.5 py-1 text-[12px] rounded border transition-colors duration-150' style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-600)' }} onClick={() => setCheckedAdSets(new Set())}>すべて解除</button>
              <span className='text-[11px]' style={{ color: 'var(--color-gray-400)' }}>{checkedAdSets.size === 0 ? '全件表示中' : checkedAdSets.size + '件選択中'}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              {adSetOptions.map((o) => (
                <label key={o.id} className='flex items-center gap-1.5 cursor-pointer' style={{ fontSize: 12, color: 'var(--color-gray-700)' }}>
                  <input type='checkbox' checked={checkedAdSets.size === 0 || checkedAdSets.has(o.id)} onChange={() => { setCheckedAdSets((prev) => { const base = prev.size === 0 ? new Set(adSetOptions.map((x) => x.id)) : new Set(prev); if (base.has(o.id)) base.delete(o.id); else base.add(o.id); return base }) }} className='accent-[var(--color-blue)]' />
                  {o.name}
                </label>
              ))}
            </div>
          </div>
        )}
        {loading ? (
          <div
            className="rounded-xl border flex items-center justify-center py-16 text-[13px] animate-pulse"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-400)' }}
          >
            読み込み中…
          </div>
        ) : (
          <ManagerTable
            data={filteredRoiData}
            visibleCols={visibleCols}
            checkedAdSets={checkedAdSets}
            emptyMessage={tableEmptyMessage}
          />
        )}
      </div>

      {/* Cohort heatmap */}
      {!loading && (
        <CohortView
          data={cohortData.filter((r) => PRIMARY_PLATFORMS.has(normPlatform(r.platform)))}
        />
      )}
    </div>
  )
}
