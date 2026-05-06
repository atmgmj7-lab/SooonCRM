export type LeadRow = {
  id: string
  list_record_id?: string | null   // calls との紐づけキー
  ad_name: string | null
  status: string
  last_call_result: string | null
  inquiry_at: string
  appo_detail_status?: string | null
  appo_date?: string | null
  appo_time?: string | null
  appo_detail?: string | null
  list_created_at?: string | null  // FM同期リードの問い合わせ日補完用
  jitsuyo_ok: boolean | null
  ichiyou_ng: boolean | null
  order_closed: boolean | null
  deal_amount: number | null
  adjusting: boolean | null
  source_data?: Record<string, unknown> | null
  initial_fee?: number | null
  monthly_fee?: number | null
}

export type CallRecord = {
  id: string
  lead_id: string | null           // 将来対応（現在は null）
  list_record_id: string | null    // calls.list_record_id = leads.list_record_id
  call_date: string | null         // 'YYYY-MM-DD'
  call_start_time?: string | null  // 'HH:MM:SS'
  call_result: string | null
  call_number: number | null
  call_duration_minutes: number | null
  agent_name: string | null
  newcomer_flag?: string | null
  created_at: string
}

// page.tsx との後方互換エイリアス
export type Lead = LeadRow

export type CallRow = {
  id: string
  lead_id: string | null
  called_at: string | null
  call_result: string | null
  call_number: number
}

export type Deal = {
  id: string
  lead_id: string
  deal_amount: number | null
  closed_at: string | null
}

export type AdSummaryRow = {
  adName: string
  creativeImageUrl: string | null
  // ── リスト集計 ──
  leads: number
  appo: number          // アポOK（調整中・採用OK・採用NG・受注 全て含む）
  chosei: number        // 調整中（アポOK内訳）
  saiyoOk: number       // 採用OK（アポOK内訳）
  saiyoNg: number       // 採用NG（アポOK内訳）
  juchu: number         // 受注（アポOK内訳）
  chakuza: number       // 着座数 = saiyoOk + juchu
  ng: number            // NG
  taishogai: number     // 対象外（ポータル・重複等を含む集計用）
  duplicateCount: number // 重複（独自ステータス）
  kanryo: number        // 完了（アポOK+NG+対象外+現アナ+ポータル）
  mikanryo: number      // 未完了（新規+留守+見込みA/B/C）
  miCall: number
  rusu: number
  mikomiA: number
  mikomiB: number
  mikomiC: number
  // ── 後方互換（FunnelMetrics 等で使用）──
  mikomi: number        // mikomiA + mikomiB + mikomiC
  deals: number         // = juchu
  // ── 率指標（ゼロ除算は null）──
  appoRate: number | null
  appoRateKanryo: number | null
  chakuzaRateList: number | null
  chakuzaRateAppo: number | null
  chakuzaRateKanryo: number | null
  juchuRateList: number | null
  juchuRateShodan: number | null
  kanryoRate: number | null
  // ── 広告指標 ──
  clicks: number | null
  reach: number | null
  impressions: number | null
  adSpend: number | null
  cpa: number | null
  ctr: number | null
  cpc: number | null
  cpm: number | null
  cpaPerAppo: number | null
  cpaPerChakuza: number | null  // 1採用単価（着座数で割る）
  cpo: number | null
  totalRevenue: number
  cashflowRevenue: number
  roasTotal: number | null      // 総受注額ROAS
  roasCashflow: number | null   // 当月入金額ROAS（initial_fee+monthly_fee）
}

export type MonthlyRow = {
  month: string
  leads: number
  appo: number
  chosei: number
  saiyoOk: number
  saiyoNg: number
  juchu: number
  chakuza: number
  ng: number
  taishogai: number
  kanryo: number
  miCall: number
  rusu: number
  mikomiA: number
  mikomiB: number
  mikomiC: number
  mikanryo: number
  appoRate: number | null
  appoRateKanryo: number | null
  chakuzaRateList: number | null
  chakuzaRateAppo: number | null
  chakuzaRateKanryo: number | null
  juchuRateShodan: number | null
  juchuRateList: number | null
  kanryoRate: number | null
}

export type CallEfficiencyRow = {
  callCount: number
  total: number
  appo: number
  appoRate: number
}

export type ResponseTimeBucket = {
  label: string
  count: number
}

export type HourlyConnectRow = {
  hour: number
  total: number
  connected: number
  connectRate: number
}

export type KpiData = {
  totalLeads: number
  totalAppo: number
  appoRate: number
  kanryoRate: number
  totalRevenue: number
  roas: number | null
}

export type CallEfficiencyData = {
  responseTimes: ResponseTimeBucket[]
  callCountAppo: CallEfficiencyRow[]
  hourlyConnect: HourlyConnectRow[]
  hasNewData: boolean
}

// GA4形式グラフ用: { month: '2025-01', [adName::metricKey]: number }
export type MonthAdRow = Record<string, number | string>
