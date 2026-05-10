import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { upsertListRecordToFM } from '@/lib/filemaker/pushToFM'

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

// GET: FM未同期リードの件数確認
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { count } = await supabase
    .from('list_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .in('source', ['meta_ads', 'google_ads'])
    .is('fm_record_id', null)

  return NextResponse.json({ unsynced_count: count ?? 0 })
}

// POST: FM未同期リードを一括プッシュ
//   - FM側に同じ電話番号が存在 → 新規作成せずリンクのみ（重複防止）
//   - FM側に存在しない        → 新規リスト登録
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: records, error } = await supabase
    .from('list_records')
    .select('id, customer_id, ad_name, company_name, representative_name, prefecture, phone_numbers')
    .eq('tenant_id', TENANT_ID)
    .in('source', ['meta_ads', 'google_ads'])
    .is('fm_record_id', null)
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!records || records.length === 0) {
    return NextResponse.json({ ok: true, created: 0, linked: 0, failed: 0, message: '未同期リードなし' })
  }

  let created = 0  // FM新規作成
  let linked  = 0  // FM既存レコードにリンク
  let failed  = 0
  const errors: string[] = []

  for (const rec of records) {
    try {
      const phones = rec.phone_numbers as string[] | null

      const fmRes = await upsertListRecordToFM({
        company_name:        rec.company_name,
        representative_name: rec.representative_name,
        prefecture:          rec.prefecture,
        phone_numbers:       phones ?? [],
        ad_name:             rec.ad_name,
        inquiry_at:          null,
        title:               null,
        newcomer_flag:       null,
        list_record_id:      rec.id,
      })

      if (!fmRes.ok || !fmRes.fm_record_id) {
        failed++
        errors.push(`${rec.id}: ${fmRes.error ?? 'FM upsert failed'}`)
        continue
      }

      if (fmRes.action === 'created') created++
      else if (fmRes.action === 'linked') linked++

    } catch (e) {
      failed++
      errors.push(`${rec.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, created, linked, failed, errors: errors.slice(0, 10) })
}
