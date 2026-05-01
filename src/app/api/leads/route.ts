import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 100

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const q = searchParams.get('q') ?? ''
  const ad_name = searchParams.get('ad_name') ?? ''
  const result = searchParams.get('result') ?? ''
  const order_closed = searchParams.get('order_closed') ?? ''
  const since = searchParams.get('since') ?? ''
  const until = searchParams.get('until') ?? ''

  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('tenant_id', member.tenant_id)
    .order('inquiry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (q) {
    query = query.or(
      `company_name.ilike.%${q}%,representative_name.ilike.%${q}%,phone_number.ilike.%${q}%`
    )
  }
  if (ad_name) query = query.ilike('ad_name', `%${ad_name}%`)
  if (result) query = query.eq('last_call_result', result)
  if (order_closed === 'true') query = query.eq('order_closed', true)
  if (since) query = query.gte('inquiry_date', since)
  if (until) query = query.lte('inquiry_date', until)

  const { data: leads, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    leads: leads ?? [],
    total: count ?? 0,
    hasMore: (count ?? 0) > page * PAGE_SIZE,
  })
}
