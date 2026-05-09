import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmCreateRecord } from '@/lib/filemaker/client'

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

// POST: FM未同期リードを一括プッシュ（弾かれたリードの再取得）
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // FM未同期の広告リードを全件取得
  const { data: records, error } = await supabase
    .from('list_records')
    .select('id, customer_id, ad_name, company_name, representative_name, prefecture, phone_numbers')
    .eq('tenant_id', TENANT_ID)
    .in('source', ['meta_ads', 'google_ads'])
    .is('fm_record_id', null)
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!records || records.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, failed: 0, message: '未同期リードなし' })
  }

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const rec of records) {
    try {
      const phones = rec.phone_numbers as string[] | null
      const phone  = phones?.[0] ?? ''

      const result = await fmCreateRecord({
        '顧客ID':       rec.customer_id  ?? '',
        'ADNAME':      rec.ad_name       ?? '',
        '会社名':      rec.company_name  ?? '',
        '代表名':      rec.representative_name ?? '',
        '都道府県':    rec.prefecture    ?? '',
        '電話番号':    phone,
        'インバウンド': '1',
      })

      if (result?.recordId) {
        await supabase
          .from('list_records')
          .update({ fm_record_id: result.recordId })
          .eq('id', rec.id)
        synced++
      } else {
        failed++
        errors.push(`${rec.id}: FM create returned no recordId`)
      }
    } catch (e) {
      failed++
      errors.push(`${rec.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, synced, failed, errors: errors.slice(0, 10) })
}
