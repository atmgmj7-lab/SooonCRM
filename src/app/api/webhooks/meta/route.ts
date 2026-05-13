import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/utils/phone'
import { upsertListRecordToFM } from '@/lib/filemaker/pushToFM'

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

/** Meta Webhook（leadgen 等）から field_data 配列を取り出す */
function extractFieldDataFromMetaBody(body: Record<string, unknown>): FieldData[] {
  const entry = (body.entry as Array<Record<string, unknown>>)?.[0]
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0]
  const value = change?.value as Record<string, unknown> | undefined
  if (value?.field_data && Array.isArray(value.field_data)) {
    return value.field_data as FieldData[]
  }
  if (body.field_data && Array.isArray(body.field_data)) {
    return body.field_data as FieldData[]
  }
  return []
}

/** field_data を source_data.form_answers 用にフラット化 */
function extractFormAnswers(fieldData: FieldData[]): Record<string, string> {
  const answers: Record<string, string> = {}
  for (const field of fieldData) {
    if (field.name && field.values?.[0]) {
      answers[field.name] = field.values[0]
    }
  }
  return answers
}

function buildLeadSourceData(body: Record<string, unknown>): Record<string, unknown> {
  const formAnswers = extractFormAnswers(extractFieldDataFromMetaBody(body))
  return {
    ...body,
    form_answers: formAnswers,
  }
}

function extractLeadData(body: Record<string, unknown>): {
  phone: string
  ad_name: string
  company_name: string
  representative_name: string
  prefecture: string
  rep_title: string
  adset_id: string
  campaign_id: string
  campaign_name: string
} {
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
      rep_title:
        fields['job_title'] ??
        fields['work_job_title'] ??
        fields['役職'] ??
        fields['representative_title'] ??
        '',
      adset_id:            (value?.adset_id as string) ?? '',
      campaign_id:         (value?.campaign_id as string) ?? '',
      campaign_name:       (value?.campaign_name as string) ?? '',
    }
  }

  return {
    phone:               (body.phone_number as string) ?? (body.phone as string) ?? '',
    ad_name:             (body.ad_name as string) ?? (body.adName as string) ?? '',
    company_name:        (body.company_name as string) ?? '',
    representative_name: (body.representative_name as string) ?? '',
    prefecture:          (body.prefecture as string) ?? (body.county as string) ?? '',
    rep_title:           '',
    adset_id:            (value?.adset_id as string) ?? '',
    campaign_id:         (value?.campaign_id as string) ?? '',
    campaign_name:       (value?.campaign_name as string) ?? '',
  }
}

async function notifyFileMaker(record: Record<string, unknown>) {
  const phones = record.phone_numbers as string[] | string | null
  const phoneList = Array.isArray(phones) ? phones : phones ? [phones] : []

  const result = await upsertListRecordToFM({
    company_name:        (record.company_name as string | null) ?? null,
    representative_name: (record.representative_name as string | null) ?? null,
    prefecture:          (record.prefecture as string | null) ?? null,
    phone_numbers:       phoneList,
    ad_name:             (record.ad_name as string | null) ?? null,
    inquiry_at:
      (record.created_at as string | null) ??
      (record.inquiry_at as string | null) ??
      null,
    title:               (record.title as string | null) ?? null,
    newcomer_flag:       (record.newcomer_flag as string | null) ?? null,
    list_record_id:      record.id as string,
  })

  if (!result.ok || !result.fm_record_id) {
    console.error('[meta-webhook] FM upsert failed:', result.error)
    return
  }

  if (result.action === 'linked') {
    console.log('[meta-webhook] FM duplicate found, linking recordId:', result.fm_record_id)
  }
}

