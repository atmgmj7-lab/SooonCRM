'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { AdSummaryRow } from '../_lib/types'

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const PieChart             = dynamic(() => import('recharts').then((m) => m.PieChart),             { ssr: false })
const Pie                  = dynamic(() => import('recharts').then((m) => m.Pie),                  { ssr: false })
const Tooltip              = dynamic(() => import('recharts').then((m) => m.Tooltip),              { ssr: false })

type SortKey = 'leads' | 'appoRate' | 'kanryoRate' | 'chakuzaRateAppo' | 'juchuRateShodan'

const tdR: React.CSSProperties = { padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

export function FactorAnalysisTab({ adStats }: { adStats: AdSummaryRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('leads')

  const sorted = [...adStats].sort((a, b) => {
    const av = (a[sortKey] as number | null) ?? 0
    const bv = (b[sortKey] as number | null) ?? 0
    return bv - av
  })

  const safeAvg = (key: keyof AdSummaryRow) => {
    const vals = adStats.map((a) => (a[key] as number | null) ?? 0).filter((v) => v > 0)
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }

  const avgAppoRate    = safeAvg('appoRate')
  const avgChakuzaRate = safeAvg('chakuzaRateAppo')
  const avgJuchuRate   = safeAvg('juchuRateShodan')

  const getBottleneck = (row: AdSummaryRow): string => {
    const stages: string[] = []
    if (((row.appoRate      ?? 0) < avgAppoRate    * 0.8) && avgAppoRate    > 0) stages.push('リード→アポ')
    if (((row.chakuzaRateAppo ?? 0) < avgChakuzaRate * 0.8) && avgChakuzaRate > 0) stages.push('アポ→着座')
    if (((row.juchuRateShodan ?? 0) < avgJuchuRate   * 0.8) && avgJuchuRate   > 0) stages.push('着座→受注')
    return stages.length > 0 ? `⚠️ ${stages.join(' / ')}` : '✅ 平均以上'
  }

  const totalLeads  = adStats.reduce((s, a) => s + a.leads, 0)
  const totalAppo   = adStats.reduce((s, a) => s + a.appo, 0)
  const totalChakuza = adStats.reduce((s, a) => s + a.chakuza, 0)
  const totalJuchu  = adStats.reduce((s, a) => s + a.juchu, 0)

  const funnelStages = [
    { label: 'リード',  value: totalLeads,   color: '#0D9488' },
    { label: 'アポOK', value: totalAppo,    color: '#10B981' },
    { label: '着座',    value: totalChakuza, color: '#6366F1' },
    { label: '受注',    value: totalJuchu,   color: '#F59E0B' },
  ]

  const pieAppo = [
    { name: '調整中',  value: adStats.reduce((s, a) => s + a.chosei, 0),   fill: '#93C5FD' },
    { name: '採用OK',  value: adStats.reduce((s, a) => s + a.saiyoOk, 0),  fill: '#6366F1' },
    { name: '採用NG',  value: adStats.reduce((s, a) => s + a.saiyoNg, 0),  fill: '#FCA5A5' },
    { name: '受注',    value: adStats.reduce((s, a) => s + a.juchu, 0),     fill: '#0D9488' },
  ].filter((d) => d.value > 0)

  const pieMikanryo = [
    { name: '未コール', value: adStats.reduce((s, a) => s + a.miCall, 0),   fill: '#E5E7EB' },
    { name: '留守',     value: adStats.reduce((s, a) => s + a.rusu, 0),      fill: '#94A3B8' },
    { name: '見込みA',  value: adStats.reduce((s, a) => s + a.mikomiA, 0),  fill: '#FCD34D' },
    { name: '見込みB',  value: adStats.reduce((s, a) => s + a.mikomiB, 0),  fill: '#F59E0B' },
    { name: '見込みC',  value: adStats.reduce((s, a) => s + a.mikomiC, 0),  fill: '#D97706' },
  ].filter((d) => d.value > 0)

  const sortCols: { key: SortKey; label: string }[] = [
    { key: 'leads',            label: 'リード数' },
    { key: 'appoRate',         label: 'アポ率' },
    { key: 'kanryoRate',       label: '完了率' },
    { key: 'chakuzaRateAppo',  label: '着座率\n(対アポ)' },
    { key: 'juchuRateShodan',  label: '受注率\n(対着座)' },
  ]

  return (
    <div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        各広告のコンバージョン率を段階ごとに分解し、ボトルネックを自動判定します。平均値の80%未満の段階を⚠️で強調表示。
      </div>

      {/* ファネルウォーターフォール */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 24,
        background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden',
      }}>
        {funnelStages.map((stage, i) => {
          const pct = i === 0 ? 100 : totalLeads > 0 ? (stage.value / totalLeads) * 100 : 0
          return (
            <div key={stage.label} style={{
              flex: 1, padding: '16px 12px', textAlign: 'center',
              borderRight: i < funnelStages.length - 1 ? '1px solid #F1F5F9' : 'none',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: stage.color }}>
                {stage.value.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{stage.label}</div>
              <div style={{ fontSize: 12, color: stage.color, fontWeight: 600, marginTop: 4 }}>
                {i === 0 ? '' : `↓ ${pct.toFixed(1)}%`}
              </div>
            </div>
          )
        })}
      </div>

      {/* パイチャート2つ */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>アポOK内訳</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieAppo}
                dataKey="value"
                cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>未完了内訳</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieMikanryo}
                dataKey="value"
                cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 広告別ボトルネック分析テーブル */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>広告別ボトルネック分析</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
        平均アポ率: {avgAppoRate.toFixed(1)}% ／ 平均着座率: {avgChakuzaRate.toFixed(1)}% ／ 平均受注率: {avgJuchuRate.toFixed(1)}%
      </div>

      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead style={{ background: '#F8FAFC' }}>
            <tr>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', textAlign: 'left', borderBottom: '1px solid #E5E7EB', position: 'sticky', left: 0, background: '#F8FAFC' }}>
                広告名
              </th>
              {sortCols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => setSortKey(col.key)}
                  style={{
                    padding: '8px 12px', fontWeight: 600,
                    color: sortKey === col.key ? '#0D9488' : '#374151',
                    textAlign: 'right', borderBottom: '1px solid #E5E7EB',
                    cursor: 'pointer', whiteSpace: 'pre',
                  }}
                >
                  {col.label} {sortKey === col.key ? '▼' : ''}
                </th>
              ))}
              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>
                ボトルネック
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.adName} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '7px 12px', fontWeight: 600, position: 'sticky', left: 0, background: 'inherit', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.adName}
                </td>
                <td style={tdR}>{row.leads.toLocaleString()}</td>
                <td style={{
                  ...tdR, fontWeight: 600,
                  color: (row.appoRate ?? 0) < avgAppoRate * 0.8 && avgAppoRate > 0 ? '#EF4444' : '#0D9488',
                }}>
                  {row.appoRate != null ? `${row.appoRate.toFixed(1)}%` : '-'}
                </td>
                <td style={tdR}>
                  {row.kanryoRate != null ? `${row.kanryoRate.toFixed(1)}%` : '-'}
                </td>
                <td style={{
                  ...tdR, fontWeight: 600,
                  color: (row.chakuzaRateAppo ?? 0) < avgChakuzaRate * 0.8 && avgChakuzaRate > 0 ? '#EF4444' : '#0D9488',
                }}>
                  {row.chakuzaRateAppo != null ? `${row.chakuzaRateAppo.toFixed(1)}%` : '-'}
                </td>
                <td style={{
                  ...tdR, fontWeight: 600,
                  color: (row.juchuRateShodan ?? 0) < avgJuchuRate * 0.8 && avgJuchuRate > 0 ? '#EF4444' : '#0D9488',
                }}>
                  {row.juchuRateShodan != null ? `${row.juchuRateShodan.toFixed(1)}%` : '-'}
                </td>
                <td style={{ padding: '7px 12px', fontSize: 11, whiteSpace: 'nowrap' }}>
                  {getBottleneck(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
