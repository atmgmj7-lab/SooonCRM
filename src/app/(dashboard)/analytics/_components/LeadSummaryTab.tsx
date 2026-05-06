'use client'
import { useState } from 'react'
import type { CohortRow } from '../_lib/aggregations'

interface Props {
  cohortData: CohortRow[]
  allAdNames: string[]
}

type ViewMetric = 'appoRate' | 'kanryoRate' | 'callCount'

const METRIC_CONFIG: Record<ViewMetric, { label: string; format: (v: number) => string; color: string }> = {
  appoRate:   { label: 'アポ率',   format: (v) => `${v.toFixed(1)}%`, color: '#0D9488' },
  kanryoRate: { label: '完了率',   format: (v) => `${v.toFixed(1)}%`, color: '#6366F1' },
  callCount:  { label: '架電回数', format: (v) => v.toLocaleString(), color: '#F59E0B' },
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11.5,
  fontWeight: 600,
  color: '#374151',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '2px solid #E5E7EB',
}

const tdStyle: React.CSSProperties = {
  padding: '7px 12px',
  fontSize: 12,
  color: '#374151',
  whiteSpace: 'nowrap',
}

export function LeadSummaryTab({ cohortData, allAdNames }: Props) {
  const [selectedAds, setSelectedAds] = useState<string[]>([])
  const [viewMetric, setViewMetric]   = useState<ViewMetric>('appoRate')

  const mc = METRIC_CONFIG[viewMetric]

  const filtered = selectedAds.length === 0
    ? cohortData
    : cohortData.filter((r) => selectedAds.includes(r.adName))

  const visibleAdNames = selectedAds.length === 0 ? allAdNames : allAdNames.filter((a) => selectedAds.includes(a))

  // 合計行計算
  const totals = {
    leads: filtered.reduce((s, r) => s + r.leads, 0),
    m: (['m0', 'm1', 'm2', 'm3'] as const).map((mk) => {
      const vals = filtered.map((r) => r[mk][viewMetric] as number)
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }),
  }

  return (
    <div>
      {/* コントロール */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* 指標切替 */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, gap: 2 }}>
          {(Object.entries(METRIC_CONFIG) as [ViewMetric, typeof METRIC_CONFIG[ViewMetric]][]).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMetric(key)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12,
                background: viewMetric === key ? '#fff' : 'transparent',
                color:      viewMetric === key ? cfg.color : '#6B7280',
                fontWeight: viewMetric === key ? 600 : 400,
                boxShadow:  viewMetric === key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* 広告マルチセレクト */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            multiple
            value={selectedAds}
            onChange={(e) => setSelectedAds([...e.target.selectedOptions].map((o) => o.value))}
            style={{
              fontSize: 11.5, border: '1px solid #E5E7EB', borderRadius: 6,
              padding: '4px 8px', maxHeight: 80, minWidth: 200,
            }}
          >
            {allAdNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSelectedAds([])}
            style={{ fontSize: 11.5, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            全表示
          </button>
        </div>
      </div>

      {/* 説明 */}
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 12 }}>
        各流入月のリードが M0（流入月）→ M3（3ヶ月後）でどう推移したかを表示します。
        架電履歴（calls）がある場合はその時点の最新結果を優先、ない場合は leads.status を使用。
      </div>

      {/* コホートテーブル */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#F8FAFC', minWidth: 160 }}>広告名</th>
              <th style={{ ...thStyle, position: 'sticky', left: 160, background: '#F8FAFC', minWidth: 88 }}>流入月</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>リード数</th>
              {['M0（流入月）', 'M1（1ヶ月後）', 'M2（2ヶ月後）', 'M3（3ヶ月後）'].map((label) => (
                <th key={label} style={{ ...thStyle, background: '#F0FDF4', color: '#15803D', textAlign: 'right' }}>
                  {label}<br />
                  <span style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{mc.label}</span>
                </th>
              ))}
              <th style={{ ...thStyle, background: '#FFF7ED', color: '#92400E', textAlign: 'right' }}>
                M0→M3<br />
                <span style={{ fontSize: 10, fontWeight: 400 }}>変化</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleAdNames.map((adName) => {
              const adRows = filtered.filter((r) => r.adName === adName)
              if (adRows.length === 0) return null

              return adRows.map((row, rowIdx) => {
                const vals = [row.m0, row.m1, row.m2, row.m3].map((s) => s[viewMetric] as number)
                const delta = vals[3] - vals[0]

                return (
                  <tr
                    key={`${adName}-${row.leadMonth}`}
                    style={{ borderBottom: '1px solid #F1F5F9' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    {rowIdx === 0 && (
                      <td
                        rowSpan={adRows.length}
                        style={{
                          ...tdStyle, position: 'sticky', left: 0, background: '#fff',
                          fontWeight: 600, color: '#111827',
                          borderRight: '2px solid #E5E7EB',
                          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
                        }}
                      >
                        {adName}
                      </td>
                    )}
                    <td style={{ ...tdStyle, position: 'sticky', left: 160, background: '#fff', color: '#6B7280' }}>
                      {row.leadMonth}
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                      {row.leads.toLocaleString()}
                    </td>
                    {vals.map((val, i) => (
                      <td key={i} style={{
                        ...tdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                        color: mc.color, fontWeight: 600,
                        background: i === 3 ? 'rgba(13,148,136,.04)' : '',
                      }}>
                        {mc.format(val)}
                      </td>
                    ))}
                    <td style={{
                      ...tdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                      color: delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : '#9CA3AF',
                      fontWeight: 700,
                    }}>
                      {delta > 0 ? '+' : ''}{mc.format(delta)}
                    </td>
                  </tr>
                )
              })
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#F1F5F9', fontWeight: 700 }}>
              <td colSpan={2} style={{ ...tdStyle, color: '#374151' }}>合計 / 平均</td>
              <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                {totals.leads.toLocaleString()}
              </td>
              {totals.m.map((avg, i) => (
                <td key={i} style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: mc.color }}>
                  {mc.format(avg)}
                </td>
              ))}
              <td style={tdStyle} />
            </tr>
          </tfoot>
        </table>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>
          選択した広告のデータがありません
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 10.5, color: '#9CA3AF' }}>
        ※ calls と leads の紐づきは list_record_id を使用。紐づきがない場合は leads.status / last_call_result を参照。
      </div>
    </div>
  )
}