/** Meta Graph API から leadgen_id のフォーム回答を取得する（本番Webhookはfield_dataを含まないため必須） */
async function fetchLeadgenFromMeta(leadgenId: string): Promise<{
  fieldData: FieldData[]
  adName: string
  adsetId: string
  campaignId: string
  campaignName: string
  adId: string
}> {
  const empty: {
    fieldData: FieldData[]
    adName: string
    adsetId: string
    campaignId: string
    campaignName: string
    adId: string
  } = {
    fieldData: [],
    adName: '',
    adsetId: '',
    campaignId: '',
    campaignName: '',
    adId: '',
  }
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    console.error('[meta-webhook] META_ACCESS_TOKEN not set — cannot fetch leadgen data')
    return empty
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,ad_id,ad_name,adset_id,campaign_id,campaign_name&access_token=${token}`
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message: string } }
      console.error('[meta-webhook] Meta Graph API error:', err.error?.message ?? res.status)
      return empty
    }
    const data = await res.json() as {
      field_data?: FieldData[]
      ad_id?: string
      ad_name?: string
      adset_id?: string
      campaign_id?: string
      campaign_name?: string
    }
    return {
      fieldData: data.field_data ?? [],
      adName: data.ad_name ?? '',
      adsetId: data.adset_id ?? '',
      campaignId: data.campaign_id ?? '',
      campaignName: data.campaign_name ?? '',
      adId: data.ad_id ?? '',
    }
  } catch (e) {
    console.error('[meta-webhook] fetchLeadgenFromMeta failed:', e)
    return empty
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

  console.log('[meta-webhook] received:', JSON.stringify(body).slice(0, 500))

  if (!TENANT_ID) {
    return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })
  }

  const supabase = createAdminClient()

  // Meta本番Webhookはfield_dataを含まず leadgen_id のみ送る。
  // field_dataがない場合はGraph APIから取得してbodyに注入する。
  const entry  = (body.entry as Array<Record<string, unknown>>)?.[0]
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0]
  const value  = change?.value as Record<string, unknown> | undefined
  const leadgenId = value?.leadgen_id as string | undefined

  if (leadgenId && !value?.field_data) {
    console.log('[meta-webhook] no field_data in payload, fetching from Meta Graph API. leadgen_id:', leadgenId)
    const fetched = await fetchLeadgenFromMeta(leadgenId)
    if (fetched.fieldData.length > 0) {
      ;(value as Record<string, unknown>).field_data = fetched.fieldData
      console.log('[meta-webhook] field_data fetched:', JSON.stringify(fetched.fieldData))
    } else {
      console.warn('[meta-webhook] could not fetch field_data for leadgen_id:', leadgenId)
    }
    if (fetched.adName) {
      ;(value as Record<string, unknown>).ad_name = fetched.adName
    }
    if (fetched.adsetId) {
      ;(value as Record<string, unknown>).adset_id = fetched.adsetId
    }
    if (fetched.campaignId) {
      ;(value as Record<string, unknown>).campaign_id = fetched.campaignId
    }
    if (fetched.campaignName) {
      ;(value as Record<string, unknown>).campaign_name = fetched.campaignName
    }
  }

  // STEP1: webhook_leads に生データ保存（field_data注入後のbodyを保存）
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

  console.log('[meta-webhook] webhook_lead saved, id:', webhookLead.id, 'phone extracted:', leadData.phone)

  // STEP2: 電話番号正規化
  const phone = normalizePhoneNumber(leadData.phone)
  if (!phone) {
    console.warn('[meta-webhook] no phone number, stopping. leadgen_id:', leadgenId, 'raw phone:', leadData.phone)
    return NextResponse.json({ ok: true, note: 'no phone number', webhook_lead_id: webhookLead.id })
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
        company_name:        leadData.company_name || `【${leadData.ad_name || '広告'}からの問い合わせ】`,
        representative_name: leadData.representative_name || null,
        rep_title:           leadData.rep_title || null,
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
  // leadgen_id で既存リードをチェック（pull-meta-leads が先に取り込んだ場合の重複防止）
  if (leadgenId) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .contains('source_data', { meta_lead_id: leadgenId })
      .maybeSingle()
    if (existingLead) {
      await supabase
        .from('webhook_leads')
        .update({ match_status: 'matched', status: 'skipped_duplicate' })
        .eq('id', webhookLead.id)
      return NextResponse.json({ ok: true, note: 'lead already exists', customer_id: customerId })
    }
  }

  const now = new Date().toISOString()
  const inquiryDate = now.split('T')[0]
  const { error: leadError } = await supabase
    .from('leads')
    .insert({
      tenant_id:           TENANT_ID,
      customer_id:         customerId,
      list_record_id:      listRecordId,
      ad_name:             leadData.ad_name || null,
      inquiry_at:          now,
      inquiry_date:        inquiryDate,
      source:              'meta_ads',
      source_data:         {
        ...buildLeadSourceData(body),
        meta_lead_id: leadgenId ?? null,
      },
      status:              '未対応',
      webhook_lead_id:     webhookLead.id,
      company_name:        leadData.company_name || null,
      representative_name: leadData.representative_name || null,
      rep_title:           leadData.rep_title || null,
      adset_id:            leadData.adset_id || null,
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
