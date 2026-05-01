import { createAdminClient } from '@/lib/supabase/admin'
import { fmGetRecords, fmLogout } from './client'
import { mapFMListToSupabase, mapFMCallToSupabase } from './mappers'

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
const BATCH_SIZE = 100

// ---- リスト情報同期 ----
export async function syncListRecords(sinceModified?: string) {
  const supabase = createAdminClient()
  const layout = process.env.FM_LAYOUT_LIST!
  let offset = 1
  let totalSynced = 0
  let totalErrors = 0

  while (true) {
    const result = await fmGetRecords(layout, {
      _offset: offset,
      _limit: BATCH_SIZE,
      _sort: [{ fieldName: '修正タイムスタンプ', sortOrder: 'ascend' }],
    })

    const records = result.response?.data ?? []
    if (records.length === 0) break

    for (const rec of records) {
      try {
        const fmRecordId = String(rec.recordId)
        const fields = rec.fieldData

        if (sinceModified && fields['修正タイムスタンプ']) {
          if (String(fields['修正タイムスタンプ']) <= sinceModified) continue
        }

        const mapped = mapFMListToSupabase(fields)

        const { error } = await supabase
          .from('list_records')
          .upsert({
            tenant_id: TENANT_ID,
            fm_record_id: fmRecordId,
            fm_modification_id: String(fields['修正タイムスタンプ'] ?? ''),
            ...mapped,
          }, {
            onConflict: 'fm_record_id',
            ignoreDuplicates: false,
          })

        if (error) {
          console.error(`list upsert error [${fmRecordId}]:`, error.message)
          totalErrors++
        } else {
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
  return { totalSynced, totalErrors }
}

// ---- コール履歴同期 ----
export async function syncCalls(sinceModified?: string) {
  const supabase = createAdminClient()
  const layout = process.env.FM_LAYOUT_CALLS!
  let offset = 1
  let totalSynced = 0
  let totalErrors = 0

  const customerIdCache = new Map<string, string>()

  const getListRecordId = async (customerId: string): Promise<string | null> => {
    if (customerIdCache.has(customerId)) return customerIdCache.get(customerId)!

    const { data } = await supabase
      .from('list_records')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('customer_id', customerId)
      .single()

    if (data?.id) {
      customerIdCache.set(customerId, data.id)
      return data.id
    }
    return null
  }

  while (true) {
    const result = await fmGetRecords(layout, {
      _offset: offset,
      _limit: BATCH_SIZE,
      _sort: [{ fieldName: '修正タイムスタンプ', sortOrder: 'ascend' }],
    })

    const records = result.response?.data ?? []
    if (records.length === 0) break

    for (const rec of records) {
      try {
        const fmRecordId = String(rec.recordId)
        const fields = rec.fieldData

        if (sinceModified && fields['修正タイムスタンプ']) {
          if (String(fields['修正タイムスタンプ']) <= sinceModified) continue
        }

        const mapped = mapFMCallToSupabase(fields)
        const customerId = mapped.fm_customer_id

        if (!customerId) {
          totalErrors++
          continue
        }

        const listRecordId = await getListRecordId(customerId)
        if (!listRecordId) {
          console.warn(`No list_record for customer_id: ${customerId}`)
          totalErrors++
          continue
        }

        const { fm_customer_id, ...callData } = mapped
        void fm_customer_id
        const { error } = await supabase
          .from('calls')
          .upsert({
            tenant_id: TENANT_ID,
            list_record_id: listRecordId,
            fm_record_id: fmRecordId,
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
  return { totalSynced, totalErrors }
}
