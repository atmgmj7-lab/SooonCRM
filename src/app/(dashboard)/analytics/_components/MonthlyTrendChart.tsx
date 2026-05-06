'use client'

import { Fragment, useState } from 'react'
import dynamic from 'next/dynamic'
import type { MonthlyRow } from '../_lib/types'

const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const ComposedChart = dynamic(() => import('recharts').then((m) => m.ComposedChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false })

function formatMonth(m: string) {
  const [y, mo] = m.split('-')
  return `${y}/${mo}`
}

function pctStr(n: number | null): string {
  if (n == null) return '—'
  return n.toFixed(1) + '%'
}

type TableSection = {
  label: string
  color: string
  rows: { key: keyof MonthlyRow; label: string; isRate?: boolean }[]
}

const TABLE_SECTIONS: TableSection[] = [
  {
    label: 'リスト集計',
    color: '#0F6E56',
    rows: [
      { key: 'leads',     label: 'リード数' },
      { key: 'appo',      label: 'アポ数' },
      { key: 'chakuza',   label: '着座数' },
      { key: 'saiyoOk',   label: '採用OK' },
      { key: 'saiyoNg',   label: '採用NG' },
      { key: 'juchu',     label: '受注' },
      { key: 'kanryo',    label: '完了' },
      { key: 'ng',        label: 'NG' },
      { key: 'taishogai', label: '対象外' },
      { key: 'mikanryo',  label: '未完了' },
      { key: 'miCall',    label: '未コール' },
      { key: 'rusu',      label: '留守' },
      { key: 'mikomiA',   label: '見込みA' },
      { key: 'mikomiB',   label: '見込みB' },
      { key: 'mikomiC',   label: '見込みC' },
    ],
  },
  {
    label: '率指標',
    color: '#2563EB',
    rows: [
      { key: 'appoRate',          label: 'アポ率（対リスト）', isRate: true },
      { key: 'appoRateKanryo',    label: 'アポ率（対完了）',   isRate: true },
      { key: 'chakuzaRateList',   label: '着座率（対リスト）', isRate: true },
      { key: 'chakuzaRateAppo',   label: '着座率（対アポ）',   isRate: true },
      { key: 'kanryoRate',        label: 'リスト完了率',       isRate: true },
      { key: 'juchuRateList',     label: '受注率（対リスト）', isRate: true },
      { key: 'juchuRateShodan',   label: '受注率（対商談）',   isRate: true },
    ],
  },
]

function getTotals(data: MonthlyRow[]): MonthlyRow {
  const sum = (key: keyof MonthlyRow) =>
    data.reduce((s, r) => s + ((r[key] as number) ?? 0), 0)

  const leads    = sum('leads')
  const appo     = sum('appo')
  const chakuza  = sum('chakuza')
  const kanryo   = sum('kanryo')
  const juchu    = sum('juchu')

  const pct = (n: number, d: number): number | null => d > 0 ? (n / d) * 100 : null

  return {
    month: '合計',
    leads,
    appo,
    chakuza,
    juchu,
    chosei:    sum('chosei'),
    saiyoOk:   sum('saiyoOk'),
    saiyoNg:   sum('saiyoNg'),
    ng:        sum('ng'),
    taishogai: sum('taishogai'),
    kanryo,
    miCall:    sum('miCall'),
    rusu:      sum('rusu'),
    mikomiA:   sum('mikomiA'),
    mikomiB:   sum('mikomiB'),
    mikomiC:   sum('mikomiC'),
    mikanryo:  sum('mikanryo'),
    appoRate:          pct(appo, leads),
    appoRateKanryo:    pct(appo, kanryo),
    chakuzaRateList:   pct(chakuza, leads),
    chakuzaRateAppo:   pct(chakuza, appo),
    chakuzaRateKanryo: pct(chakuza, kanryo),
    juchuRateShodan:   pct(juchu, chakuza),
    juchuRateList:     pct(juchu, leads),
    kanryoRate:        pct(kanryo, leads),
  }
}

