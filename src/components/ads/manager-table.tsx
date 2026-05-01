'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { METRIC_DEFS, formatMetric } from './column-toggle'
import type { MetricDef } from './column-toggle'

export interface CreativeRow {
  id: string
  campaign_id: string
  external_id: string
  name: string
  thumbnail_url: string | null
  visible: boolean
}

/** 広告セット × 日次（1行 = 1日・1広告セット） */
export interface AdSetDayRow {
  spend_date: string
  platform: string
  campaign_id: string
  campaign_name: string
  campaign_db_id: string
  ad_set_id: string
  ad_set_name: string
  ad_set_db_id: string
  visible: boolean
  spend: number
  leads_count: number
  apo_count: number
  won_count: number
  won_amount: number
  impressions: number
  clicks: number
  roas: number
  cpo: number
  cpa: number
  cpc: number
  cpm: number
  reach?: number | null
  ctr?: number | null
  ad_name?: string | null
}

interface ManagerTableProps {
  data: AdSetDayRow[]
  visibleCols: Set<string>
  checkedAdSets: Set<string>
  emptyMessage?: string
}

type MetricAgg = Record<string, number | null | undefined>

function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

function sumRows(rows: AdSetDayRow[], pick: (r: AdSetDayRow) => number): number {
  let s = 0
  for (const r of rows) {
    s += pick(r)
  }
  return s
}

function aggregateMetrics(rows: AdSetDayRow[]): MetricAgg {
  const totalSpend = sumRows(rows, (r) => r.spend)
  const totalLeads = sumRows(rows, (r) => r.leads_count)
  const totalClicks = sumRows(rows, (r) => r.clicks ?? 0)
  const totalReach = sumRows(rows, (r) => r.reach ?? 0)
  const totalImpressions = sumRows(rows, (r) => r.impressions ?? 0)
  const totalWon = sumRows(rows, (r) => r.won_count)
  const totalWonAmount = sumRows(rows, (r) => r.won_amount)
  const totalApo = sumRows(rows, (r) => r.apo_count)

  return {
    spend: totalSpend,
    leads_count: totalLeads,
    clicks: totalClicks,
    reach: totalReach,
    impressions: totalImpressions,
    ctr:
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : null,
    cpm:
      totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : null,
    cpa: totalLeads > 0 ? totalSpend / totalLeads : null,
    cpo: totalWon > 0 ? totalSpend / totalWon : null,
    roas: totalSpend > 0 ? (totalWonAmount / totalSpend) * 100 : null,
    apo_rate: totalLeads > 0 ? (totalApo / totalLeads) * 100 : null,
    won_rate: totalApo > 0 ? (totalWon / totalApo) * 100 : null,
  }
}

function rowMetricValue(row: AdSetDayRow, key: string): number | null | undefined {
  const imp = row.impressions ?? 0
  const clk = row.clicks ?? 0
  const leads = row.leads_count
  const apo = row.apo_count
  const won = row.won_count

  switch (key) {
    case 'spend':
      return row.spend
    case 'leads_count':
      return row.leads_count
    case 'clicks':
      return row.clicks ?? undefined
    case 'reach':
      return row.reach ?? undefined
    case 'impressions':
      return row.impressions ?? undefined
    case 'ctr':
      return imp > 0 ? (clk / imp) * 100 : null
    case 'cpc':
      return clk > 0 ? row.spend / clk : null
    case 'cpm':
      return imp > 0 ? (row.spend / imp) * 1000 : null
    case 'cpa':
      return leads > 0 ? row.spend / leads : null
    case 'cpo':
      return won > 0 ? row.spend / won : null
    case 'roas':
      return row.spend > 0 ? (row.won_amount / row.spend) * 100 : null
    case 'apo_rate':
      return leads > 0 ? (apo / leads) * 100 : null
    case 'won_rate':
      return apo > 0 ? (won / apo) * 100 : null
    default:
      return undefined
  }
}

