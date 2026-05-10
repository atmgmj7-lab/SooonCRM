import { config } from 'dotenv'
config({ path: '.env.local' })

import { createAdminClient } from '../src/lib/supabase/admin'

// --prod フラグで本番URLに向ける
const isProd = process.argv.includes('--prod')
const WEBHOOK_URL = isProd
  ? `https://${process.env.NEXT_PUBLIC_APP_URL ?? 'sooon-crm.vercel.app'}/api/webhooks/meta`
  : 'http://localhost:3000/api/webhooks/meta'

// テスト用にランダムな架空番号（09099999xxx）を使う
const TEST_PHONE = `0909999${String(Math.floor(Math.random() * 9000) + 1000)}`

async function main() {
  console.log(`\n🔗 送信先: ${WEBHOOK_URL}`)
  console.log(`📞 テスト電話番号: ${TEST_PHONE}`)

  const supabase = createAdminClient()

  // 事前カウント
  const { count: beforeCount } = await supabase
    .from('webhook_leads')
    .select('*', { count: 'exact', head: true })
  console.log(`\n[before] webhook_leads: ${beforeCount}件`)

  // Meta Webhook ダミーペイロード（実際の Meta leadgen イベントと同じ構造）
  const payload = {
    object: 'page',
    entry: [
      {
        id: 'TEST_PAGE_ID',
        time: Date.now(),
        changes: [
          {
            field: 'leadgen',
            value: {
              leadgen_id: `TEST_LEAD_${Date.now()}`,
              ad_name: 'テスト広告_Webhook疎通確認',
              form_id: 'TEST_FORM_001',
              page_id: 'TEST_PAGE_ID',
              field_data: [
                { name: 'phone_number', values: [TEST_PHONE] },
                { name: 'full_name',    values: ['テスト太郎'] },
                { name: 'company_name', values: ['テスト株式会社'] },
                { name: 'state',        values: ['東京都'] },
              ],
            },
          },
        ],
      },
    ],
  }

  console.log('\n[POST] sending to', WEBHOOK_URL)
  console.log('[POST] payload:', JSON.stringify(payload, null, 2))

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const resBody = await res.json()
  console.log(`\n[response] status: ${res.status}`)
  console.log('[response] body:', JSON.stringify(resBody, null, 2))

  if (!res.ok) {
    console.error('❌ Webhook request failed')
    process.exit(1)
  }

  // 事後確認（少し待ってから）
  await new Promise((r) => setTimeout(r, 1500))

  const { data: newLeads, count: afterCount } = await supabase
    .from('webhook_leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(1)

  console.log(`\n[after] webhook_leads: ${afterCount}件`)

  if (!newLeads || newLeads.length === 0) {
    console.error('❌ webhook_leads に新規データなし')
    return
  }

  const latest = newLeads[0]
  const statusIcon = latest.status === 'added' ? '✅' : latest.status === 'pending' ? '⚠️' : '❓'
  console.log(`${statusIcon} webhook_lead status: ${latest.status}`)
  console.log(`   phone: ${latest.phone_normalized ?? '(正規化失敗)'}`)
  console.log(`   added_to_list_id: ${latest.added_to_list_id ?? '(未マッチ)'}`)

  // list_records に入ったか確認
  if (latest.added_to_list_id) {
    const { data: lr } = await supabase
      .from('list_records')
      .select('id, customer_id, company_name, fm_record_id')
      .eq('id', latest.added_to_list_id)
      .single()
    if (lr) {
      console.log(`\n✅ list_records 登録確認`)
      console.log(`   customer_id: ${lr.customer_id}`)
      console.log(`   company_name: ${lr.company_name}`)
      console.log(`   fm_record_id: ${lr.fm_record_id ?? '(FM未同期)'}`)
    }

    // leads に入ったか確認
    const { data: lead } = await supabase
      .from('leads')
      .select('id, status, inquiry_at')
      .eq('list_record_id', latest.added_to_list_id)
      .order('inquiry_at', { ascending: false })
      .limit(1)
      .single()
    if (lead) {
      console.log(`\n✅ leads 登録確認`)
      console.log(`   status: ${lead.status}`)
      console.log(`   inquiry_at: ${lead.inquiry_at}`)
    }
  }

  console.log('\n--- テスト後クリーンアップ ---')
  // テストデータをクリーンアップ（テスト電話番号のもののみ削除）
  if (latest.added_to_list_id) {
    await supabase.from('leads').delete().eq('list_record_id', latest.added_to_list_id)
    await supabase.from('list_records').delete().eq('id', latest.added_to_list_id)
  }
  await supabase.from('webhook_leads').delete().eq('id', latest.id)
  console.log('🗑️  テストデータを削除しました')
}

main().catch(console.error)
