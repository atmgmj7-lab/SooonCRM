/**
 * NOTE: calls と leads の紐づけは新規Webhook流入（source='meta_ads'）から開始。
 * 過去データ（source='other'）は last_call_result に結果が入るが lead_id 未紐づけのため、
 * 架電効率パネルは新規データのみを対象とする。
 *
 * ステータス判定: status を優先し、未設定/空の場合は last_call_result にフォールバック
 */

import type { AdSummaryRow, MonthlyRow, MonthAdRow, CallEfficiencyRow, LeadRow, CallRow, CallRecord, KpiData, CallEfficiencyData } from './types'

// ── DBに実際に存在するステータス値（2026-05-09確認済み） ──

// 完了 = 架電結果が確定したもの
export const KANRYO_STATUSES = [
  'アポOK',
  'NG',
  '対象外',
  'ポータルサイト',
  '現アナ',
  '重複',
  '改め',
  '未対応',
]

// 未完了 = まだ結果が出ていないもの
export const MIKANRYO_STATUSES = [
  '新規',
  '留守',
  '見込みA',
  '見込みB',
  '見込みC',
]

// アポOK（内訳は appo_detail_status）
export const APPO_STATUSES = ['アポOK']

// アポOK内訳（appo_detail_status カラムから集計）
export const APPO_CHOSEI   = ['調整中']
export const APPO_SAIYO_OK = ['採用OK']
export const APPO_SAIYO_NG = ['採用NG']
export const APPO_JUCHU    = ['受注']

// NG系
export const NG_STATUSES = ['NG']

// 対象外系
export const TAISHOGAI_STATUSES = ['対象外', 'ポータルサイト', '現アナ', '重複']

export const DUPLICATE_STATUSES = ['重複']

// ─────────────────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────────────────

const getStatus = (lead: LeadRow): string =>
  lead.status || lead.last_call_result || ''

const countStatus = (leads: LeadRow[], statuses: string[]): number =>
  leads.filter((l) => statuses.includes(getStatus(l))).length

/** appo_detail_status による内訳カウント */
function countAppoDetail(leads: LeadRow[], codes: string[]): number {
  return leads.filter((l) => codes.includes((l.appo_detail_status ?? '').trim())).length
}


function safeRate(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0
}

function pct(n: number, d: number): number | null {
  return d > 0 ? (n / d) * 100 : null
}

function getAdSpend(lead: LeadRow): number {
  if (!lead.source_data) return 0
  const sd = lead.source_data as Record<string, unknown>
  return Number(sd.spend ?? sd.cost ?? 0) || 0
}

function getAdClicks(lead: LeadRow): number {
  if (!lead.source_data) return 0
  const sd = lead.source_data as Record<string, unknown>
  return Number(sd.clicks ?? 0) || 0
}

function getAdReach(lead: LeadRow): number {
  if (!lead.source_data) return 0
  const sd = lead.source_data as Record<string, unknown>
  return Number(sd.reach ?? 0) || 0
}

function getAdImpressions(lead: LeadRow): number {
  if (!lead.source_data) return 0
  const sd = lead.source_data as Record<string, unknown>
  return Number(sd.impressions ?? 0) || 0
}

function getCreativeImageUrl(lead: LeadRow): string | null {
  if (!lead.source_data) return null
  const sd = lead.source_data as Record<string, unknown>
  return (sd.creative_image_url ?? sd.image_url ?? null) as string | null
}

function parseNumericStr(v: unknown): number {
  if (v == null) return 0
  return Number(String(v).replace(/[^0-9.]/g, '')) || 0
}

/**
 * リードの問い合わせ月を返す。
 * 優先: inquiry_at > list_created_at > null
 * created_at は絶対に使わない（インポート日時のため2026-04に集中する）
 */
