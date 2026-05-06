import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE_SIZE = 50

type SearchCondition = { field: string; op: string; value: string }
type SortKey = { field: string; dir: 'asc' | 'desc' }

const ALLOWED_FIELDS = new Set([
  'company_name', 'representative_name', 'ad_name', 'prefecture',
  'last_call_result', 'status', 'title', 'industry',
])

const ALLOWED_SORT_FIELDS = new Set([
  'created_at', 'ad_name', 'company_name', 'representative_name',
  'prefecture', 'last_call_result', 'last_call_count', 'inquiry_count',
  'last_inquiry_at', 'status',
])

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const page             = parseInt(searchParams.get('page') ?? '1', 10)
  const q                = searchParams.get('q') ?? ''
  const last_call_result = searchParams.get('last_call_result') ?? ''
  const status           = searchParams.get('status') ?? ''
  const searchRaw        = searchParams.get('search') ?? ''
  const sortRaw          = searchParams.get('sort') ?? ''

  let searchConditions: SearchCondition[] = []
  let sorts: SortKey[] = [{ field: 'created_at', dir: 'desc' }]

  try {
    if (searchRaw) searchConditions = JSON.parse(searchRaw)
  } catch { /* ignore */ }

  try {
    if (sortRaw) sorts = JSON.parse(sortRaw)
  } catch { /* ignore */ }

  const supabase = createAdminClient()

  let query = supabase
    .from('list_records')
    // 全列取得: chosei / saiyo_ok / saiyo_ng / juchu（アポOK内訳）を含む
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .not('company_name', 'is', null)

  // Sort
  for (const s of sorts) {
    if (ALLOWED_SORT_FIELDS.has(s.field)) {
      query = query.order(s.field, { ascending: s.dir === 'asc', nullsFirst: false })
    }
  }

  query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  // Normal filters
  if (q) {
    query = query.or(`company_name.ilike.%${q}%,representative_name.ilike.%${q}%`)
  }
  if (last_call_result) query = query.eq('last_call_result', last_call_result)
  if (status) query = query.eq('status', status)

  // Advanced search conditions
  for (const cond of searchConditions) {
    if (!ALLOWED_FIELDS.has(cond.field) || !cond.value.trim()) continue
    const val = cond.value.trim()
    switch (cond.op) {
      case 'ilike': query = query.ilike(cond.field, `%${val}%`); break
      case 'eq':    query = query.eq(cond.field, val); break
      case 'neq':   query = query.neq(cond.field, val); break
      case 'gte':   query = query.gte(cond.field, val); break
      case 'lte':   query = query.lte(cond.field, val); break
    }
  }

  const { data: records, count, error } = await query

  if (error) {
    console.error('[list-records GET] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    records: records ?? [],
    total: count ?? 0,
    hasMore: (count ?? 0) > page * PAGE_SIZE,
  })
}
