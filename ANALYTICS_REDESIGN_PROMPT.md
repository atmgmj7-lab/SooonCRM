# アナリティクス 全面再設計 実装プロンプト

> **前提**: leads 2,822件取得済み・ビルドクリーン・list_created_at カラム追加済み
> **tenant_id**: `dde9bea6-a017-49e6-a1b6-88494e1e3b4d`
> **実装順序**: 必ず上から順番に。STEP間でビルドエラーがあれば止まって報告すること。

---

## STEP 0: 事前調査（実装前に必ず実行・結果を出力）

```sql
-- ① callsテーブルの実際のカラム構造を確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'calls'
ORDER BY ordinal_position;

-- ② callsの件数とlead_id/list_record_id紐づき状況
SELECT
  COUNT(*) AS total_calls,
  COUNT(lead_id) AS has_lead_id,
  COUNT(list_record_id) AS has_list_record_id,
  COUNT(DISTINCT agent_name) AS unique_agents
FROM calls
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';

-- ③ callsのcall_resultに存在する全値（ステータス定数確認用）
SELECT call_result, COUNT(*) AS cnt
FROM calls
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
GROUP BY call_result
ORDER BY cnt DESC;

-- ④ leadsのstatusに存在する全値（実態確認）
SELECT status, COUNT(*) AS cnt
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
GROUP BY status
ORDER BY cnt DESC;

-- ⑤ コホート分析用: リード流入月 × 1/2/3ヶ月後のアポ状況を確認
-- leadsとcallsが結合できるか確認
SELECT
  to_char(l.inquiry_at, 'YYYY-MM') AS lead_month,
  COUNT(DISTINCT l.id) AS leads,
  COUNT(DISTINCT c.id) AS total_calls
FROM leads l
LEFT JOIN calls c ON c.lead_id = l.id OR c.list_record_id = l.list_record_id
WHERE l.tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND l.inquiry_at IS NOT NULL
GROUP BY lead_month
ORDER BY lead_month DESC
LIMIT 15;
```

STEP 0の結果を出力した後、以下の実装を開始してください。

---

## STEP 1: タブ構成の全面再設計

`src/app/(dashboard)/analytics/_components/AnalyticsClient.tsx` のタブ定義を以下に完全置き換えしてください。

```typescript
const TABS = [
  { key: 'ad_summary',    label: '広告サマリー',   icon: '📊' },
  { key: 'lead_summary',  label: 'リードサマリー', icon: '📈' },
  { key: 'call_analysis', label: 'コール分析',     icon: '📞' },
  { key: 'funnel',        label: 'ファクター分析', icon: '🔍' },
] as const

type TabKey = typeof TABS[number]['key']
```

---

## STEP 2: 広告サマリータブ（サブタブ付き）

### 2-1. AdSummaryTab コンポーネントを新規作成

`src/app/(dashboard)/analytics/_components/AdSummaryTab.tsx`

このタブ内にさらにサブタブを設け、広告別と月次を切り替えられるようにします。

```typescript
'use client'
import { useState } from 'react'

type SubTab = 'by_ad' | 'by_month'

interface Props {
  adStats: AdSummaryRow[]
  monthlyData: MonthlyRow[]
  selectedMetrics: MetricKey[]
  onMetricsChange: (keys: MetricKey[]) => void
  selectedAds: string[]
}

export function AdSummaryTab({ adStats, monthlyData, selectedMetrics, onMetricsChange, selectedAds }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('by_ad')

  return (
    <div>
      {/* サブタブ */}
      <div style={{
        display: 'inline-flex',
        background: '#F1F5F9',
        borderRadius: 8,
        padding: 3,
        gap: 2,
        marginBottom: 16,
      }}>
        {[
          { key: 'by_ad',    label: '広告別' },
          { key: 'by_month', label: '月次推移' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key as SubTab)}
            style={{
              padding: '5px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: subTab === t.key ? 600 : 400,
              background: subTab === t.key ? '#fff' : 'transparent',
              color: subTab === t.key ? '#0D9488' : '#6B7280',
              boxShadow: subTab === t.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              transition: 'all .12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 指標選択（両サブタブ共通） */}
      <MetricSelector selected={selectedMetrics} onChange={onMetricsChange} />

      {/* グラフ + テーブル */}
      {subTab === 'by_ad' && (
        <>
          {/* 広告別グラフ: X軸=広告名（短縮）, Y軸=選択指標 */}
          <DynamicChart
            data={adStats.map(a => ({
              x: a.adName.slice(0, 12) + (a.adName.length > 12 ? '…' : ''),
              ...a,
            }))}
            xKey="x"
            selectedMetrics={selectedMetrics}
            title="広告別指標比較"
          />
          <AdSummaryTable data={adStats} />
        </>
      )}

      {subTab === 'by_month' && (
        <>
          {/* 月次グラフ: X軸=月, Y軸=選択指標 × 選択広告 */}
          <MonthlyTrendChart
            data={monthlyData}
            selectedMetrics={selectedMetrics}
          />
          {/* 月次サマリーテーブル（既存実装を流用） */}
        </>
      )}
    </div>
  )
}
```

