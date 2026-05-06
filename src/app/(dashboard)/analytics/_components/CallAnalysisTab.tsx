'use client'
import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { CallRecord } from '../_lib/types'
import type { DateRange } from '@/components/ui/DateRangePicker'
import { aggregateCallsByMonth, aggregateCallsByAgent, aggregateCallsByHour } from '../_lib/callAggregations'

// Recharts（SSR無効）
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const ComposedChart        = dynamic(() => import('recharts').then((m) => m.ComposedChart),        { ssr: false })
const BarChart             = dynamic(() => import('recharts').then((m) => m.BarChart),             { ssr: false })
const Bar                  = dynamic(() => import('recharts').then((m) => m.Bar),                  { ssr: false })
const Cell                 = dynamic(() => import('recharts').then((m) => m.Cell),                 { ssr: false })
const Line                 = dynamic(() => import('recharts').then((m) => m.Line),                 { ssr: false })
const XAxis                = dynamic(() => import('recharts').then((m) => m.XAxis),                { ssr: false })
const YAxis                = dynamic(() => import('recharts').then((m) => m.YAxis),                { ssr: false })
const CartesianGrid        = dynamic(() => import('recharts').then((m) => m.CartesianGrid),        { ssr: false })
const Tooltip              = dynamic(() => import('recharts').then((m) => m.Tooltip),              { ssr: false })
const Legend               = dynamic(() => import('recharts').then((m) => m.Legend),               { ssr: false })

type SubView = 'monthly' | 'agent' | 'hourly'

const pillStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: active ? 600 : 400,
  background: active ? '#0D9488' : '#F1F5F9',
  color:      active ? '#fff'    : '#6B7280',
  transition: 'all .12s',
})

const tdR: React.CSSProperties = { padding: '7px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const tdL: React.CSSProperties = { padding: '7px 12px', whiteSpace: 'nowrap' }

export function CallAnalysisTab({ calls, dateRange }: { calls: CallRecord[]; dateRange: DateRange }) {
  const [subView, setSubView] = useState<SubView>('monthly')

  const filtered = useMemo(() => {
    let c = calls
    if (dateRange.from) c = c.filter((x) => x.call_date && new Date(x.call_date) >= dateRange.from!)
    if (dateRange.to)   c = c.filter((x) => x.call_date && new Date(x.call_date) <= dateRange.to!)
    return c
  }, [calls, dateRange])

  const monthlyData = useMemo(() => aggregateCallsByMonth(filtered), [filtered])
  const agentData   = useMemo(() => aggregateCallsByAgent(filtered),  [filtered])
  const hourlyData  = useMemo(() => aggregateCallsByHour(filtered),   [filtered])

  const hourlyChartData = Object.entries(hourlyData).map(([h, d]) => ({
    hour:  `${h}時`,
    rate:  d.total > 0 ? (d.connected / d.total) * 100 : 0,
    total: d.total,
  }))

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 13 }}>
        選択期間のコールデータがありません
      </div>
    )
  }

  return (
    <div>
      {/* サブビュー切替 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([
          { key: 'monthly', label: '月次コール推移' },
          { key: 'agent',   label: '担当者別成績' },
          { key: 'hourly',  label: '時間帯別分析' },
        ] as { key: SubView; label: string }[]).map((v) => (
          <button key={v.key} type="button" onClick={() => setSubView(v.key)} style={pillStyle(subView === v.key)}>
            {v.label}
          </button>
        ))}
      </div>

      {/* 月次コール推移 */}
      {subView === 'monthly' && (
        <>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>月次コール推移</div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="totalCalls" name="架電数" fill="#94A3B8" fillOpacity={0.7} radius={[2, 2, 0, 0]} />
                <Bar yAxisId="left" dataKey="appo"       name="アポ数" fill="#0D9488"                  radius={[2, 2, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="appoRate" name="アポ率" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
              <thead style={{ background: '#F8FAFC' }}>
                <tr>
                  {['月', '架電数', 'アポ', 'NG', '留守', 'アポ率', '平均通話(分)', 'ユニークリード'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => (
                  <tr key={row.month} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ ...tdL, fontVariantNumeric: 'tabular-nums' }}>{row.month}</td>
                    <td style={tdR}>{row.totalCalls.toLocaleString()}</td>
                    <td style={{ ...tdR, color: '#0D9488', fontWeight: 600 }}>{row.appo}</td>
                    <td style={{ ...tdR, color: '#EF4444' }}>{row.ng}</td>
                    <td style={{ ...tdR, color: '#6B7280' }}>{row.rusu}</td>
                    <td style={{ ...tdR, color: '#F59E0B', fontWeight: 600 }}>{row.appoRate.toFixed(1)}%</td>
                    <td style={tdR}>{row.avgDuration.toFixed(1)}</td>
                    <td style={tdR}>{row.uniqueLeads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 担当者別成績 */}
      {subView === 'agent' && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead style={{ background: '#F8FAFC' }}>
              <tr>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>担当者</th>
                {['架電数', 'アポ数', 'NG数', '留守数', 'アポ率', '平均通話(分)', 'ユニークリード'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', textAlign: 'right', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agentData.map((row, i) => (
                <tr key={row.agentName} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ ...tdL, fontWeight: 600 }}>{row.agentName}</td>
                  <td style={tdR}>{row.totalCalls.toLocaleString()}</td>
                  <td style={{ ...tdR, color: '#0D9488', fontWeight: 600 }}>{row.appo}</td>
                  <td style={{ ...tdR, color: '#EF4444' }}>{row.ng}</td>
                  <td style={{ ...tdR, color: '#6B7280' }}>{row.rusu}</td>
                  <td style={{ ...tdR, color: '#F59E0B', fontWeight: 700 }}>{row.appoRate.toFixed(1)}%</td>
                  <td style={tdR}>{row.avgDuration.toFixed(1)}</td>
                  <td style={tdR}>{row.uniqueLeads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 時間帯別接続率 */}
      {subView === 'hourly' && (
        <>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
            接続率 = 留守・NG・未コール以外の架電 ÷ 総架電数（8〜20時のみ集計）
          </div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={(v: any) => [`${Number(v ?? 0).toFixed(1)}%`, '接続率']} />
                <Bar dataKey="rate" name="接続率" radius={[3, 3, 0, 0]}>
                  {hourlyChartData.map((entry) => {
                    const color = entry.rate >= 40 ? '#0D9488' : entry.rate >= 25 ? '#F59E0B' : '#94A3B8'
                    return <Cell key={entry.hour} fill={color} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
