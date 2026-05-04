import { createAdminClient } from '../src/lib/supabase/admin'

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/meta'
const TEST_PHONE = '08017858204'
const TEST_LIST_RECORD_ID = '796a0b55-e6ec-4037-bc1a-7d8109e962b5'

async function main() {
  const supabase = createAdminClient()

  // 事前確認
  const { count: beforeCount } = await supabase
    .from('webhook_leads')
    .select('*', { count: 'exact', head: true })
  console.log(`[before] webhook_leads count: ${beforeCount}`)

  const { count: leadsBefore } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('list_record_id', TEST_LIST_RECORD_ID)
  console.log(`[before] leads for list_record: ${leadsBefore}`)

  // Meta Webhook ダミーペイロード送信
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
              phone_number: TEST_PHONE,
              ad_name: 'テスト広告_Webhook疎通確認',
              form_id: 'TEST_FORM_001',
              page_id: 'TEST_PAGE_ID',
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

  // 事後確認
  await new Promise((r) => setTimeout(r, 500))

  const { data: newLeads, count: afterCount } = await supabase
    .from('webhook_leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(3)

  console.log(`\n[after] webhook_leads count: ${afterCount}`)
  if (newLeads && newLeads.length > 0) {
    const latest = newLeads[0]
    console.log('[latest webhook_lead]:', JSON.stringify(latest, null, 2))

    if (latest.added_to_list_id === TEST_LIST_RECORD_ID) {
      console.log(`\n✅ 名寄せ成功: added_to_list_id = ${latest.added_to_list_id}`)
    } else if (latest.status === 'pending') {
      console.log(`\n⚠️  名寄せ未マッチ: status=pending, phone_normalized=${latest.phone_normalized}`)
    } else {
      console.log(`\n❓ 予期しない状態: status=${latest.status}`)
    }
  } else {
    console.error('\n❌ webhook_leads に新規データなし（insertが失敗している可能性あり）')
  }

  const { data: leadsAfter, count: leadsCount } = await supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('list_record_id', TEST_LIST_RECORD_ID)
    .order('inquiry_at', { ascending: false })
    .limit(1)

  console.log(`\n[after] leads for list_record: ${leadsCount}`)
  if (leadsAfter && leadsAfter.length > 0) {
    console.log('[latest lead]:', JSON.stringify(leadsAfter[0], null, 2))
    console.log('\n✅ leads テーブルへの登録も確認済み')
  }
}

main().catch(console.error)