### 2-2. 「着座数」カラムを AdSummaryTable から削除

`AdSummaryTable.tsx` の COLUMNS 配列から以下を削除してください。

```typescript
// 削除
{ key: 'chakuza', label: '着座数', ... }
```

---

## STEP 3: リードサマリータブ（コホート分析）

### 3-1. データ取得を page.tsx に追加

```typescript
// src/app/(dashboard)/analytics/page.tsx に追加
// callsテーブルから架電日時と結果を取得（コホート計算用）
const { data: rawCalls } = await supabase
  .from('calls')
  .select(`
    id,
    lead_id,
    list_record_id,
    call_date,
    call_result,
    call_number,
    call_duration_minutes,
    agent_name,
    created_at
  `)
  .eq('tenant_id', TENANT_ID)
  .limit(20000)
  .order('call_date', { ascending: true })

const calls = rawCalls ?? []
console.log(`✅ calls: ${calls.length}件`)
```

### 3-2. コホート集計関数を aggregations.ts に追加

```typescript
// src/app/(dashboard)/analytics/_lib/aggregations.ts に追加

export type CohortRow = {
  leadMonth: string      // リード流入月 "2025-06"
  adName: string         // 広告名
  leads: number          // その月のリード数
  // M0〜M3: 流入月からN月後時点での累計状況
  m0: CohortSnapshot    // 流入月内（0〜31日）
  m1: CohortSnapshot    // 1ヶ月後時点
  m2: CohortSnapshot    // 2ヶ月後時点
  m3: CohortSnapshot    // 3ヶ月後時点
}

export type CohortSnapshot = {
  kanryo: number         // 完了済み（架電結果確定）
  appo: number           // アポOK累計
  kanryoRate: number     // 完了率
  appoRate: number       // アポ率
  callCount: number      // 架電回数累計
}

export function buildCohortData(
  leads: Lead[],
  calls: CallRecord[],
  targetAdNames: string[]  // 空配列 = 全広告
): CohortRow[] {
  // lead_id または list_record_id でcallsとleadsを紐づけるマップ
  const callsByLeadId = new Map<string, CallRecord[]>()
  for (const call of calls) {
    const key = call.lead_id ?? call.list_record_id
    if (!key) continue
    if (!callsByLeadId.has(key)) callsByLeadId.set(key, [])
    callsByLeadId.get(key)!.push(call)
  }

  // リードを流入月 × 広告名でグループ化
  const groups = new Map<string, Lead[]>()
  for (const lead of leads) {
    const month = getLeadMonth(lead)
    if (!month) continue
    const adName = lead.ad_name ?? '広告名未設定'
    if (targetAdNames.length > 0 && !targetAdNames.includes(adName)) continue
    const key = `${month}__${adName}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(lead)
  }

  const results: CohortRow[] = []

  for (const [key, groupLeads] of groups.entries()) {
    const [leadMonth, adName] = key.split('__')
    const leadMonthDate = new Date(`${leadMonth}-01`)

    const snapshots: CohortSnapshot[] = [0, 1, 2, 3].map(offsetMonths => {
      // M0: 流入月末まで, M1: +1ヶ月末まで, ...
      const cutoff = new Date(leadMonthDate)
      cutoff.setMonth(cutoff.getMonth() + offsetMonths + 1)
      cutoff.setDate(0) // 月末日
      cutoff.setHours(23, 59, 59)

      let kanryo = 0, appo = 0, totalCalls = 0

      for (const lead of groupLeads) {
        // そのリードへの架電のうち、cutoff以前のものを集計
        const leadCalls = callsByLeadId.get(lead.id) ?? []
        const validCalls = leadCalls.filter(c => {
          const d = c.call_date ? new Date(c.call_date) : null
          return d && d <= cutoff
        })

        totalCalls += validCalls.length

        // cutoff時点でのステータス: 最終架電結果を使用
        const latestCall = validCalls.sort((a, b) =>
          new Date(b.call_date).getTime() - new Date(a.call_date).getTime()
        )[0]

        const resultStatus = latestCall?.call_result ?? lead.status ?? lead.last_call_result ?? ''

        if (KANRYO_STATUSES.includes(resultStatus)) kanryo++
        if (APPO_STATUSES.includes(resultStatus)) appo++
      }

      const n = groupLeads.length
      return {
        kanryo,
        appo,
        kanryoRate: n > 0 ? kanryo / n * 100 : 0,
        appoRate:   n > 0 ? appo   / n * 100 : 0,
        callCount:  totalCalls,
      }
    })

    results.push({
      leadMonth,
      adName,
      leads: groupLeads.length,
      m0: snapshots[0],
      m1: snapshots[1],
      m2: snapshots[2],
      m3: snapshots[3],
    })
  }

  return results.sort((a, b) =>
    a.leadMonth.localeCompare(b.leadMonth) || a.adName.localeCompare(b.adName)
  )
}
```

### 3-3. LeadSummaryTab コンポーネントを新規作成

`src/app/(dashboard)/analytics/_components/LeadSummaryTab.tsx`

```typescript
'use client'
import { useState, useMemo } from 'react'
import type { CohortRow } from '../_lib/aggregations'

