import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncListRecords } from '@/lib/filemaker/sync'

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

// GET: list_records / leads の件数確認
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const [{ count: listCount }, { count: leadsCount }] = await Promise.all([
    supabase.from('list_records').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID),
  ])

  return NextResponse.json({
    list_records_count: listCount ?? 0,
    leads_count: leadsCount ?? 0,
  })
}

// POST: FMからフル同期 → leadsエントリも作成
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let sinceDate: string | undefined
  try {
    const body = await request.json() as { since_date?: string }
    sinceDate = body.since_date
  } catch {
    // body省略可
  }

  // Step1: FMからlist_recordsを全件同期（既存のdelta sync）
  const syncResult = await syncListRecords()

  const supabase = createAdminClient()

  // Step2: leadsエントリが存在しないlist_recordsを取得
  //        since_dateが指定された場合はlist_created_at or updated_atでフィルター
  let query = supabase
    .from('list_records')
    .select('id, customer_id, ad_name, company_name, representative_name, prefecture, phone_numbers, list_created_at, source, fm_record_id')
    .eq('tenant_id', TENANT_ID)
    .not('customer_id', 'is', null)

  if (sinceDate) {
    query = query.gte('updated_at', sinceDate)
  }

  const { data: listRecords, error: lrError } = await query.limit(500)
  if (lrError) return NextResponse.json({ error: lrError.message }, { status: 500 })
  if (!listRecords || listRecords.length === 0) {
    return NextResponse.json({ ok: true, ...syncResult, leads_created: 0 })
  }

  // Step3: 既にleadsが存在するlist_record_idのセットを取得
  const listRecordIds = listRecords.map(r => r.id)
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('list_record_id')
    .in('list_record_id', listRecordIds)
    .eq('tenant_id', TENANT_ID)

  const existingSet = new Set((existingLeads ?? []).map(l => l.list_record_id))

  // Step4: leadsエントリが存在しないものだけ新規作成
  const newLeads = listRecords
    .filter(r => !existingSet.has(r.id))
    .map(r => {
      const phones = r.phone_numbers as string[] | null
      const phone = phones?.[0] ?? null
      return {
        tenant_id:           TENANT_ID,
        customer_id:         r.customer_id,
        list_record_id:      r.id,
        ad_name:             r.ad_name ?? null,
        company_name:        r.company_name ?? null,
        representative_name: r.representative_name ?? null,
        prefecture:          r.prefecture ?? null,
        phone_number:        phone,
        source:              r.source ?? 'filemaker',
        status:              '未対応',
        inquiry_at:          r.list_created_at ?? new Date().toISOString(),
      }
    })

  if (newLeads.length === 0) {
    return NextResponse.json({ ok: true, ...syncResult, leads_created: 0, message: '全件leadsエントリ済み' })
  }

  // バッチINSERT（100件ずつ）
  let leadsCreated = 0
  let leadsErrors = 0
  for (let i = 0; i < newLeads.length; i += 100) {
    const batch = newLeads.slice(i, i + 100)
    const { error } = await supabase.from('leads').insert(batch)
    if (error) {
      console.error('[sync-from-fm] leads insert error:', error.message)
      leadsErrors += batch.length
    } else {
      leadsCreated += batch.length
    }
  }

  return NextResponse.json({
    ok: true,
    fm_synced:    syncResult.totalSynced,
    fm_skipped:   syncResult.totalSkipped,
    fm_errors:    syncResult.totalErrors,
    leads_created: leadsCreated,
    leads_errors:  leadsErrors,
  })
}
