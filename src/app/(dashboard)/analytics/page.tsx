import { createClient } from '@/lib/supabase/server'
import { aggregateByAd, aggregateByMonth } from './_lib/aggregations'
import type { LeadRow, AdSummaryRow, MonthlyRow, CallRecord } from './_lib/types'
import { AnalyticsClient } from './_components/AnalyticsClient'

const TENANT_ID = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
const LEADS_SELECT = 'id, list_record_id, ad_name, status, inquiry_at, list_created_at, jitsuyo_ok, order_closed, deal_amount, source_data, initial_fee, monthly_fee, appo_detail_status, appo_date, appo_time, appo_detail, juchu'
const PAGE_SIZE = 1000

async function fetchAllLeads(supabase: Awaited<ReturnType<typeof createClient>>): Promise<LeadRow[]> {
  const all: LeadRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select(LEADS_SELECT)
      .eq('tenant_id', TENANT_ID)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[AnalyticsPage] leads query error:', error)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as LeadRow[]))
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

export interface AnalyticsServerData {
  rawLeads: LeadRow[]
  initialAdStats: AdSummaryRow[]
  initialMonthlyData: MonthlyRow[]
  rawCalls: CallRecord[]
  adNames: string[]
}

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const [rawLeads, callsRes] = await Promise.all([
    fetchAllLeads(supabase),
    supabase
      .from('calls')
      .select('id, list_record_id, call_date, call_start_time, call_result, call_number, call_duration_minutes, agent_name, created_at')
      .eq('tenant_id', TENANT_ID)
      .order('call_date', { ascending: true })
      .limit(20000),
  ])

  if (callsRes.error) {
    console.error('[AnalyticsPage] calls query error:', callsRes.error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCalls: CallRecord[] = ((callsRes.data ?? []) as any[]).map((c) => ({
    id:                    c.id,
    lead_id:               null,
    list_record_id:        c.list_record_id ?? null,
    call_date:             c.call_date ?? null,
    call_start_time:       c.call_start_time ?? null,
    call_result:           c.call_result ?? null,
    call_number:           c.call_number ?? null,
    call_duration_minutes: c.call_duration_minutes ?? null,
    agent_name:            c.agent_name ?? null,
    created_at:            c.created_at,
  }))

  const initialAdStats     = aggregateByAd(rawLeads)
  const initialMonthlyData = aggregateByMonth(rawLeads)
  const adNames            = [...new Set(rawLeads.map((l) => l.ad_name).filter(Boolean))] as string[]

  return (
    <AnalyticsClient
      rawLeads={rawLeads}
      initialAdStats={initialAdStats}
      initialMonthlyData={initialMonthlyData}
      rawCalls={rawCalls}
      adNames={adNames}
    />
  )
}
