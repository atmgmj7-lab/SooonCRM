import { createAdminClient } from '@/lib/supabase/admin'

const TENANT_ID = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'

// 電話番号を正規化（数字のみ・先頭の81/+81を0に変換）
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '')
  if (normalized.startsWith('81')) normalized = '0' + normalized.slice(2)
  return normalized
}

// webhook_leadのphone_numberでlist_recordsを照合
export async function matchOrCreateListRecord(webhookLeadId: string) {
  const supabase = createAdminClient()

  const { data: lead } = await supabase
    .from('webhook_leads')
    .select('*')
    .eq('id', webhookLeadId)
    .single()

  if (!lead) throw new Error('webhook_lead not found')

  const rawData = (lead.raw_data ?? {}) as Record<string, unknown>
  const rawPhone = rawData.phone_number ?? rawData['電話番号'] ?? ''
  const normalized = normalizePhone(String(rawPhone))

  if (!normalized) {
    return { matched: false, listRecordId: null }
  }

  // list_records.phone_numbers (jsonb配列) 内で照合
  const { data: existing } = await supabase
    .from('list_records')
    .select('id, phone_numbers')
    .eq('tenant_id', TENANT_ID)
    .contains('phone_numbers', JSON.stringify([normalized]))
    .limit(1)
    .single()

  if (existing) {
    await supabase
      .from('list_records')
      .update({
        webhook_lead_id: webhookLeadId,
        source: 'meta_ads',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    await supabase
      .from('webhook_leads')
      .update({
        status: 'added',
        added_to_list_id: existing.id,
        added_at: new Date().toISOString(),
      })
      .eq('id', webhookLeadId)

    return { matched: true, listRecordId: existing.id }
  }

  return { matched: false, listRecordId: null }
}

// 手動承認: webhook_leadをlist_recordsに昇格
export async function promoteWebhookLead(webhookLeadId: string, addedBy: string) {
  const supabase = createAdminClient()
  const { data: lead } = await supabase
    .from('webhook_leads')
    .select('*')
    .eq('id', webhookLeadId)
    .single()

  if (!lead || lead.status !== 'pending') throw new Error('Lead not found or already processed')

  const raw = (lead.raw_data ?? {}) as Record<string, unknown>
  const mapped = (lead.mapped_data ?? {}) as Record<string, unknown>
  const rawPhone = String(raw.phone_number ?? '')
  const normalized = normalizePhone(rawPhone)

  const { data: newRecord, error } = await supabase
    .from('list_records')
    .insert({
      tenant_id: TENANT_ID,
      source: 'meta_ads',
      ad_name: lead.ad_name ?? raw.広告名,
      company_name: mapped.company_name ?? raw.会社名,
      representative_name: mapped.representative_name ?? raw.代表名,
      title: mapped.title ?? raw.役職,
      prefecture: mapped.prefecture ?? raw.県名,
      phone_numbers: normalized ? [normalized] : [],
      webhook_lead_id: webhookLeadId,
      source_data: raw,
    })
    .select('id')
    .single()

  if (error || !newRecord) throw new Error(`Failed to create list_record: ${error?.message}`)

  await supabase
    .from('webhook_leads')
    .update({
      status: 'added',
      added_to_list_id: newRecord.id,
      added_at: new Date().toISOString(),
      added_by: addedBy,
    })
    .eq('id', webhookLeadId)

  return { listRecordId: newRecord.id }
}
