import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 50

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  console.log('SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const q = searchParams.get('q') ?? ''
  const last_call_result = searchParams.get('last_call_result') ?? ''
  const status = searchParams.get('status') ?? ''

  const supabase = createAdminClient()

  let query = supabase
    .from('list_records')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .not('company_name', 'is', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (q) {
    query = query.or(`company_name.ilike.%${q}%,representative_name.ilike.%${q}%`)
  }
  if (last_call_result) query = query.eq('last_call_result', last_call_result)
  if (status) query = query.eq('status', status)

  const { data: records, count, error } = await query

  if (error) {
    console.log('Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    records: records ?? [],
    total: count ?? 0,
    hasMore: (count ?? 0) > page * PAGE_SIZE,
  })
}