export function ManagerTable({
  data,
  visibleCols,
  checkedAdSets,
  emptyMessage,
}: ManagerTableProps) {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(() => new Set())

  const filtered =
    checkedAdSets.size === 0 ? data : data.filter((r) => checkedAdSets.has(r.ad_set_id))

  const groupsMap = new Map<string, AdSetDayRow[]>()
  for (const r of filtered) {
    const list = groupsMap.get(r.ad_set_id)
    if (list) list.push(r)
    else groupsMap.set(r.ad_set_id, [r])
  }

  const groups = [...groupsMap.entries()].map(([adSetId, rows]) => {
    const sortedRows = [...rows].sort((a, b) => b.spend_date.localeCompare(a.spend_date))
    const maxDate = sortedRows[0]?.spend_date ?? ''
    const first = sortedRows[0]
    return {
      adSetId,
      rows: sortedRows,
      maxDate,
      campaign_id: first?.campaign_id ?? '',
      campaign_name: first?.campaign_name ?? '',
      ad_set_name: first?.ad_set_name ?? '',
    }
  })

  groups.sort((a, b) => b.maxDate.localeCompare(a.maxDate))

  const activeDefs = METRIC_DEFS.filter((m) => visibleCols.has(m.key))

  function toggleExpanded(adSetId: string) {
    setExpandedSets((prev) => {
      const next = new Set(prev)
      if (next.has(adSetId)) next.delete(adSetId)
      else next.add(adSetId)
      return next
    })
  }

  if (groups.length === 0) {
    const defaultMsg =
      'データがありません。「全期間同期」で Meta の広告セット日次を取り込んでください（Vercel に META_ACCESS_TOKEN / META_AD_ACCOUNT_ID が必要です）。'
    const secondary =
      data.length > 0 && filtered.length === 0
        ? '表示対象がありません（選択中の広告セットがないか、データがこの期間にありません）。'
        : null
    return (
      <div
        className="rounded-xl border flex flex-col items-center justify-center gap-1 py-16 px-6 text-[13px] text-center"
        style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-gray-400)' }}
      >
        <span>{emptyMessage ?? secondary ?? defaultMsg}</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: 'var(--color-gray-200)' }}>
      <table className="w-full text-[13px] border-collapse min-w-[880px]">
        <thead>
          <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
            <th
              className="text-left p-2 font-medium whitespace-nowrap"
              style={{ width: 24, color: 'var(--color-gray-600)' }}
            />
            <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--color-gray-600)' }}>
              広告セット名
            </th>
            {activeDefs.map((m) => (
              <th key={m.key} className="text-right px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--color-gray-600)' }}>
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const agg = aggregateMetrics(g.rows)
            const expanded = expandedSets.has(g.adSetId)
            return (
              <FragmentRows
                key={g.adSetId}
                group={g}
                agg={agg}
                expanded={expanded}
                onToggle={() => toggleExpanded(g.adSetId)}
                activeDefs={activeDefs}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRows({
  group,
  agg,
  expanded,
  onToggle,
  activeDefs,
}: {
  group: {
    adSetId: string
    rows: AdSetDayRow[]
    campaign_name: string
    ad_set_name: string
  }
  agg: MetricAgg
  expanded: boolean
  onToggle: () => void
  activeDefs: MetricDef[]
}) {
  return (
    <>
      <tr style={{ background: '#F5F5F5', borderBottom: '1px solid var(--color-gray-200)', fontWeight: 600 }}>
        <td className="align-middle p-0" style={{ width: 24 }}>
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded hover:bg-gray-200 transition-colors duration-150"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown size={14} style={{ color: 'var(--color-gray-600)' }} />
            ) : (
              <ChevronRight size={14} style={{ color: 'var(--color-gray-600)' }} />
            )}
          </button>
        </td>
        <td className="align-middle px-4 py-2 text-[12px]" style={{ color: 'var(--color-gray-900)' }}>
          <div className="leading-snug">
            <div className="truncate max-w-[280px]" title={group.campaign_name}>
              {group.campaign_name}
            </div>
            <div className="truncate max-w-[280px]" style={{ color: 'var(--color-gray-600)' }} title={group.ad_set_name}>
              {group.ad_set_name}
            </div>
          </div>
        </td>
        {activeDefs.map((m) => (
          <MetricCell key={m.key} def={m} value={agg[m.key] as number | null | undefined} />
        ))}
      </tr>
      {expanded &&
        group.rows.map((row) => (
          <tr
            key={`${row.ad_set_id}-${row.spend_date}`}
            style={{ background: 'var(--color-white)', borderBottom: '1px solid var(--color-gray-200)' }}
          >
            <td className="px-2 py-2" style={{ width: 24 }} />
            <td className="px-4 py-2 text-[12px] tabular-nums whitespace-nowrap align-middle" style={{ color: 'var(--color-gray-900)' }}>
              {formatDayLabel(row.spend_date)}
            </td>
            {activeDefs.map((m) => (
              <MetricCell key={m.key} def={m} value={rowMetricValue(row, m.key)} />
            ))}
          </tr>
        ))}
    </>
  )
}

function MetricCell({
  def,
  value,
}: {
  def: MetricDef
  value: number | null | undefined
}) {
  const isCalculated = def.isCalculated === true
  return (
    <td
      className="px-4 py-2 text-right tabular-nums text-[12px]"
      style={{
        color: 'var(--color-gray-900)',
        ...(isCalculated ? { background: '#FFF3E0' } : {}),
      }}
    >
      {formatMetric(value, def.unit)}
    </td>
  )
}
