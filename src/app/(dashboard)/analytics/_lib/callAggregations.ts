import type { CallRecord } from './types'
import { APPO_STATUSES } from './aggregations'

export type CallMonthlyRow = {
  month:        string
  totalCalls:   number
  appo:         number
  ng:           number
  rusu:         number
  appoRate:     number
  avgDuration:  number
  uniqueLeads:  number
}

export type AgentStats = {
  agentName:    string
  totalCalls:   number
  appo:         number
  ng:           number
  rusu:         number
  appoRate:     number
  avgDuration:  number
  uniqueLeads:  number
}

const NG_RESULTS    = new Set(['NG', '採用NG'])
const RUSU_RESULTS  = new Set(['留守'])

export function aggregateCallsByMonth(calls: CallRecord[]): CallMonthlyRow[] {
  const groups = new Map<string, CallRecord[]>()

  for (const call of calls) {
    const raw = call.call_date ?? call.created_at
    if (!raw) continue
    const month = String(raw).slice(0, 7)
    if (!groups.has(month)) groups.set(month, [])
    groups.get(month)!.push(call)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, mc]) => {
      const appo = mc.filter((c) => APPO_STATUSES.includes(c.call_result ?? '')).length
      const ng   = mc.filter((c) => NG_RESULTS.has(c.call_result ?? '')).length
      const rusu = mc.filter((c) => RUSU_RESULTS.has(c.call_result ?? '')).length
      const durs = mc.map((c) => c.call_duration_minutes ?? 0).filter((d) => d > 0)
      const avgDuration = durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0
      const uniqueLeads = new Set(mc.map((c) => c.list_record_id ?? c.lead_id).filter(Boolean)).size

      return {
        month,
        totalCalls: mc.length,
        appo, ng, rusu,
        appoRate:    mc.length > 0 ? (appo / mc.length) * 100 : 0,
        avgDuration,
        uniqueLeads,
      }
    })
}

export function aggregateCallsByAgent(calls: CallRecord[]): AgentStats[] {
  const groups = new Map<string, CallRecord[]>()

  for (const call of calls) {
    const agent = call.agent_name ?? '未設定'
    if (!groups.has(agent)) groups.set(agent, [])
    groups.get(agent)!.push(call)
  }

  return [...groups.entries()]
    .map(([agentName, ac]) => {
      const appo = ac.filter((c) => APPO_STATUSES.includes(c.call_result ?? '')).length
      const ng   = ac.filter((c) => NG_RESULTS.has(c.call_result ?? '')).length
      const rusu = ac.filter((c) => RUSU_RESULTS.has(c.call_result ?? '')).length
      const durs = ac.map((c) => c.call_duration_minutes ?? 0).filter((d) => d > 0)
      const avgDuration = durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0
      const uniqueLeads = new Set(ac.map((c) => c.list_record_id ?? c.lead_id).filter(Boolean)).size

      return {
        agentName,
        totalCalls: ac.length,
        appo, ng, rusu,
        appoRate:    ac.length > 0 ? (appo / ac.length) * 100 : 0,
        avgDuration,
        uniqueLeads,
      }
    })
    .sort((a, b) => b.totalCalls - a.totalCalls)
}

export function aggregateCallsByHour(
  calls: CallRecord[],
): Record<number, { total: number; connected: number }> {
  const result: Record<number, { total: number; connected: number }> = {}
  for (let h = 8; h <= 20; h++) result[h] = { total: 0, connected: 0 }

  const UNCONNECTED = new Set(['留守', 'NG', '採用NG', '未コール', '新規'])

  for (const call of calls) {
    const timeStr = call.call_start_time
      ?? (call.call_date?.includes('T') ? call.call_date.split('T')[1] : null)
    if (!timeStr) continue

    const hour = parseInt(timeStr.slice(0, 2), 10)
    if (hour < 8 || hour > 20) continue

    if (!result[hour]) result[hour] = { total: 0, connected: 0 }
    result[hour].total++
    if (!UNCONNECTED.has(call.call_result ?? '')) {
      result[hour].connected++
    }
  }

  return result
}