export function getLeadMonth(lead: LeadRow): string | null {
  const raw = lead.inquiry_at || lead.list_created_at || null
  if (!raw) return null
  const date = new Date(raw)
  if (isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const now = new Date()
  // 異常値除外: 2020年未満 or 翌月以降の未来日付
  if (year < 2020 || date > new Date(now.getFullYear(), now.getMonth() + 1, 1)) return null
  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getCashflowRevenue(lead: LeadRow): number {
  // 直接カラムを優先
  const direct = (lead.initial_fee ?? 0) + (lead.monthly_fee ?? 0)
  if (direct > 0) return direct
  // source_data にフォールバック（"145,000" 形式のカンマ区切り数字に対応）
  if (!lead.source_data) return 0
  const sd = lead.source_data as Record<string, unknown>
  return parseNumericStr(sd.initial_fee) + parseNumericStr(sd.monthly_fee)
}

export function filterByDateRange(leads: LeadRow[], range: { from: Date | null; to: Date | null } | null): LeadRow[] {
  if (!range || (!range.from && !range.to)) return leads
  return leads.filter((l) => {
    const raw = l.inquiry_at || (l as LeadRow & { list_created_at?: string }).list_created_at
    if (!raw) return true  // 日付不明は除外しない
    const at = new Date(raw)
    if (isNaN(at.getTime())) return true
    if (range.from && at < range.from) return false
    if (range.to && at > range.to) return false
    return true
  })
}

export function aggregateByAd(leads: LeadRow[]): AdSummaryRow[] {
  const map = new Map<string, LeadRow[]>()

  for (const lead of leads) {
    const key = lead.ad_name ?? '広告名未設定'
    const group = map.get(key) ?? []
    group.push(lead)
    map.set(key, group)
  }

  const rows: AdSummaryRow[] = []

  for (const [adName, group] of map.entries()) {
    const totalLeads = group.length

    const appo      = countStatus(group, APPO_STATUSES)
    const kanryo    = countStatus(group, KANRYO_STATUSES)
    const mikanryo  = countStatus(group, MIKANRYO_STATUSES)
    const ng        = countStatus(group, NG_STATUSES)
    const taishogai = countStatus(group, TAISHOGAI_STATUSES)
    const duplicateCount = countStatus(group, DUPLICATE_STATUSES)
    const chosei    = countAppoDetail(group, APPO_CHOSEI)
    const saiyoOk   = countAppoDetail(group, APPO_SAIYO_OK)
    const saiyoNg   = countAppoDetail(group, APPO_SAIYO_NG)
    const juchuAd   = countAppoDetail(group, APPO_JUCHU)
    const chakuza   = saiyoOk + juchuAd
    const rusu      = countStatus(group, ['留守'])
    const miCall    = countStatus(group, ['新規'])
    const mikomiA   = countStatus(group, ['見込みA'])
    const mikomiB   = countStatus(group, ['見込みB'])
    const mikomiC   = countStatus(group, ['見込みC'])
    const mikomi    = mikomiA + mikomiB + mikomiC

    const totalRevenue    = group.reduce((s, l) => s + (l.deal_amount ?? 0), 0)
    const cashflowRevenue = group.reduce((s, l) => s + getCashflowRevenue(l), 0)

    const adSpend     = group.reduce((s, l) => s + getAdSpend(l), 0)
    const clicks      = group.reduce((s, l) => s + getAdClicks(l), 0)
    const reach       = group.reduce((s, l) => s + getAdReach(l), 0)
    const impressions = group.reduce((s, l) => s + getAdImpressions(l), 0)

    const hasAdSpend = adSpend > 0
    const hasClicks  = clicks > 0
    const hasImpr    = impressions > 0

    const creativeImageUrl = group.map(getCreativeImageUrl).find(Boolean) ?? null

    rows.push({
      adName,
      creativeImageUrl,
      leads: totalLeads,
      appo,
      chosei,
      saiyoOk,
      saiyoNg,
      juchu: juchuAd,
      chakuza,
      ng,
      taishogai,
      duplicateCount,
      kanryo,
      mikanryo,
      miCall,
      rusu,
      mikomiA,
      mikomiB,
      mikomiC,
      // 後方互換
      mikomi,
      deals: juchuAd,
      // 率指標（ゼロ除算は null）
      appoRate:          pct(appo, totalLeads),
      appoRateKanryo:    pct(appo, kanryo),
      chakuzaRateList:   pct(chakuza, totalLeads),
      chakuzaRateAppo:   pct(chakuza, appo),
      chakuzaRateKanryo: pct(chakuza, kanryo),
      juchuRateShodan:   pct(juchuAd, chakuza),
      juchuRateList:     pct(juchuAd, totalLeads),
      kanryoRate:        pct(kanryo, totalLeads),
      // 広告指標
      clicks:       hasClicks ? clicks      : null,
      reach:        reach > 0 ? reach       : null,
      impressions:  hasImpr   ? impressions : null,
      adSpend:      hasAdSpend ? adSpend    : null,
      cpa:          hasAdSpend && totalLeads > 0 ? adSpend / totalLeads : null,
      ctr:          hasImpr && hasClicks ? (clicks / impressions) * 100 : null,
      cpc:          hasAdSpend && hasClicks ? adSpend / clicks : null,
      cpm:          hasAdSpend && hasImpr ? (adSpend / impressions) * 1000 : null,
      cpaPerAppo:   hasAdSpend && appo > 0 ? adSpend / appo : null,
      cpaPerChakuza: hasAdSpend && chakuza > 0 ? adSpend / chakuza : null,
      cpo:          hasAdSpend && juchuAd > 0 ? adSpend / juchuAd : null,
      totalRevenue,
      cashflowRevenue,
      roasTotal:    hasAdSpend && totalRevenue > 0 ? (totalRevenue / adSpend) * 100 : null,
      roasCashflow: hasAdSpend && cashflowRevenue > 0 ? (cashflowRevenue / adSpend) * 100 : null,
    })
  }

  return rows.sort((a, b) => (b.appoRate ?? 0) - (a.appoRate ?? 0))
}

export function aggregateByMonth(leads: LeadRow[]): MonthlyRow[] {
  const map = new Map<string, LeadRow[]>()

  for (const lead of leads) {
    const month = getLeadMonth(lead)
    if (!month) continue
    const group = map.get(month) ?? []
    group.push(lead)
    map.set(month, group)
  }

  const rows: MonthlyRow[] = []

  for (const [month, group] of map.entries()) {
    const leads    = group.length
    const appo     = countStatus(group, APPO_STATUSES)
    const kanryo   = countStatus(group, KANRYO_STATUSES)
    const chosei   = countAppoDetail(group, APPO_CHOSEI)
    const saiyoOk  = countAppoDetail(group, APPO_SAIYO_OK)
    const saiyoNg  = countAppoDetail(group, APPO_SAIYO_NG)
    const juchuM   = countAppoDetail(group, APPO_JUCHU)
    const chakuza  = saiyoOk + juchuM
    const ng       = countStatus(group, NG_STATUSES)
    const taishogai = countStatus(group, TAISHOGAI_STATUSES)
    const miCall   = countStatus(group, ['新規'])
    const rusu     = countStatus(group, ['留守'])
    const mikomiA  = countStatus(group, ['見込みA'])
    const mikomiB  = countStatus(group, ['見込みB'])
    const mikomiC  = countStatus(group, ['見込みC'])
    const mikanryo = countStatus(group, MIKANRYO_STATUSES)

    rows.push({
      month,
      leads,
      appo,
      chosei,
      saiyoOk,
      saiyoNg,
      juchu: juchuM,
      chakuza,
      ng,
      taishogai,
      kanryo,
      miCall,
      rusu,
      mikomiA,
      mikomiB,
      mikomiC,
      mikanryo,
      appoRate:          pct(appo, leads),
      appoRateKanryo:    pct(appo, kanryo),
      chakuzaRateList:   pct(chakuza, leads),
      chakuzaRateAppo:   pct(chakuza, appo),
      chakuzaRateKanryo: pct(chakuza, kanryo),
      juchuRateShodan:   pct(juchuM, chakuza),
      juchuRateList:     pct(juchuM, leads),
      kanryoRate:        pct(kanryo, leads),
    })
  }

  return rows.sort((a, b) => a.month.localeCompare(b.month))
}

export function aggregateByAdByMonth(leads: LeadRow[], adNames: string[]): MonthAdRow[] {
  const effectiveAds = adNames.length > 0
    ? adNames
    : Array.from(new Set(leads.map((l) => l.ad_name ?? '広告名未設定')))

  const monthAdMap = new Map<string, Map<string, LeadRow[]>>()

  for (const lead of leads) {
    const adName = lead.ad_name ?? '広告名未設定'
    if (!effectiveAds.includes(adName)) continue
    const month = getLeadMonth(lead)
    if (!month) continue
    if (!monthAdMap.has(month)) monthAdMap.set(month, new Map())
    const adMap = monthAdMap.get(month)!
    if (!adMap.has(adName)) adMap.set(adName, [])
    adMap.get(adName)!.push(lead)
  }

  const months = Array.from(monthAdMap.keys()).sort()

  return months.map((month) => {
    const row: MonthAdRow = { month }
    const adMap = monthAdMap.get(month) ?? new Map<string, LeadRow[]>()

    for (const adName of effectiveAds) {
      const group   = adMap.get(adName) ?? []
      const n       = group.length
      const appo    = countStatus(group, APPO_STATUSES)
      const kanryo  = countStatus(group, KANRYO_STATUSES)
      const saiyoOkM = countAppoDetail(group, APPO_SAIYO_OK)
      const juchuM2  = countAppoDetail(group, APPO_JUCHU)
      const chakuza  = saiyoOkM + juchuM2
      const juchu    = juchuM2
      const totalRevenue = group.reduce((s, l) => s + (l.deal_amount ?? 0), 0)
      const adSpend = group.reduce((s, l) => s + getAdSpend(l), 0)

      const p = adName
      row[`${p}::leads`]           = n
      row[`${p}::appo`]            = appo
      row[`${p}::kanryo`]          = kanryo
      row[`${p}::chakuza`]         = chakuza
      row[`${p}::juchu`]           = juchu
      row[`${p}::totalRevenue`]    = totalRevenue
      row[`${p}::adSpend`]         = adSpend
      row[`${p}::appoRate`]        = safeRate(appo, n)
      row[`${p}::kanryoRate`]      = safeRate(kanryo, n)
      row[`${p}::appoRateKanryo`]  = safeRate(appo, kanryo)
      row[`${p}::chakuzaRateList`] = safeRate(chakuza, n)
      row[`${p}::chakuzaRateAppo`] = safeRate(chakuza, appo)
      row[`${p}::juchuRateList`]   = safeRate(juchu, n)
    }

    return row
  })
}

export function aggregateCallEfficiency(calls: CallRow[]): CallEfficiencyData {
  const newDataCalls = calls.filter((c) => c.lead_id != null)

  const countMap = new Map<number, { total: number; appo: number }>()
  for (const call of newDataCalls) {
    const n = call.call_number
    const entry = countMap.get(n) ?? { total: 0, appo: 0 }
    entry.total += 1
    if (call.call_result != null && APPO_STATUSES.includes(call.call_result)) {
      entry.appo += 1
    }
    countMap.set(n, entry)
  }

  const callCountAppo: CallEfficiencyRow[] = Array.from(countMap.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(0, 10)
    .map(([callCount, { total, appo }]) => ({
      callCount,
      total,
      appo,
      appoRate: safeRate(appo, total),
    }))

  return {
    responseTimes: [],
    callCountAppo,
    hourlyConnect: [],
    hasNewData: newDataCalls.length > 0,
  }
}

export function calcKpi(rows: AdSummaryRow[]): KpiData {
  const totalLeads   = rows.reduce((s, r) => s + r.leads, 0)
  const totalAppo    = rows.reduce((s, r) => s + r.appo, 0)
  const totalKanryo  = rows.reduce((s, r) => s + r.kanryo, 0)
  const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0)
  const totalSpend   = rows.reduce((s, r) => s + (r.adSpend ?? 0), 0)

  return {
    totalLeads,
    totalAppo,
    appoRate:    safeRate(totalAppo, totalLeads),
    kanryoRate:  safeRate(totalKanryo, totalLeads),
    totalRevenue,
    roas: totalSpend > 0 && totalRevenue > 0 ? (totalRevenue / totalSpend) * 100 : null,
  }
}

// ─────────────────────────────────────────────────────────
// コホート分析（リードサマリータブ用）
// ─────────────────────────────────────────────────────────

export type CohortSnapshot = {
  kanryo:     number
  appo:       number
  kanryoRate: number
  appoRate:   number
  callCount:  number
}

export type CohortRow = {
  leadMonth: string
  adName:    string
  leads:     number
  m0: CohortSnapshot
  m1: CohortSnapshot
  m2: CohortSnapshot
  m3: CohortSnapshot
}

export function buildCohortData(
  leads: LeadRow[],
  calls: CallRecord[],
  targetAdNames: string[],
): CohortRow[] {
  // calls.list_record_id → CallRecord[] のマップ（leads.list_record_id で引く）
  const callsByListRecord = new Map<string, CallRecord[]>()
  for (const call of calls) {
    const key = call.list_record_id
    if (!key) continue
    if (!callsByListRecord.has(key)) callsByListRecord.set(key, [])
    callsByListRecord.get(key)!.push(call)
  }

  // リードを「流入月 __ 広告名」でグループ化
  const groups = new Map<string, LeadRow[]>()
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

    const snapshots = [0, 1, 2, 3].map((offsetMonths): CohortSnapshot => {
      // M0: 流入月末, M1: +1ヶ月末, ...
      const cutoff = new Date(leadMonthDate)
      cutoff.setMonth(cutoff.getMonth() + offsetMonths + 1)
      cutoff.setDate(0)
      cutoff.setHours(23, 59, 59)

      let kanryo = 0, appo = 0, totalCalls = 0

      for (const lead of groupLeads) {
        // list_record_id で calls を引く（なければ leads.status にフォールバック）
        const lrKey = lead.list_record_id ?? ''
        const leadCalls = lrKey ? (callsByListRecord.get(lrKey) ?? []) : []
        const validCalls = leadCalls.filter((c) => {
          const d = c.call_date ? new Date(c.call_date) : null
          return d && d <= cutoff
        })

        totalCalls += validCalls.length

        // cutoff 時点の最新架電結果
        const latestCall = validCalls
          .slice()
          .sort((a, b) => {
            const da = a.call_date ? new Date(a.call_date).getTime() : 0
            const db = b.call_date ? new Date(b.call_date).getTime() : 0
            return db - da
          })[0]

        const resultStr = latestCall?.call_result ?? lead.last_call_result ?? lead.status ?? ''

        if (KANRYO_STATUSES.includes(resultStr)) kanryo++
        if (APPO_STATUSES.includes(resultStr))   appo++
      }

      const n = groupLeads.length
      return {
        kanryo,
        appo,
        kanryoRate: n > 0 ? (kanryo / n) * 100 : 0,
        appoRate:   n > 0 ? (appo   / n) * 100 : 0,
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

  return results.sort(
    (a, b) => a.leadMonth.localeCompare(b.leadMonth) || a.adName.localeCompare(b.adName),
  )
}
