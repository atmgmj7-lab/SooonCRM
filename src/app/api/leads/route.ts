import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const pageNum  = parseInt(searchParams.get('page')  ?? '1',  10)
  const limitNum = parseInt(searchParams.get('limit') ?? '50', 10)
  const q            = searchParams.get('q')            ?? ''
  const ad_name      = searchParams.get('ad_name')      ?? ''
  const status       = searchParams.get('status')       ?? ''
  const result       = searchParams.get('result')       ?? ''
  const order_closed = searchParams.get('order_closed') ?? ''
  const from         = searchParams.get('from')         ?? ''
  const to           = searchParams.get('to')           ?? ''
  const since        = searchParams.get('since')        ?? ''
  const until        = searchParams.get('until')        ?? ''

  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const TENANT_ID = member.tenant_id

  // メインクエリ（ページネーション付き）
  let mainQuery = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('tenant_id', TENANT_ID)
    .or('phone_number.not.is.null,company_name.not.is.null,representative_name.not.is.null,ad_name.not.is.null')
    .order('inquiry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((pageNum - 1) * limitNum, pageNum * limitNum - 1)

  if (q)                       mainQuery = mainQuery.or(`company_name.ilike.%${q}%,representative_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
  if (ad_name)                 mainQuery = mainQuery.ilike('ad_name', `%${ad_name}%`)
  if (status)                  mainQuery = mainQuery.eq('status', status)
  if (result)                  mainQuery = mainQuery.eq('last_call_result', result)
  if (order_closed === 'true') mainQuery = mainQuery.eq('order_closed', true)
  if (from)                    mainQuery = mainQuery.gte('inquiry_at', from)
  if (to)                      mainQuery = mainQuery.lte('inquiry_at', to + 'T23:59:59Z')
  if (since)                   mainQuery = mainQuery.gte('inquiry_date', since)
  if (until)                   mainQuery = mainQuery.lte('inquiry_date', until)

  const { data: leads, count, error } = await mainQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // summaryクエリ（同じフィルタ条件・ページネーションなし）
  let summaryQuery = supabase
    .from('leads')
    .select('status, call_count, appo_at')
    .eq('tenant_id', TENANT_ID)
    .or('phone_number.not.is.null,company_name.not.is.null,representative_name.not.is.null,ad_name.not.is.null')

  if (ad_name)                 summaryQuery = summaryQuery.ilike('ad_name', `%${ad_name}%`)
  if (status)                  summaryQuery = summaryQuery.eq('status', status)
  if (result)                  summaryQuery = summaryQuery.eq('last_call_result', result)
  if (order_closed === 'true') summaryQuery = summaryQuery.eq('order_closed', true)
  if (from)                    summaryQuery = summaryQuery.gte('inquiry_at', from)
  if (to)                      summaryQuery = summaryQuery.lte('inquiry_at', to + 'T23:59:59Z')
  if (since)                   summaryQuery = summaryQuery.gte('inquiry_date', since)
  if (until)                   summaryQuery = summaryQuery.lte('inquiry_date', until)

  const { data: summaryData } = await summaryQuery

  const appoCount      = summaryData?.filter(l => l.appo_at !== null).length ?? 0
  const wonCount       = summaryData?.filter(l => l.status === '受注').length ?? 0
  const totalCallCount = summaryData?.reduce((sum, l) => sum + (Number(l.call_count) || 0), 0) ?? 0
  const avgCallCount   = summaryData?.length
    ? Math.round((totalCallCount / summaryData.length) * 10) / 10
    : 0

  return NextResponse.json({
    leads: leads ?? [],
    pagination: {
      total:      count ?? 0,
      page:       pageNum,
      limit:      limitNum,
      totalPages: Math.ceil((count ?? 0) / limitNum),
    },
    summary: {
      total_leads:    count ?? 0,
      appo_count:     appoCount,
      appo_rate:      count ? Math.round((appoCount / count) * 1000) / 10 : 0,
      won_count:      wonCount,
      won_rate:       count ? Math.round((wonCount / count) * 1000) / 10 : 0,
      avg_call_count: avgCallCount,
    },
    total:   count ?? 0,
    hasMore: (count ?? 0) > pageNum * limitNum,
  })
}
