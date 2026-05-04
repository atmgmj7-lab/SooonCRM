import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/utils/phone'

type SupabaseClient = ReturnType<typeof createAdminClient>

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? ''

async function addOneToList(
  supabase: SupabaseClient,
  webhookLead: Record<string, unknown>
): Promise<string> {
  const raw        = (webhookLead.raw_data ?? {}) as Record<string, unknown>
  const mappedData = (webhookLead.mapped_data ?? {}) as Record<string, unknown>

  // 電話番号正規化
  const rawPhone        = raw.phone_number ?? raw.phone ?? mappedData.phone_number ?? ''
  const normalizedPhone = normalizePhoneNumber(String(rawPhone))
  const phoneNumbers    = normalizedPhone ? [normalizedPhone] : []

  // 既存 list_records を電話番号で名寄せ
  const { data: existingRecord } = normalizedPhone
    ? await supabase
        .from('list_records')
        .select('id, customer_id')
        .contains('phone_numbers', JSON.stringify([normalizedPhone]))
        .eq('tenant_id', TENANT_ID)
        .maybeSingle()
    : { data: null }

  let listRecordId: string
  let customerId: string

  if (existingRecord) {
    listRecordId = existingRecord.id
    customerId   = existingRecord.customer_id ?? ''
  } else {
    // CS番号採番して新規 list_records を作成
    const { data: newCustomerId, error: idError } = await supabase
      .rpc('generate_customer_id', { p_tenant_id: TENANT_ID })
    if (idError) throw new Error(idError.message)
    customerId = newCustomerId as string

    const { data: listRecord, error: insertErr } = await supabase
      .from('list_records')
      .insert({
        tenant_id:           TENANT_ID,
        customer_id:         customerId,
        ad_name:             (webhookLead.ad_name ?? raw.ad_name ?? null) as string | null,
        company_name:        (mappedData.company_name ?? raw.company_name ?? null) as string | null,
        representative_name: (mappedData.representative_name ?? raw.representative_name ?? null) as string | null,
        prefecture:          (mappedData.prefecture ?? raw.prefecture ?? null) as string | null,
        phone_numbers:       phoneNumbers,
        source:              'meta_ads',
        webhook_lead_id:     webhookLead.id as string,
      })
      .select('id')
      .single()

    if (insertErr || !listRecord) {
      throw new Error(insertErr?.message ?? 'list_records insert failed')
    }
    listRecordId = listRecord.id
  }

  // leads にも INSERT（問い合わせ履歴として記録）
  const now = new Date().toISOString()
  const { error: leadError } = await supabase
    .from('leads')
    .insert({
      tenant_id:           TENANT_ID,
      customer_id:         customerId,
      list_record_id:      listRecordId,
      ad_name:             (webhookLead.ad_name ?? null) as string | null,
      inquiry_at:          (webhookLead.received_at as string) ?? now,
      source:              (webhookLead.source as string) ?? 'meta_ads',
      source_data:         (webhookLead.raw_data ?? {}) as Record<string, unknown>,
      status:              '未対応',
      webhook_lead_id:     webhookLead.id as string,
      company_name:        (mappedData.company_name ?? null) as string | null,
      representative_name: (mappedData.representative_name ?? null) as string | null,
      phone_number:        normalizedPhone || null,
      prefecture:          (mappedData.prefecture ?? null) as string | null,
    })

  if (leadError) {
    console.error('[add-to-list] leads insert error:', JSON.stringify(leadError))
    // leads INSERT 失敗でも list_records は作成済みなので処理継続
  } else {
    console.log('[add-to-list] leads INSERT 成功: customer_id=', customerId)
  }

  await supabase
    .from('webhook_leads')
    .update({
      status:           'added',
      match_status:     existingRecord ? 'matched' : 'new_record',
      added_to_list_id: listRecordId,
      added_at:         now,
    })
    .eq('id', webhookLead.id as string)

  return listRecordId
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!TENANT_ID) return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })

  const body = await request.json() as { id?: string; bulk?: boolean }
  const supabase = createAdminClient()

  if (body.bulk) {
    const { data: pending, error: fetchErr } = await supabase
      .from('webhook_leads')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'pending')

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const results = await Promise.allSettled(
      (pending ?? []).map((lead) => addOneToList(supabase, lead as Record<string, unknown>))
    )
    const added = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    return NextResponse.json({ added, failed })
  }

  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: lead, error: fetchErr } = await supabase
    .from('webhook_leads')
    .select('*')
    .eq('id', body.id)
    .eq('tenant_id', TENANT_ID)
    .single()

  if (fetchErr || !lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const listId = await addOneToList(supabase, lead as Record<string, unknown>)
    return NextResponse.json({ list_record_id: listId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
