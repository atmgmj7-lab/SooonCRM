import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 100

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page   = parseInt(searchParams.get('page') ?? '1', 10)
  const q      = searchParams.get('q') ?? ''
  const result = searchParams.get('result') ?? ''
  const agent  = searchParams.get('agent') ?? ''

  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  let query = supabase
    .from('calls')
    .select(
      `id, call_date, call_start_time, call_end_time, call_duration_minutes,
       call_result, agent_name, call_category, rep_level, appo_detail,
       list_record_id,
       list_records(company_name, representative_name, phone_numbers)`,
      { count: 'exact' }
    )
    .eq('tenant_id', member.tenant_id)
    .order('call_date', { ascending: false, nullsFirst: false })
    .order('call_start_time', { ascending: false, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (q) {
    query = query.or(
      `agent_name.ilike.%${q}%,call_result.ilike.%${q}%,appo_detail.ilike.%${q}%`
    )
  }
  if (result) query = query.eq('call_result', result)
  if (agent)  query = query.ilike('agent_name', `%${agent}%`)

  const { data: calls, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    calls: calls ?? [],
    total: count ?? 0,
    hasMore: (count ?? 0) > page * PAGE_SIZE,
  })
}
