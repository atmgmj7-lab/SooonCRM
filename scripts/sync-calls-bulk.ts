/**
 * コール履歴バルク同期スクリプト
 * FM → Supabase 全件同期（タイムアウトなし・ローカル実行専用）
 *
 * 実行: npx tsx scripts/sync-calls-bulk.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { fmGetRecords, fmLogout, getFMToken } from '../src/lib/filemaker/client'
import { mapFMCallToSupabase } from '../src/lib/filemaker/mappers'

const TENANT_ID    = process.env.DEFAULT_TENANT_ID ?? 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
const LAYOUT       = process.env.FM_LAYOUT_CALLS!
const BATCH_SIZE   = 2000  // FMから取得するバッチサイズ
const UPSERT_CHUNK = 500   // Supabaseへのupsertチャンクサイズ

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getCurrentCallsCount(): Promise<number> {
  const { count } = await supabase
    .from('calls')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
  return count ?? 0
}

async function buildCustomerIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('list_records')
      .select('id, customer_id')
      .eq('tenant_id', TENANT_ID)
      .not('customer_id', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data) {
      if (r.customer_id) map.set(r.customer_id, r.id)
    }
    if (data.length < 1000) break
    from += 1000
  }
  return map
}

async function buildExistingFmIdSet(): Promise<Set<string>> {
  const set = new Set<string>()
  let from = 0
  process.stdout.write('既存レコードの fm_record_id を取得中...')
  while (true) {
    const { data } = await supabase
      .from('calls')
      .select('fm_record_id')
      .eq('tenant_id', TENANT_ID)
      .not('fm_record_id', 'is', null)
      .range(from, from + 9999)
    if (!data || data.length === 0) break
    for (const r of data) {
      if (r.fm_record_id) set.add(r.fm_record_id)
    }
    process.stdout.write(` ${set.size}件...`)
    if (data.length < 10000) break
    from += 10000
  }
  console.log(` 完了 (${set.size}件)`)
  return set
}

async function upsertChunk(rows: Record<string, unknown>[]): Promise<number> {
  const { error } = await supabase
    .from('calls')
    .upsert(rows, { onConflict: 'fm_record_id', ignoreDuplicates: false })
  if (error) {
    console.error('  upsertエラー:', error.message)
    return 0
  }
  return rows.length
}

async function main() {
  console.log('=== コール履歴バルク同期 開始 ===')
  console.log('日時:', new Date().toISOString())
  console.log('レイアウト:', LAYOUT)
  console.log('テナントID:', TENANT_ID)
  console.log('')

  const currentCount = await getCurrentCallsCount()
  console.log(`Supabase現在件数: ${currentCount}件`)

  await getFMToken()
  console.log('FM認証: OK')

  process.stdout.write('customer_id マップを構築中...')
  const customerIdMap = await buildCustomerIdMap()
  console.log(` ${customerIdMap.size}件`)

  const existingFmIds = await buildExistingFmIdSet()

  console.log('')
  console.log('同期開始...')
  console.log('─'.repeat(60))

  let fmOffset     = 1
  let totalSynced  = 0
  let totalSkipped = 0
  let totalErrors  = 0
  let totalNoList  = 0

  while (true) {
    const rangeEnd = fmOffset + BATCH_SIZE - 1
    process.stdout.write(`[${fmOffset}〜${rangeEnd}件目] FM取得中...`)

    const result = await fmGetRecords(LAYOUT, {
      _offset: fmOffset,
      _limit: BATCH_SIZE,
    })
    const records = result.response?.data ?? []
    console.log(` ${records.length}件取得`)

    if (records.length === 0) break

    const rows: Record<string, unknown>[] = []
    let skippedThisBatch = 0
    let noListThisBatch  = 0

    for (const rec of records) {
      const fmRecordId = String(rec.recordId)

      if (existingFmIds.has(fmRecordId)) {
        skippedThisBatch++
        totalSkipped++
        continue
      }

      const mapped = mapFMCallToSupabase(rec.fieldData)
      const customerId = mapped.fm_customer_id

      if (!customerId) {
        totalErrors++
        continue
      }

      const listRecordId = customerIdMap.get(customerId) ?? null
      if (!listRecordId) {
        noListThisBatch++
        totalNoList++
        continue
      }

      const { fm_customer_id, ...callData } = mapped
      void fm_customer_id

      rows.push({
        tenant_id:          TENANT_ID,
        list_record_id:     listRecordId,
        fm_record_id:       fmRecordId,
        fm_modification_id: String((rec as unknown as { modId: string }).modId ?? ''),
        ...callData,
      })

      existingFmIds.add(fmRecordId)
    }

    let savedThisBatch = 0
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK)
      savedThisBatch += await upsertChunk(chunk)
    }
    totalSynced += savedThisBatch

    console.log(
      `  → 保存: ${savedThisBatch}件 / スキップ: ${skippedThisBatch}件 / list無し: ${noListThisBatch}件 / 累計保存: ${totalSynced}件`
    )

    if (records.length < BATCH_SIZE) break
    fmOffset += BATCH_SIZE
  }

  await fmLogout()

  console.log('')
  console.log('='.repeat(60))
  console.log('=== 同期完了 ===')
  console.log(`新規保存:   ${totalSynced}件`)
  console.log(`スキップ:   ${totalSkipped}件 (既存)`)
  console.log(`list無し:   ${totalNoList}件 (顧客IDなし)`)
  console.log(`エラー:     ${totalErrors}件`)

  const finalCount = await getCurrentCallsCount()
  console.log('')
  console.log(`Supabase最終件数: ${finalCount}件`)
  console.log('終了:', new Date().toISOString())
}

main().catch(e => {
  console.error('致命的エラー:', e)
  process.exit(1)
})
