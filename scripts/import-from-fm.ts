/**
 * FMからlist_recordsをフル同期し、leadsエントリが存在しないものを新規作成する
 * 使い方: npx tsx scripts/import-from-fm.ts [--since 2026-04-28]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { syncListRecords } from '../src/lib/filemaker/sync'
import { createAdminClient } from '../src/lib/supabase/admin'

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

async function main() {
  // --since オプション処理
  const sinceIdx = process.argv.indexOf('--since')
  const since = sinceIdx !== -1 ? process.argv[sinceIdx + 1] : undefined
  if (since) console.log(`フィルター: ${since} 以降の更新レコード`)

  console.log('=== FM→CRM インポート開始:', new Date().toISOString())
  console.log(`TENANT_ID: ${TENANT_ID}`)

  // Step1: FMからlist_records同期
  console.log('\n[1/3] FMからlist_records同期中...')
  const syncResult = await syncListRecords()
  console.log(`  同期済み: ${syncResult.totalSynced}件, スキップ: ${syncResult.totalSkipped}件, エラー: ${syncResult.totalErrors}件`)

  const supabase = createAdminClient()

  // Step2: leadsエントリが未作成のlist_recordsを取得
  console.log('\n[2/3] leadsエントリ未作成のlist_records確認中...')
  const { data: listRecords, error: lrError } = await supabase
    .from('list_records')
    .select('id, customer_id, ad_name, company_name, representative_name, prefecture, phone_numbers, list_created_at, source, fm_record_id')
    .eq('tenant_id', TENANT_ID)
    .not('customer_id', 'is', null)
    .limit(1000)

  if (lrError) { console.error('list_records取得エラー:', lrError.message); process.exit(1) }
  if (!listRecords || listRecords.length === 0) {
    console.log('  list_recordsが存在しません')
    return
  }
  console.log(`  list_records合計: ${listRecords.length}件`)

  // Step3: 既にleadsエントリが存在するlist_record_idのセットを取得
  const listRecordIds = listRecords.map(r => r.id)
  const { data: existingLeads, error: elError } = await supabase
    .from('leads')
    .select('list_record_id')
    .in('list_record_id', listRecordIds)
    .eq('tenant_id', TENANT_ID)

  if (elError) { console.error('leads確認エラー:', elError.message); process.exit(1) }
  const existingSet = new Set((existingLeads ?? []).map(l => l.list_record_id))
  console.log(`  既存leadsエントリ: ${existingSet.size}件`)

  // Step4: 差分のみINSERT
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

  console.log(`\n[3/3] 新規leadsエントリ作成: ${newLeads.length}件`)

  if (newLeads.length === 0) {
    console.log('  全件既にleadsエントリが存在します')
  } else {
    let created = 0
    let errors = 0
    for (let i = 0; i < newLeads.length; i += 100) {
      const batch = newLeads.slice(i, i + 100)
      const { error } = await supabase.from('leads').insert(batch)
      if (error) {
        console.error(`  バッチ${i/100 + 1}エラー:`, error.message)
        errors += batch.length
      } else {
        created += batch.length
        process.stdout.write(`  ${created}件作成済み...\r`)
      }
    }
    console.log(`\n  ✓ leadsエントリ作成完了: ${created}件, エラー: ${errors}件`)
  }

  console.log('\n=== 完了:', new Date().toISOString())
  console.log(`  FM同期: ${syncResult.totalSynced}件`)
  console.log(`  leads新規作成: ${newLeads.length}件`)
}

main().catch(e => { console.error('エラー:', e); process.exit(1) })
