import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

/**
 * leads.ad_name が null のレコードを list_records.ad_name で埋めるバックフィル
 * leads.list_record_id → list_records.ad_name を辿って補完する
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  let totalSynced = 0
  let totalSkipped = 0
  let from = 0

  while (true) {
    // ad_name が null で list_record_id がある leads を取得
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, list_record_id')
      .eq('tenant_id', TENANT_ID)
      .is('ad_name', null)
      .not('list_record_id', 'is', null)
      .range(from, from + 199)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!leads || leads.length === 0) break

    // list_record_id をまとめて取得
    const listIds = [...new Set(leads.map((l) => l.list_record_id).filter(Boolean))] as string[]
    const { data: listRecs } = await supabase
      .from('list_records')
      .select('id, ad_name')
      .in('id', listIds)
      .not('ad_name', 'is', null)

    const adNameMap = new Map<string, string>()
    for (const lr of listRecs ?? []) {
      if (lr.ad_name) adNameMap.set(lr.id, lr.ad_name)
    }

    // バッチ更新
    for (const lead of leads) {
      const adName = lead.list_record_id ? adNameMap.get(lead.list_record_id) : null
      if (!adName) { totalSkipped++; continue }

      const { error: upErr } = await supabase
        .from('leads')
        .update({ ad_name: adName })
        .eq('id', lead.id)

      if (upErr) { totalSkipped++; continue }
      totalSynced++
    }

    if (leads.length < 200) break
    from += 200
  }

  return NextResponse.json({ ok: true, totalSynced, totalSkipped })
}