interface Props {
  cohortData: CohortRow[]
  allAdNames: string[]
}

export function LeadSummaryTab({ cohortData, allAdNames }: Props) {
  const [selectedAds, setSelectedAds] = useState<string[]>([])  // 空=全選択
  const [viewMetric, setViewMetric] = useState<'appoRate' | 'kanryoRate' | 'callCount'>('appoRate')

  const filtered = selectedAds.length === 0
    ? cohortData
    : cohortData.filter(r => selectedAds.includes(r.adName))

  // 流入月の一覧
  const months = [...new Set(filtered.map(r => r.leadMonth))].sort()

  // 表示指標の設定
  const metricConfig = {
    appoRate:    { label: 'アポ率',   format: (v: number) => `${v.toFixed(1)}%`, color: '#0D9488' },
    kanryoRate:  { label: '完了率',   format: (v: number) => `${v.toFixed(1)}%`, color: '#6366F1' },
    callCount:   { label: '架電回数', format: (v: number) => v.toLocaleString(), color: '#F59E0B' },
  }
  const mc = metricConfig[viewMetric]

  return (
    <div>
      {/* コントロール行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* 指標選択 */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, gap: 2 }}>
          {Object.entries(metricConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setViewMetric(key as typeof viewMetric)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12,
                background: viewMetric === key ? '#fff' : 'transparent',
                color: viewMetric === key ? cfg.color : '#6B7280',
                fontWeight: viewMetric === key ? 600 : 400,
                boxShadow: viewMetric === key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* 広告フィルタ（マルチセレクト） */}
        <select
          multiple
          value={selectedAds}
          onChange={e => setSelectedAds([...e.target.selectedOptions].map(o => o.value))}
          style={{
            fontSize: 11.5, border: '1px solid #E5E7EB', borderRadius: 6,
            padding: '4px 8px', maxHeight: 80, minWidth: 200,
          }}
        >
          {allAdNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button
          onClick={() => setSelectedAds([])}
          style={{ fontSize: 11.5, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          全選択に戻す
        </button>
      </div>

      {/* 説明文 */}
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
        各流入月のリードが M0（流入月）→ M1（1ヶ月後）→ M2（2ヶ月後）→ M3（3ヶ月後）時点でどのように推移したかを表示します。
        データソース: leads（流入・ステータス）× calls（架電履歴）
      </div>

      {/* コホートテーブル */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#F8FAFC', minWidth: 160 }}>広告名</th>
              <th style={{ ...thStyle, position: 'sticky', left: 160, background: '#F8FAFC' }}>流入月</th>
              <th style={thStyle}>リード数</th>
              {/* M0〜M3 */}
              {['M0（流入月）', 'M1（1ヶ月後）', 'M2（2ヶ月後）', 'M3（3ヶ月後）'].map(label => (
                <th key={label} style={{ ...thStyle, background: '#F0FDF4', color: '#15803D' }}>
                  {label}<br />
                  <span style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF' }}>{mc.label}</span>
                </th>
              ))}
              {/* M0→M3 変化量 */}
              <th style={{ ...thStyle, background: '#FFF7ED', color: '#92400E' }}>M0→M3<br />変化</th>
            </tr>
          </thead>
          <tbody>
            {/* 広告別にグループ化して表示 */}
            {allAdNames
              .filter(ad => selectedAds.length === 0 || selectedAds.includes(ad))
              .map(adName => {
                const adRows = filtered.filter(r => r.adName === adName)
                if (adRows.length === 0) return null

                return adRows.map((row, rowIdx) => {
                  const vals = [row.m0, row.m1, row.m2, row.m3].map(s => s[viewMetric])
                  const m0val = vals[0] as number
                  const m3val = vals[3] as number
                  const delta = m3val - m0val

                  return (
                    <tr key={`${adName}-${row.leadMonth}`}
                      style={{ borderBottom: '1px solid #F1F5F9' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {/* 広告名（グループの先頭行のみ表示） */}
                      {rowIdx === 0 && (
                        <td
                          rowSpan={adRows.length}
                          style={{
                            ...tdStyle, position: 'sticky', left: 0, background: '#fff',
                            fontWeight: 600, color: '#111827', borderRight: '2px solid #E5E7EB',
                          }}
                        >
                          {adName}
                        </td>
                      )}
                      <td style={{ ...tdStyle, position: 'sticky', left: 160, background: '#fff', color: '#6B7280' }}>
                        {row.leadMonth}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'DM Mono', textAlign: 'right' }}>
                        {row.leads.toLocaleString()}
                      </td>
                      {/* M0〜M3の値 */}
                      {vals.map((val, i) => (
                        <td key={i} style={{
                          ...tdStyle, fontFamily: 'DM Mono', textAlign: 'right',
                          color: mc.color, fontWeight: 600,
                          background: i === 3 ? 'rgba(13,148,136,.04)' : '',
                        }}>
                          {mc.format(val as number)}
                        </td>
                      ))}
                      {/* 変化量 */}
                      <td style={{
                        ...tdStyle, fontFamily: 'DM Mono', textAlign: 'right',
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
          {/* 合計行 */}
          <tfoot>
            <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
              <td colSpan={2} style={{ ...tdStyle, color: '#374151' }}>合計 / 平均</td>
              <td style={{ ...tdStyle, fontFamily: 'DM Mono', textAlign: 'right' }}>
                {filtered.reduce((s, r) => s + r.leads, 0).toLocaleString()}
              </td>
              {[0, 1, 2, 3].map(mi => {
                const key = ['m0','m1','m2','m3'][mi] as 'm0'|'m1'|'m2'|'m3'
                const vals = filtered.map(r => r[key][viewMetric] as number)
                const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
                return (
                  <td key={mi} style={{ ...tdStyle, fontFamily: 'DM Mono', textAlign: 'right', color: mc.color }}>
                    {mc.format(avg)}
                  </td>
                )
              })}
              <td style={tdStyle} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* データがない場合の注記 */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>
          選択した広告のデータがありません
        </div>
      )}

      {/* callsとleadsの紐づき状況の注記 */}
      <div style={{ marginTop: 12, fontSize: 10.5, color: '#9CA3AF' }}>
        ※ 架電履歴（calls）がリード（leads）に紐づいている場合は架電結果を優先。
        紐づきがない場合は leads.status / last_call_result を使用。
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 11.5, fontWeight: 600,
  color: '#374151', textAlign: 'left', whiteSpace: 'nowrap',
  borderBottom: '2px solid #E5E7EB',
}

const tdStyle: React.CSSProperties = {
  padding: '7px 12px', fontSize: 12, color: '#374151',
  whiteSpace: 'nowrap',
}
```

---

## STEP 4: コール分析タブ

`src/app/(dashboard)/analytics/_components/CallAnalysisTab.tsx` を新規作成してください。

### データ集計ロジック

```typescript
// src/app/(dashboard)/analytics/_lib/callAggregations.ts を新規作成

export type CallMonthlyRow = {
  month: string
  totalCalls: number
  appo: number
  ng: number
  rusu: number
  appoRate: number
  avgDuration: number  // 分
  uniqueLeads: number
}

export type AgentStats = {
  agentName: string
  totalCalls: number
  appo: number
  ng: number
  rusu: number
  appoRate: number
  avgDuration: number
  uniqueLeads: number
}

export function aggregateCallsByMonth(calls: CallRecord[], appoStatuses: string[]): CallMonthlyRow[] {
  const groups = new Map<string, CallRecord[]>()

  for (const call of calls) {
    // call_date が 'YYYY-MM-DD' または timestamp 形式
    const raw = call.call_date ?? call.created_at
    if (!raw) continue
    const month = String(raw).slice(0, 7)  // "YYYY-MM"
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month)!.push(call)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthCalls]) => {
      const appo = monthCalls.filter(c => appoStatuses.includes(c.call_result ?? '')).length
      const ng   = monthCalls.filter(c => ['NG','採用NG'].includes(c.call_result ?? '')).length
      const rusu = monthCalls.filter(c => c.call_result === '留守').length
      const durations = monthCalls.map(c => c.call_duration_minutes ?? 0).filter(d => d > 0)
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0

      return {
        month,
        totalCalls: monthCalls.length,
        appo,
        ng,
        rusu,
        appoRate: monthCalls.length > 0 ? appo / monthCalls.length * 100 : 0,
        avgDuration,
        uniqueLeads: new Set(monthCalls.map(c => c.lead_id ?? c.list_record_id).filter(Boolean)).size,
      }
    })
}

export function aggregateCallsByAgent(calls: CallRecord[], appoStatuses: string[]): AgentStats[] {
  const groups = new Map<string, CallRecord[]>()

  for (const call of calls) {
    const agent = call.agent_name ?? '未設定'
    if (!groups.has(agent)) groups.set(agent, [])
    groups.get(agent)!.push(call)
  }

  return [...groups.entries()]
    .map(([agentName, agentCalls]) => {
      const appo = agentCalls.filter(c => appoStatuses.includes(c.call_result ?? '')).length
      const ng   = agentCalls.filter(c => ['NG','採用NG'].includes(c.call_result ?? '')).length
      const rusu = agentCalls.filter(c => c.call_result === '留守').length
      const durations = agentCalls.map(c => c.call_duration_minutes ?? 0).filter(d => d > 0)
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0
      return {
        agentName,
        totalCalls: agentCalls.length,
        appo, ng, rusu,
        appoRate: agentCalls.length > 0 ? appo / agentCalls.length * 100 : 0,
        avgDuration,
        uniqueLeads: new Set(agentCalls.map(c => c.lead_id ?? c.list_record_id).filter(Boolean)).size,
      }
    })
    .sort((a, b) => b.appoRate - a.appoRate)
}

export function aggregateCallsByHour(calls: CallRecord[]): Record<number, { total: number; connected: number }> {
  // call_start_time が 'HH:MM:SS' または call_date がtimestamp形式の場合に対応
  const result: Record<number, { total: number; connected: number }> = {}

  for (let h = 8; h <= 20; h++) result[h] = { total: 0, connected: 0 }

  for (const call of calls) {
    // 時刻取得: call_start_time または call_date のtime部分
    const timeStr = call.call_start_time
      ?? (call.call_date?.includes('T') ? call.call_date.split('T')[1] : null)
    if (!timeStr) continue

    const hour = parseInt(timeStr.slice(0, 2))
    if (hour < 8 || hour > 20) continue

    result[hour].total++
    if (!['留守', 'NG', '採用NG', '未コール', '新規'].includes(call.call_result ?? '')) {
      result[hour].connected++
    }
  }

  return result
}
```

### UI コンポーネント

```typescript
// CallAnalysisTab.tsx
export function CallAnalysisTab({ calls, dateRange }: { calls: CallRecord[]; dateRange: DateRange }) {
  const [subView, setSubView] = useState<'monthly' | 'agent' | 'hourly'>('monthly')

  // 期間フィルタ適用
  const filteredCalls = useMemo(() => {
    let c = calls
    if (dateRange.from) c = c.filter(x => x.call_date && new Date(x.call_date) >= dateRange.from!)
    if (dateRange.to)   c = c.filter(x => x.call_date && new Date(x.call_date) <= dateRange.to!)
    return c
  }, [calls, dateRange])

  const monthlyData = useMemo(() => aggregateCallsByMonth(filteredCalls, APPO_STATUSES), [filteredCalls])
  const agentData   = useMemo(() => aggregateCallsByAgent(filteredCalls, APPO_STATUSES), [filteredCalls])
  const hourlyData  = useMemo(() => aggregateCallsByHour(filteredCalls), [filteredCalls])

  return (
    <div>
      {/* サブビュー切替 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'monthly', label: '月次コール推移' },
          { key: 'agent',   label: '担当者別成績' },
          { key: 'hourly',  label: '時間帯別分析' },
        ].map(v => (
          <button key={v.key} onClick={() => setSubView(v.key as typeof subView)}
            style={{
              padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: subView === v.key ? 600 : 400,
              background: subView === v.key ? '#0D9488' : '#F1F5F9',
              color: subView === v.key ? '#fff' : '#6B7280',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* 月次コール推移 */}
      {subView === 'monthly' && (
        <>
          {/* recharts ComposedChart: X=月, 棒=架電数, 折れ線=アポ率 */}
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="totalCalls" name="架電数" fill="#94A3B8" fillOpacity={0.7} radius={[2,2,0,0]} />
              <Bar yAxisId="left" dataKey="appo" name="アポ数" fill="#0D9488" radius={[2,2,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="appoRate" name="アポ率" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* 月次テーブル */}
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, marginTop: 16 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['月', '架電数', 'アポ', 'NG', '留守', 'アポ率', '平均通話(分)', 'ユニークリード'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB', textAlign: h === '月' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map(row => (
                <tr key={row.month} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '7px 12px', fontFamily: 'DM Mono' }}>{row.month}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>{row.totalCalls.toLocaleString()}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#0D9488', fontWeight: 600 }}>{row.appo}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#EF4444' }}>{row.ng}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#6B7280' }}>{row.rusu}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#F59E0B', fontWeight: 600 }}>{row.appoRate.toFixed(1)}%</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>{row.avgDuration.toFixed(1)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>{row.uniqueLeads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* 担当者別成績テーブル */}
      {subView === 'agent' && (
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>担当者</th>
              {['架電数', 'アポ数', 'NG数', '留守数', 'アポ率', '平均通話(分)', 'ユニークリード'].map(h => (
                <th key={h} style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', textAlign: 'right', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentData.map((row, i) => (
              <tr key={row.agentName} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '7px 12px', fontWeight: 600 }}>{row.agentName}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>{row.totalCalls.toLocaleString()}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#0D9488', fontWeight: 600 }}>{row.appo}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#EF4444' }}>{row.ng}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#6B7280' }}>{row.rusu}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono', color: '#F59E0B', fontWeight: 700 }}>{row.appoRate.toFixed(1)}%</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>{row.avgDuration.toFixed(1)}</td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>{row.uniqueLeads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 時間帯別接続率バーチャート */}
      {subView === 'hourly' && (
        <>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12 }}>
            接続率 = 留守・NG・未コール以外の架電 ÷ 総架電数
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Object.entries(hourlyData).map(([h, d]) => ({
              hour: `${h}時`,
              rate: d.total > 0 ? d.connected / d.total * 100 : 0,
              total: d.total,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '接続率']} />
              <Bar dataKey="rate" name="接続率" fill="#0D9488" radius={[3,3,0,0]}>
                {Object.entries(hourlyData).map(([h, d]) => {
                  const rate = d.total > 0 ? d.connected / d.total * 100 : 0
                  const color = rate >= 40 ? '#0D9488' : rate >= 25 ? '#F59E0B' : '#94A3B8'
                  return <Cell key={h} fill={color} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {filteredCalls.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>
          選択期間のコールデータがありません（callsテーブルとleadsの紐づきが必要です）
        </div>
      )}
    </div>
  )
}
```

---

## STEP 5: ファクター分析タブ（旧ファネル分析 → 改名・改修）

`src/app/(dashboard)/analytics/_components/FactorAnalysisTab.tsx` を新規作成。`FunnelMetrics.tsx` は削除してください。

```typescript
// FactorAnalysisTab: 広告ごとのボトルネックを特定する

export function FactorAnalysisTab({ adStats }: { adStats: AdSummaryRow[] }) {
  const [sortKey, setSortKey] = useState<'leads' | 'appoRate' | 'kanryoRate' | 'juchuRateList'>('leads')

  const sorted = [...adStats].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return (bv as number) - (av as number)
  })

  // ボトルネック判定
  // 全広告の平均アポ率・着座率・受注率を基準に「平均以下」をボトルネックとして強調
  const avgAppoRate    = adStats.reduce((s, a) => s + (a.appoRate ?? 0), 0) / (adStats.length || 1)
  const avgChakuzaRate = adStats.reduce((s, a) => s + (a.chakuzaRateAppo ?? 0), 0) / (adStats.length || 1)
  const avgJuchuRate   = adStats.reduce((s, a) => s + (a.juchuRateShodan ?? 0), 0) / (adStats.length || 1)

  const getBottleneck = (row: AdSummaryRow): string => {
    const stages: string[] = []
    if ((row.appoRate ?? 0) < avgAppoRate * 0.8)        stages.push('リード→アポ')
    if ((row.chakuzaRateAppo ?? 0) < avgChakuzaRate * 0.8) stages.push('アポ→着座')
    if ((row.juchuRateShodan ?? 0) < avgJuchuRate * 0.8)   stages.push('着座→受注')
    return stages.length > 0 ? `⚠️ ${stages.join(' / ')}` : '✅ 平均以上'
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
        各広告のコンバージョン率を段階ごとに分解し、どのフェーズがボトルネックになっているかを特定します。
        平均値の80%未満の段階を⚠️で強調表示します。
      </div>

      {/* ファネルウォーターフォール（全広告合計） */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        {[
          { label: 'リード', value: adStats.reduce((s, a) => s + a.leads, 0), color: '#0D9488' },
          { label: 'アポOK', value: adStats.reduce((s, a) => s + a.appo, 0), color: '#10B981' },
          { label: '着座', value: adStats.reduce((s, a) => s + a.saiyoOk + a.juchu, 0), color: '#6366F1' },
          { label: '受注', value: adStats.reduce((s, a) => s + a.juchu, 0), color: '#F59E0B' },
        ].map((stage, i, arr) => {
          const pct = i === 0 ? 100 : arr[0].value > 0 ? stage.value / arr[0].value * 100 : 0
          return (
            <div key={stage.label} style={{
              flex: 1, padding: '16px 12px', textAlign: 'center',
              borderRight: i < arr.length - 1 ? '1px solid #F1F5F9' : 'none',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'DM Mono', color: stage.color }}>
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

      {/* アポOK内訳 円グラフ */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>アポOK内訳</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={[
                  { name: '調整中',  value: adStats.reduce((s, a) => s + a.chosei, 0),   fill: '#93C5FD' },
                  { name: '採用OK',  value: adStats.reduce((s, a) => s + a.saiyoOk, 0),  fill: '#6366F1' },
                  { name: '採用NG',  value: adStats.reduce((s, a) => s + a.saiyoNg, 0),  fill: '#FCA5A5' },
                  { name: '受注',    value: adStats.reduce((s, a) => s + a.juchu, 0),     fill: '#0D9488' },
                ].filter(d => d.value > 0)}
                dataKey="value" cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 完了内訳 */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px', flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>未完了内訳</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={[
                  { name: '未コール', value: adStats.reduce((s, a) => s + a.miCall, 0),   fill: '#E5E7EB' },
                  { name: '留守',     value: adStats.reduce((s, a) => s + a.rusu, 0),      fill: '#94A3B8' },
                  { name: '見込みA',  value: adStats.reduce((s, a) => s + a.mikomiA, 0),  fill: '#FCD34D' },
                  { name: '見込みB',  value: adStats.reduce((s, a) => s + a.mikomiB, 0),  fill: '#F59E0B' },
                  { name: '見込みC',  value: adStats.reduce((s, a) => s + a.mikomiC, 0),  fill: '#D97706' },
                ].filter(d => d.value > 0)}
                dataKey="value" cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 広告別ボトルネック分析テーブル */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>広告別ボトルネック分析</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
        平均アポ率: {avgAppoRate.toFixed(1)}% / 平均着座率: {avgChakuzaRate.toFixed(1)}% / 平均受注率: {avgJuchuRate.toFixed(1)}%
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, overflowX: 'auto' }}>
        <thead>
          <tr style={{ background: '#F8FAFC' }}>
            {[
              { key: 'leads',          label: 'リード数' },
              { key: 'appoRate',       label: 'アポ率' },
              { key: 'kanryoRate',     label: '完了率' },
              { key: 'chakuzaRateAppo',label: '着座率\n(対アポ)' },
              { key: 'juchuRateShodan',label: '受注率\n(対着座)' },
            ].map(col => (
              <th
                key={col.key}
                onClick={() => setSortKey(col.key as typeof sortKey)}
                style={{
                  padding: '8px 12px', fontWeight: 600, color: '#374151',
                  textAlign: 'right', borderBottom: '1px solid #E5E7EB',
                  cursor: 'pointer', whiteSpace: 'pre',
                  color: sortKey === col.key ? '#0D9488' : '#374151',
                }}
              >
                {col.label} {sortKey === col.key ? '▼' : ''}
              </th>
            ))}
            <th style={{ padding: '8px 12px', fontWeight: 600, color: '#374151', borderBottom: '1px solid #E5E7EB' }}>ボトルネック</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.adName} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '7px 12px', fontWeight: 600, position: 'sticky', left: 0, background: 'inherit' }}>{row.adName}</td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>{row.leads.toLocaleString()}</td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono',
                color: (row.appoRate ?? 0) < avgAppoRate * 0.8 ? '#EF4444' : '#0D9488', fontWeight: 600 }}>
                {row.appoRate?.toFixed(1) ?? '-'}%
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono' }}>
                {row.kanryoRate?.toFixed(1) ?? '-'}%
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono',
                color: (row.chakuzaRateAppo ?? 0) < avgChakuzaRate * 0.8 ? '#EF4444' : '#0D9488', fontWeight: 600 }}>
                {row.chakuzaRateAppo?.toFixed(1) ?? '-'}%
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'DM Mono',
                color: (row.juchuRateShodan ?? 0) < avgJuchuRate * 0.8 ? '#EF4444' : '#0D9488', fontWeight: 600 }}>
                {row.juchuRateShodan?.toFixed(1) ?? '-'}%
              </td>
              <td style={{ padding: '7px 12px', fontSize: 11 }}>{getBottleneck(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## STEP 6: AnalyticsClient.tsx の統合

全タブを統合してください。

```typescript
// AnalyticsClient.tsx の主要部分

const TABS = [
  { key: 'ad_summary',    label: '広告サマリー',   icon: '📊' },
  { key: 'lead_summary',  label: 'リードサマリー', icon: '📈' },
  { key: 'call_analysis', label: 'コール分析',     icon: '📞' },
  { key: 'funnel',        label: 'ファクター分析', icon: '🔍' },
]

// page.tsx からの props
interface Props {
  rawLeads: Lead[]
  rawDeals: Deal[]
  rawCalls: CallRecord[]  // ← 追加
  initialAdStats: AdSummaryRow[]
  initialMonthlyData: MonthlyRow[]
}

export function AnalyticsClient({ rawLeads, rawDeals, rawCalls, initialAdStats, initialMonthlyData }: Props) {
  const [activeTab, setActiveTab] = useState<string>('ad_summary')
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
  const [selectedAds, setSelectedAds] = useState<string[]>([])
  const [excludeNoAd, setExcludeNoAd] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(DEFAULT_METRICS)

  const allAdNames = useMemo(() =>
    [...new Set(rawLeads.map(l => l.ad_name).filter(Boolean))] as string[],
    [rawLeads]
  )

  // フィルタ適用済みleads
  const filteredLeads = useMemo(() => {
    let leads = rawLeads
    if (dateRange.from) leads = leads.filter(l => l.inquiry_at && new Date(l.inquiry_at) >= dateRange.from!)
    if (dateRange.to)   leads = leads.filter(l => l.inquiry_at && new Date(l.inquiry_at) <= dateRange.to!)
    if (selectedAds.length > 0) leads = leads.filter(l => selectedAds.includes(l.ad_name ?? ''))
    if (excludeNoAd) leads = leads.filter(l => l.ad_name && l.ad_name.trim() !== '')
    return leads
  }, [rawLeads, dateRange, selectedAds, excludeNoAd])

  const isDefault = !dateRange.from && !dateRange.to && selectedAds.length === 0 && !excludeNoAd

  const adStats = useMemo(() =>
    isDefault ? initialAdStats : aggregateByAd(filteredLeads, rawDeals),
    [filteredLeads, rawDeals, isDefault, initialAdStats]
  )

  const monthlyData = useMemo(() =>
    isDefault ? initialMonthlyData : aggregateByMonth(filteredLeads),
    [filteredLeads, isDefault, initialMonthlyData]
  )

  // コホートデータ（リードサマリー用）
  const cohortData = useMemo(() =>
    buildCohortData(filteredLeads, rawCalls, selectedAds),
    [filteredLeads, rawCalls, selectedAds]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F5F7FA' }}>
      {/* ヘッダー */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ padding: '14px 24px 10px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.3px' }}>アナリティクス</h1>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>広告 → リード → コール → 受注 パフォーマンス分析</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#6B7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={excludeNoAd} onChange={e => setExcludeNoAd(e.target.checked)}
                style={{ accentColor: '#0D9488', width: 13, height: 13 }} />
              広告名未設定を除外
            </label>
            <button onClick={() => exportCsv(adStats)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
              ↓ CSV
            </button>
          </div>
        </div>

        {/* KPIカード */}
        <KpiCardRow stats={adStats} totalLeads={filteredLeads.length} />

        {/* メインタブ */}
        <div style={{ display: 'flex', padding: '0 24px', borderTop: '1px solid #E5E7EB' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 18px', fontSize: 12.5, fontWeight: 500, border: 'none',
                background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                color: activeTab === t.key ? '#0D9488' : '#9CA3AF',
                borderBottom: activeTab === t.key ? '2px solid #0D9488' : '2px solid transparent',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 広告クリエイティブ選択（全タブ共通） */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '10px 24px', flexShrink: 0 }}>
        <AdSelector ads={adStats} selected={selectedAds} onChange={setSelectedAds} />
      </div>

      {/* コンテンツ */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {activeTab === 'ad_summary'    && <AdSummaryTab adStats={adStats} monthlyData={monthlyData} selectedMetrics={selectedMetrics} onMetricsChange={setSelectedMetrics} selectedAds={selectedAds} />}
        {activeTab === 'lead_summary'  && <LeadSummaryTab cohortData={cohortData} allAdNames={allAdNames} />}
        {activeTab === 'call_analysis' && <CallAnalysisTab calls={rawCalls} dateRange={dateRange} />}
        {activeTab === 'funnel'        && <FactorAnalysisTab adStats={adStats} />}
      </div>
    </div>
  )
}
```

---

## STEP 7: page.tsx に rawCalls を追加してプロップスに渡す

```typescript
// page.tsx の既存クエリに追加
const { data: rawCallsData } = await supabase
  .from('calls')
  .select('id, lead_id, list_record_id, call_date, call_result, call_number, call_duration_minutes, agent_name, created_at')
  .eq('tenant_id', TENANT_ID)
  .limit(20000)
  .order('call_date', { ascending: true })

const rawCalls = rawCallsData ?? []
console.log(`✅ calls: ${rawCalls.length}件`)

// AnalyticsClient に渡す
return (
  <AnalyticsClient
    rawLeads={leads}
    rawDeals={deals}
    rawCalls={rawCalls}   // ← 追加
    initialAdStats={adStats}
    initialMonthlyData={monthlyData}
  />
)
```

---

## STEP 8: 型定義の追加

`src/app/(dashboard)/analytics/_lib/types.ts` に `CallRecord` 型を追加してください。

```typescript
export type CallRecord = {
  id: string
  lead_id: string | null
  list_record_id: string | null
  call_date: string | null        // 'YYYY-MM-DD' または ISO8601
  call_start_time?: string | null // 'HH:MM:SS'（カラムが存在する場合）
  call_result: string | null
  call_number: number | null
  call_duration_minutes: number | null
  agent_name: string | null
  created_at: string
}
```

---

## STEP 9: ビルド・確認

```bash
npm run build
```

エラーが出た場合は止まって報告してください。

---

## 最終報告フォーマット

```
【STEP 0 調査結果】
- callsカラム: call_date型=○○, call_result有無=○, agent_name有無=○
- calls総件数: X件 (lead_id紐づき: X件, list_record_id紐づき: X件)
- callsのcall_result値: [リストアップ]
- leadsのstatus値: [リストアップ]
- コホート分析: leads × calls結合可能か → YES/NO

【実装完了ファイル】
新規: X個 / 修正: X個

【各タブのデータ状況】
- 広告サマリー: X広告表示
- リードサマリー: Xヶ月 × X広告のコホートデータ
- コール分析: X件のコールデータ / X担当者
- ファクター分析: ボトルネック特定済み

【残課題】
```
