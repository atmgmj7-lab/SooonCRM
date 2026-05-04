import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/utils/phone'

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

// GET: Meta webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe') {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
    if (verifyToken && token === verifyToken) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }
  return new Response('OK')
}

type FieldData = { name: string; values: string[] }

function extractLeadData(body: Record<string, unknown>) {
  const entry  = (body.entry as Array<Record<string, unknown>>)?.[0]
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0]
  const value  = change?.value as Record<string, unknown> | undefined

  if (value?.field_data) {
    const fields: Record<string, string> = {}
    ;(value.field_data as FieldData[]).forEach((f) => {
      fields[f.name] = f.values?.[0] ?? ''
    })
    return {
      phone:               fields['phone_number'] ?? fields['phone'] ?? fields['電話番号'] ?? '',
      ad_name:             (value.ad_name as string) ?? fields['ad_name'] ?? '',
      company_name:        fields['company_name'] ?? fields['会社名'] ?? '',
      representative_name: fields['full_name'] ?? fields['代表名'] ?? '',
      prefecture:          fields['state'] ?? fields['県名'] ?? fields['都道府県'] ?? '',
    }
  }

  return {
    phone:               (body.phone_number as string) ?? (body.phone as string) ?? '',
    ad_name:             (body.ad_name as string) ?? (body.adName as string) ?? '',
    company_name:        (body.company_name as string) ?? '',
    representative_name: (body.representative_name as string) ?? '',
    prefecture:          (body.prefecture as string) ?? (body.county as string) ?? '',
  }
}

async function notifyFileMaker(record: Record<string, unknown>) {
  const { fmCreateRecord } = await import('@/lib/filemaker/client')
  const result = await fmCreateRecord({
    customer_id:   record.customer_id as string,
    company_name:  record.company_name as string,
    phone_numbers: record.phone_numbers as string,
    ad_name:       record.ad_name as string,
  })
  if (result?.recordId) {
    const supabase = createAdminClient()
    await supabase
      .from('list_records')
      .update({ fm_record_id: result.recordId })
      .eq('id', record.id as string)
  }
}

// POST: Receive leadgen events from Meta Ads
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!TENANT_ID) {
    return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })
  }

  const supabase = createAdminClient()

  // STEP1: webhook_leads に生データ保存
  const leadData = extractLeadData(body)
  const { data: webhookLead, error: wlError } = await supabase
    .from('webhook_leads')
    .insert({
      tenant_id: TENANT_ID,
      raw_data:  body,
      source:    'meta_ads',
      ad_name:   leadData.ad_name || null,
      status:    'pending',
    })
    .select()
    .single()

  if (wlError) {
    console.error('[meta-webhook] webhook_leads error:', JSON.stringify(wlError))
    return NextResponse.json({ error: wlError.message }, { status: 500 })
  }

  // STEP2: 電話番号正規化
  const phone = normalizePhoneNumber(leadData.phone)
  if (!phone) {
    return NextResponse.json({ ok: true, note: 'no phone number' })
  }

  // STEP3: 名寄せ（既存顧客検索）
  const { data: matched, error: matchError } = await supabase
    .from('list_records')
    .select('id, customer_id')
    .contains('phone_numbers', JSON.stringify([phone]))
    .eq('tenant_id', TENANT_ID)
    .maybeSingle()

  if (matchError) {
    console.error('[meta-webhook] match error:', JSON.stringify(matchError))
    return NextResponse.json({ error: matchError.message }, { status: 500 })
  }

  let listRecordId: string
  let customerId: string

  if (matched) {
    // 既存顧客
    listRecordId = matched.id
    customerId   = matched.customer_id ?? ''

    await supabase
      .from('webhook_leads')
      .update({ match_status: 'matched' })
      .eq('id', webhookLead.id)
  } else {
    // STEP3b: 新規顧客: CS番号採番
    const { data: newCustomerId, error: idError } = await supabase
      .rpc('generate_customer_id', { p_tenant_id: TENANT_ID })

    if (idError) {
      console.error('[meta-webhook] generate_customer_id error:', JSON.stringify(idError))
      return NextResponse.json({ error: idError.message }, { status: 500 })
    }

    customerId = newCustomerId as string

    // STEP3c: list_records INSERT
    const { data: newRecord, error: lrError } = await supabase
      .from('list_records')
      .insert({
        tenant_id:           TENANT_ID,
        customer_id:         customerId,
        phone_numbers:       [phone],
        ad_name:             leadData.ad_name || null,
        company_name:        leadData.company_name || null,
        representative_name: leadData.representative_name || null,
        prefecture:          leadData.prefecture || null,
        source:              'meta_ads',
        webhook_lead_id:     webhookLead.id,
      })
      .select()
      .single()

    if (lrError) {
      console.error('[meta-webhook] list_records error:', JSON.stringify(lrError))
      return NextResponse.json({ error: lrError.message }, { status: 500 })
    }

    listRecordId = newRecord.id

    await supabase
      .from('webhook_leads')
      .update({ match_status: 'new_record' })
      .eq('id', webhookLead.id)

    // FM通知（非同期・失敗許容）
    notifyFileMaker(newRecord as Record<string, unknown>).catch((err) =>
      console.error('[meta-webhook] FM notify failed (non-blocking):', JSON.stringify(err))
    )
  }

  // STEP4: leads に INSERT（list_record_id と customer_id を必ずセット）
  const now = new Date().toISOString()
  const { error: leadError } = await supabase
    .from('leads')
    .insert({
      tenant_id:           TENANT_ID,
      customer_id:         customerId,
      list_record_id:      listRecordId,
      ad_name:             leadData.ad_name || null,
      inquiry_at:          now,
      source:              'meta_ads',
      source_data:         body,
      status:              '未対応',
      webhook_lead_id:     webhookLead.id,
      company_name:        leadData.company_name || null,
      representative_name: leadData.representative_name || null,
      phone_number:        phone,
      prefecture:          leadData.prefecture || null,
    })

  if (leadError) {
    console.error('[meta-webhook] leads error:', JSON.stringify(leadError))
    return NextResponse.json({ error: leadError.message }, { status: 500 })
  }

  // 5. webhook_leads を added に更新
  await supabase
    .from('webhook_leads')
    .update({
      status:           'added',
      added_to_list_id: listRecordId,
      added_at:         now,
    })
    .eq('id', webhookLead.id)

  return NextResponse.json({ ok: true, customer_id: customerId })
}