export function MonthlyTrendChart({ data }: { data: MonthlyRow[] }) {
  const [showTable, setShowTable] = useState(true)

  const chartData = data.map((row) => ({
    month: formatMonth(row.month),
    リード数: row.leads,
    アポ数: row.appo,
    アポ率: parseFloat((row.appoRate ?? 0).toFixed(1)),
  }))

  const totals = getTotals(data)
  const columns = [...data, totals]

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border flex items-center justify-center h-64" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
        <p className="text-[13px]" style={{ color: 'var(--color-gray-400)' }}>データがありません</p>
      </div>
    )
  }

  const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 600,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    color: 'var(--color-gray-600)',
    borderBottom: '1px solid var(--color-gray-200)',
    background: 'var(--color-gray-50)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 11.5,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    borderBottom: '1px solid var(--color-gray-100)',
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-gray-200)' }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-gray-900)' }}>月次推移</p>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          style={{
            fontSize: 11.5, padding: '3px 10px', border: '1px solid var(--color-gray-200)',
            borderRadius: 6, background: '#fff', cursor: 'pointer', color: 'var(--color-gray-600)',
          }}
        >
          {showTable ? 'テーブルを隠す' : 'テーブルを表示'}
        </button>
      </div>

      {/* グラフ */}
      <div className="p-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-gray-400)' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--color-gray-400)' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v + '%'} tick={{ fontSize: 11, fill: 'var(--color-gray-400)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, border: '1px solid var(--color-gray-200)', borderRadius: 8 }}
              formatter={(value, name) => [
                name === 'アポ率' ? String(value) + '%' : Number(value).toLocaleString(),
                name,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="リード数" fill="#E2E8F0" radius={[2, 2, 0, 0]} maxBarSize={40} />
            <Bar yAxisId="left" dataKey="アポ数" fill="#2563EB" radius={[2, 2, 0, 0]} maxBarSize={40} />
            <Line yAxisId="right" type="monotone" dataKey="アポ率" stroke="#0F6E56" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* サマリーテーブル */}
      {showTable && (
        <div style={{ borderTop: '1px solid var(--color-gray-200)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, minWidth: 140, background: 'var(--color-gray-50)' }}>
                  指標
                </th>
                {data.map((row) => (
                  <th key={row.month} style={thStyle}>
                    {formatMonth(row.month)}
                  </th>
                ))}
                <th style={{ ...thStyle, color: 'var(--color-gray-900)', fontWeight: 700, background: '#F0F7FF' }}>
                  合計
                </th>
              </tr>
            </thead>
            <tbody>
              {TABLE_SECTIONS.map((section) => (
                <Fragment key={section.label}>
                  {/* セクションヘッダー */}
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      style={{
                        padding: '5px 10px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: section.color,
                        background: section.color + '0D',
                        borderBottom: '1px solid var(--color-gray-200)',
                        borderTop: '1px solid var(--color-gray-200)',
                        letterSpacing: '.3px',
                      }}
                    >
                      {section.label}
                    </td>
                  </tr>
                  {section.rows.map(({ key, label, isRate }) => (
                    <tr key={key} style={{ background: 'transparent' }}>
                      <td style={{
                        ...tdStyle,
                        textAlign: 'left',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        background: '#fff',
                        color: 'var(--color-gray-600)',
                        fontWeight: 500,
                        borderRight: '1px solid var(--color-gray-100)',
                      }}>
                        {label}
                      </td>
                      {data.map((row) => {
                        const val = row[key] as number | null
                        return (
                          <td key={row.month} style={{ ...tdStyle, color: 'var(--color-gray-900)' }}>
                            {isRate ? pctStr(val) : (val ?? 0).toLocaleString()}
                          </td>
                        )
                      })}
                      {/* 合計列 */}
                      <td style={{
                        ...tdStyle,
                        color: 'var(--color-gray-900)',
                        fontWeight: 700,
                        background: '#F0F7FF',
                        borderLeft: '1px solid var(--color-gray-200)',
                      }}>
                        {isRate
                          ? pctStr(totals[key] as number | null)
                          : ((totals[key] as number) ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
