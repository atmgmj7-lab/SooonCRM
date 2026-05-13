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
  const tab          = searchParams.get('tab')          ?? 'all'
  const sort_col     = searchParams.get('sort_col')     ?? 'created_at'
  const sort_dir     = searchParams.get('sort_dir')     ?? 'desc'
  const filter_prefecture = searchParams.get('prefecture') ?? ''
  const ad_names_raw    = searchParams.get('ad_names')    ?? ''
  const prefectures_raw = searchParams.get('prefectures') ?? ''
  const statuses_raw    = searchParams.get('statuses')    ?? ''

  const ALLOWED_SORT_COLS = ['created_at', 'inquiry_at', 'inquiry_date', 'ad_name', 'company_name', 'prefecture', 'status'] as const
  type SortCol = typeof ALLOWED_SORT_COLS[number]
  const safeCol: SortCol = (ALLOWED_SORT_COLS as readonly string[]).includes(sort_col) ? sort_col as SortCol : 'created_at'
  const ascending = sort_dir === 'asc'

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
    .select(
      '*, list_records(ad_name, company_name, representative_name, prefecture, phone_numbers)',
      { count: 'exact' },
    )
    .eq('tenant_id', TENANT_ID)
    .or('phone_number.not.is.null,company_name.not.is.null,representative_name.not.is.null,ad_name.not.is.null')
    .order(safeCol, { ascending, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range((pageNum - 1) * limitNum, pageNum * limitNum - 1)

  if (q)                       mainQuery = mainQuery.or(`company_name.ilike.%${q}%,representative_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
  if (ad_name)                 mainQuery = mainQuery.ilike('ad_name', `%${ad_name}%`)
  if (status)                  mainQuery = mainQuery.eq('status', status)
  if (result)                  mainQuery = mainQuery.eq('status', result)
  if (order_closed === 'true') mainQuery = mainQuery.eq('order_closed', true)
  if (from)                    mainQuery = mainQuery.gte('inquiry_at', from)
  if (to)                      mainQuery = mainQuery.lte('inquiry_at', to + 'T23:59:59Z')
  if (since)                   mainQuery = mainQuery.gte('inquiry_date', since)
  if (until)                   mainQuery = mainQuery.lte('inquiry_date', until)
  if (tab === 'new')           mainQuery = mainQuery.eq('status', '新規')
  if (tab === 'done')          mainQuery = mainQuery.neq('status', '新規')
  if (filter_prefecture)       mainQuery = mainQuery.eq('prefecture', filter_prefecture)

  const ad_names_list    = ad_names_raw    ? ad_names_raw.split(',').filter(Boolean)    : []
  const prefectures_list = prefectures_raw ? prefectures_raw.split(',').filter(Boolean) : []
  const statuses_list    = statuses_raw    ? statuses_raw.split(',').filter(Boolean)    : []

  if (ad_names_list.length > 0)    mainQuery = mainQuery.in('ad_name', ad_names_list)
  if (prefectures_list.length > 0) mainQuery = mainQuery.in('prefecture', prefectures_list)
  if (statuses_list.length > 0)    mainQuery = mainQuery.in('status', statuses_list)

  const { data: leads, count, error } = await mainQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let appoDetailFilledQuery = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .not('appo_detail_status', 'is', null)
    .or('phone_number.not.is.null,company_name.not.is.null,representative_name.not.is.null,ad_name.not.is.null')

  if (q)                       appoDetailFilledQuery = appoDetailFilledQuery.or(`company_name.ilike.%${q}%,representative_name.ilike.%${q}%,phone_number.ilike.%${q}%`)
  if (ad_name)                 appoDetailFilledQuery = appoDetailFilledQuery.ilike('ad_name', `%${ad_name}%`)
  if (status)                  appoDetailFilledQuery = appoDetailFilledQuery.eq('status', status)
  if (result)                  appoDetailFilledQuery = appoDetailFilledQuery.eq('status', result)
  if (order_closed === 'true') appoDetailFilledQuery = appoDetailFilledQuery.eq('order_closed', true)
  if (from)                    appoDetailFilledQuery = appoDetailFilledQuery.gte('inquiry_at', from)
  if (to)                      appoDetailFilledQuery = appoDetailFilledQuery.lte('inquiry_at', to + 'T23:59:59Z')
  if (since)                   appoDetailFilledQuery = appoDetailFilledQuery.gte('inquiry_date', since)
  if (until)                   appoDetailFilledQuery = appoDetailFilledQuery.lte('inquiry_date', until)
  if (tab === 'new')             appoDetailFilledQuery = appoDetailFilledQuery.eq('status', '新規')
  if (tab === 'done')            appoDetailFilledQuery = appoDetailFilledQuery.neq('status', '新規')

  const { count: appoDetailFilledTotal, error: appoDetailCountError } = await appoDetailFilledQuery
  if (appoDetailCountError) {
    console.error('[leads GET] appo_detail count error:', appoDetailCountError)
  }

  // summaryクエリ（同じフィルタ条件・ページネーションなし）
  let summaryQuery = supabase
    .from('leads')
    .select('status, call_count, appo_at')
    .eq('tenant_id', TENANT_ID)
    .or('phone_number.not.is.null,company_name.not.is.null,representative_name.not.is.null,ad_name.not.is.null')

  if (ad_name)                 summaryQuery = summaryQuery.ilike('ad_name', `%${ad_name}%`)
  if (status)                  summaryQuery = summaryQuery.eq('status', status)
  if (result)                  summaryQuery = summaryQuery.eq('status', result)
  if (order_closed === 'true') summaryQuery = summaryQuery.eq('order_closed', true)
  if (from)                    summaryQuery = summaryQuery.gte('inquiry_at', from)
  if (to)                      summaryQuery = summaryQuery.lte('inquiry_at', to + 'T23:59:59Z')
  if (since)                   summaryQuery = summaryQuery.gte('inquiry_date', since)
  if (until)                   summaryQuery = summaryQuery.lte('inquiry_date', until)
  if (tab === 'new')             summaryQuery = summaryQuery.eq('status', '新規')
  if (tab === 'done')            summaryQuery = summaryQuery.neq('status', '新規')

  if (ad_names_list.length > 0)    summaryQuery = summaryQuery.in('ad_name', ad_names_list)
  if (prefectures_list.length > 0) summaryQuery = summaryQuery.in('prefecture', prefectures_list)
  if (statuses_list.length > 0)    summaryQuery = summaryQuery.in('status', statuses_list)

  const { data: summaryData } = await summaryQuery

  let newLeadCountQuery = supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .or('phone_number.not.is.null,company_name.not.is.null,representative_name.not.is.null,ad_name.not.is.null')
    .eq('status', '新規')
  if (q) newLeadCountQuery = newLeadCountQuery.or(
    `company_name.ilike.%${q}%,representative_name.ilike.%${q}%,phone_number.ilike.%${q}%`,
  )
  const { count: newLeadCount } = await newLeadCountQuery

  const appoCount      = summaryData?.filter(l => l.appo_at !== null).length ?? 0
  const wonCount       = summaryData?.filter(l => l.status === '受注').length ?? 0
  const totalCallCount = summaryData?.reduce((sum, l) => sum + (Number(l.call_count) || 0), 0) ?? 0
  const avgCallCount   = summaryData?.length
    ? Math.round((totalCallCount / summaryData.length) * 10) / 10
    : 0

  type JoinedLeadRow = Record<string, unknown> & {
    list_records?:
      | {
          ad_name?: string | null
          company_name?: string | null
          representative_name?: string | null
          prefecture?: string | null
          phone_numbers?: string[] | null
        }
      | null
  }

  const flatLeads = (leads ?? []).map((l: JoinedLeadRow) => {
    const lr = l.list_records ?? null
    return {
      ...l,
      ad_name:               l.ad_name               ?? lr?.ad_name               ?? null,
      company_name:          l.company_name          ?? lr?.company_name          ?? null,
      representative_name:   l.representative_name   ?? lr?.representative_name   ?? null,
      prefecture:            l.prefecture            ?? lr?.prefecture            ?? null,
      phone_number:          l.phone_number          ?? lr?.phone_numbers?.[0]   ?? null,
      list_records:          undefined,
    }
  })

  return NextResponse.json({
    leads: flatLeads,
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
    newLeadCount: newLeadCount ?? 0,
    appoDetailFilledTotal: appoDetailFilledTotal ?? 0,
  })
}
