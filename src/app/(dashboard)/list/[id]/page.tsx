import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { ListDetailClient } from '@/components/list/ListDetailClient'

type Call = {
  id: string
  call_date: string | null
  call_start_time: string | null
  call_end_time: string | null
  call_duration_minutes: number | null
  agent_name: string | null
  newcomer_flag: string | null
  call_result: string | null
  call_category: string | null
  appo_detail: string | null
}

type Lead = {
  id: string
  inquiry_date: string | null
  ad_name: string | null
  status: string | null
  newcomer_flag: string | null
  last_call_result: string | null
  order_closed: boolean | null
  jitsuyo_ok: boolean | null
  total_revenue: number | null
  appo_detail_status?: string | null
  appo_date?: string | null
  appo_time?: string | null
  appo_detail?: string | null
  source_data?: Record<string, unknown> | null
}

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createAdminClient()

  const [
    { data: rec, error },
    { data: calls },
    { data: leads },
  ] = await Promise.all([
    supabase
      .from('list_records')
      .select('*')
      .eq('id', id)
      .single(),
    supabase
      .from('calls')
      .select(
        'id,call_date,call_start_time,call_end_time,call_duration_minutes,agent_name,newcomer_flag,call_result,call_category,appo_detail'
      )
      .eq('list_record_id', id)
      .order('call_date', { ascending: false, nullsFirst: false })
      .order('call_start_time', { ascending: false, nullsFirst: false })
      .limit(500),
    supabase
      .from('leads')
      .select(
        'id,inquiry_date,ad_name,status,newcomer_flag,last_call_result,order_closed,jitsuyo_ok,total_revenue,appo_detail_status,appo_date,appo_time,appo_detail,source_data'
      )
      .eq('list_record_id', id)
      .order('inquiry_date', { ascending: false, nullsFirst: false })
      .limit(200),
  ])

  if (error || !rec) notFound()

  return (
    <ListDetailClient
      record={rec as Record<string, unknown>}
      calls={(calls ?? []) as Call[]}
      leads={(leads ?? []) as Lead[]}
    />
  )
}
