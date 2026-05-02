import { createAdminClient } from '@/lib/supabase/admin'
import { fmGetRecords, fmLogout } from './client'
import { mapFMListToSupabase, mapFMCallToSupabase } from './mappers'

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
const BATCH_SIZE = 100

// Supabase から既存の modId を一括取得（変更なしレコードのスキップに使う）
async function fetchModIdMap(
  table: 'list_records' | 'calls',
  supabase: ReturnType<typeof createAdminClient>
) {
  const map = new Map<string, string>()
  let from = 0
  while (true) {
    const { data } = await supabase
      .from(table)
      .select('fm_record_id, fm_modification_id')
      .eq('tenant_id', TENANT_ID)
      .not('fm_record_id', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const r of data) {
      if (r.fm_record_id) map.set(r.fm_record_id, r.fm_modification_id ?? '')
    }
    if (data.length < 1000) break
    from += 1000
  }
  return map
}

// ---- リスト情報同期 ----
export async function syncListRecords(_sinceModified?: string) {
  const supabase = createAdminClient()
  const layout = process.env.FM_LAYOUT_LIST!
  let offset = 1
  let totalSynced = 0
  let totalErrors = 0
  let totalSkipped = 0

  // 既存 modId を一括取得（変更なしレコードをスキップするため）
  const modIdMap = await fetchModIdMap('list_records', supabase)

  while (true) {
    const result = await fmGetRecords(layout, { _offset: offset, _limit: BATCH_SIZE })
    const records = result.response?.data ?? []
    if (records.length === 0) break

    for (const rec of records) {
      try {
        const fmRecordId = String(rec.recordId)
        const fmModId    = String((rec as unknown as { modId: string }).modId ?? '')

        // modId が同じなら変更なし → スキップ
        if (fmModId !== '' && modIdMap.get(fmRecordId) === fmModId) {
          totalSkipped++
          continue
        }

        const fields = rec.fieldData
        const mapped = mapFMListToSupabase(fields)

        const { data: upsertedRecord, error } = await supabase
          .from('list_records')
          .upsert({
            tenant_id:          TENANT_ID,
            fm_record_id:       fmRecordId,
            fm_modification_id: fmModId,
            ...mapped,
          }, {
            onConflict: 'fm_record_id',
            ignoreDuplicates: false,
          })
          .select('id, webhook_lead_id')
          .single()

        if (error) {
          console.error(`list upsert error [${fmRecordId}]:`, error.message)
          totalErrors++
        } else {
          if (upsertedRecord?.webhook_lead_id) {
            await supabase
              .from('webhook_leads')
              .update({
                fm_record_id: fmRecordId,
                fm_synced_at: new Date().toISOString(),
              })
              .eq('id', upsertedRecord.webhook_lead_id)
              .is('fm_record_id', null)
          }
          totalSynced++
        }
      } catch (e) {
        console.error('list sync row error:', e)
        totalErrors++
      }
    }

    if (records.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  await fmLogout()
  console.log(`list sync: synced=${totalSynced} skipped=${totalSkipped} errors=${totalErrors}`)
  return { totalSynced, totalErrors, totalSkipped }
}

// ---- コール履歴同期 ----
export async function syncCalls(_sinceModified?: string) {
  const supabase = createAdminClient()
  const layout = process.env.FM_LAYOUT_CALLS!
  let offset = 1
  let totalSynced = 0
  let totalErrors = 0
  let totalSkipped = 0

  // 既存 modId を一括取得
  const modIdMap = await fetchModIdMap('calls', supabase)

  // list_records の customer_id → uuid を全件プリフェッチ（都度クエリ不要）
  const customerIdMap = new Map<string, string>()
  {
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
        if (r.customer_id) customerIdMap.set(r.customer_id, r.id)
      }
      if (data.length < 1000) break
      from += 1000
    }
    console.log(`customer_id マップ構築: ${customerIdMap.size}件`)
  }

  while (true) {
    const result = await fmGetRecords(layout, { _offset: offset, _limit: BATCH_SIZE })
    const records = result.response?.data ?? []
    if (records.length === 0) break

    for (const rec of records) {
      try {
        const fmRecordId = String(rec.recordId)
        const fmModId    = String((rec as unknown as { modId: string }).modId ?? '')

        // modId が同じなら変更なし → スキップ
        if (fmModId !== '' && modIdMap.get(fmRecordId) === fmModId) {
          totalSkipped++
          continue
        }

        const fields = rec.fieldData
        const mapped = mapFMCallToSupabase(fields)
        const customerId = mapped.fm_customer_id

        if (!customerId) {
          totalErrors++
          continue
        }

        const listRecordId = customerIdMap.get(customerId) ?? null
        if (!listRecordId) {
          // list_records に存在しない顧客IDはスキップ（エラーではない）
          totalSkipped++
          continue
        }

        const { fm_customer_id, ...callData } = mapped
        void fm_customer_id
        const { error } = await supabase
          .from('calls')
          .upsert({
            tenant_id:          TENANT_ID,
            list_record_id:     listRecordId,
            fm_record_id:       fmRecordId,
            fm_modification_id: fmModId,
            ...callData,
          }, {
            onConflict: 'fm_record_id',
            ignoreDuplicates: false,
          })

        if (error) {
          console.error(`call upsert error [${fmRecordId}]:`, error.message)
          totalErrors++
        } else {
          totalSynced++
        }
      } catch (e) {
        console.error('call sync row error:', e)
        totalErrors++
      }
    }

    if (records.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  await fmLogout()
  console.log(`calls sync: synced=${totalSynced} skipped=${totalSkipped} errors=${totalErrors}`)
  return { totalSynced, totalErrors, totalSkipped }
}
