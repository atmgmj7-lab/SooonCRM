/**
 * Meta Graph API からリードフォームの回答を能動的に取得する
 * - GET  : フォーム一覧と各フォームのリード件数を返す（事前確認用）
 * - POST : 指定期間のリードを取得して Sooon-CRM に登録
 *
 * Meta Webhook が届かなかった期間のバックフィルや定期バックアップに使う
 */
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/utils/phone'
import { fmCreateRecord, fmFindByPhone } from '@/lib/filemaker/client'

const TENANT_ID    = process.env.DEFAULT_TENANT_ID!
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!
const ACCOUNT_ID   = process.env.META_AD_ACCOUNT_ID!
const PAGE_ID      = process.env.META_FB_PAGE_ID ?? ''
// META_FORM_IDS にカンマ区切りでフォームIDを設定すると、フォーム一覧API（pages_manage_ads 権限必須）をスキップして直接リード取得できる
const ENV_FORM_IDS = process.env.META_FORM_IDS ? process.env.META_FORM_IDS.split(',').map(s => s.trim()).filter(Boolean) : []
const META_BASE    = 'https://graph.facebook.com/v19.0'

// ---- Meta API ヘルパー ----

interface MetaLeadField { name: string; values: string[] }

interface MetaLeadRow {
  id: string
  created_time: string
  ad_id?: string
  ad_name?: string
  adset_id?: string
  campaign_id?: string
  campaign_name?: string
  form_id?: string
  field_data: MetaLeadField[]
}

interface MetaForm { id: string; name: string; leads_count?: number }

async function getLeadForms(): Promise<MetaForm[]> {
  // leadgen_forms は Page エンドポイント配下。META_FB_PAGE_ID が必要
  if (!PAGE_ID) {
    throw new Error('META_FB_PAGE_ID が設定されていません。Facebook ページIDを .env.local に追加してください。')
  }
  const url = new URL(`${META_BASE}/${PAGE_ID}/leadgen_forms`)
  url.searchParams.set('access_token', ACCESS_TOKEN)
  url.searchParams.set('fields', 'id,name,leads_count')
  url.searchParams.set('limit', '100')

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta forms error ${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json() as { data?: MetaForm[] }
  return data.data ?? []
}

async function getLeadsFromForm(
  formId: string,
  since?: string,   // ISO date string e.g. "2026-04-28"
  until?: string
): Promise<MetaLeadRow[]> {
  const out: MetaLeadRow[] = []
  let url: string | null = (() => {
    const u = new URL(`${META_BASE}/${formId}/leads`)
    u.searchParams.set('access_token', ACCESS_TOKEN)
    u.searchParams.set('fields', 'id,created_time,ad_id,ad_name,adset_id,campaign_id,campaign_name,field_data')
    u.searchParams.set('limit', '100')
    if (since) u.searchParams.set('filtering', JSON.stringify([
      { field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(new Date(since).getTime() / 1000) }
    ]))
    return u.toString()
  })()

  while (url) {
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message: string } }
      throw new Error(`Meta leads error: ${err.error?.message ?? res.status}`)
    }
    const data = await res.json() as { data?: MetaLeadRow[]; paging?: { next?: string } }
    const rows = data.data ?? []

    // until フィルター（Meta API は GT のみなので JS 側でフィルター）
    for (const row of rows) {
      if (until && row.created_time > until + 'T23:59:59') continue
      out.push({ ...row, form_id: formId })
    }

    url = data.paging?.next ?? null
    // 全件取得不要なら since より古いページが来たら停止
    if (rows.length === 0) break
  }

  return out
}

function extractLeadFields(fieldData: MetaLeadField[]) {
  const f: Record<string, string> = {}
  for (const field of fieldData) {
    if (field.name && field.values?.[0]) f[field.name] = field.values[0]
  }
  return {
    phone:               f['phone_number'] ?? f['phone'] ?? f['電話番号'] ?? '',
    company_name:        f['company_name'] ?? f['会社名'] ?? '',
    representative_name: f['full_name'] ?? f['代表名'] ?? '',
    prefecture:          f['state'] ?? f['県名'] ?? f['都道府県'] ?? '',
    rep_title:           f['job_title'] ?? f['work_job_title'] ?? f['役職'] ?? '',
  }
}

// ---- API ハンドラー ----

// GET: フォーム一覧を返す（事前確認用）
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const forms = await getLeadForms()
    return NextResponse.json({ forms })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST: 指定期間のリードを取得して登録
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { since?: string; until?: string; form_ids?: string[] }
  const { since, until, form_ids } = body

  // フォーム一覧取得
  // 優先順位: 1) リクエストbodyの form_ids  2) 環境変数 META_FORM_IDS  3) Page API（pages_manage_ads 権限が必要）
  let forms: MetaForm[]
  try {
    if (form_ids && form_ids.length > 0) {
      forms = form_ids.map(id => ({ id, name: id }))
    } else if (ENV_FORM_IDS.length > 0) {
      forms = ENV_FORM_IDS.map(id => ({ id, name: id }))
    } else {
      forms = await getLeadForms()
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  const supabase = createAdminClient()
  let totalFound    = 0
  let totalImported = 0
  let totalSkipped  = 0
  let totalFailed   = 0
  const errors: string[] = []

  for (const form of forms) {
    let leads: MetaLeadRow[]
    try {
      leads = await getLeadsFromForm(form.id, since, until)
    } catch (e) {
      errors.push(`form ${form.id}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    totalFound += leads.length

    for (const lead of leads) {
      try {
        const extracted = extractLeadFields(lead.field_data)
        const phone = normalizePhoneNumber(extracted.phone)
        if (!phone) { totalSkipped++; continue }

        // 重複チェック①: list_records.phone_numbers（webhook/FM同期で入ったデータ）
        const { data: existingLR } = await supabase
          .from('list_records')
          .select('id, customer_id')
          .contains('phone_numbers', JSON.stringify([phone]))
          .eq('tenant_id', TENANT_ID)
          .maybeSingle()

        // 重複チェック②: leads.phone_number（スプレッドシートCSV等で直接入れたデータ）
        const { data: existingLeadByPhone } = !existingLR ? await supabase
          .from('leads')
          .select('id, list_record_id, customer_id')
          .eq('phone_number', phone)
          .eq('tenant_id', TENANT_ID)
          .not('list_record_id', 'is', null)
          .maybeSingle() : { data: null }

        const existing = existingLR ?? (existingLeadByPhone?.list_record_id ? {
          id: existingLeadByPhone.list_record_id,
          customer_id: existingLeadByPhone.customer_id,
        } : null)

        let listRecordId: string
        let customerId: string

        if (existing) {
          // 既存顧客: leads のみ追加（list_record は更新しない）
          listRecordId = existing.id
          customerId   = existing.customer_id ?? ''
          totalSkipped++  // list_record は重複スキップ
        } else {
          // 新規顧客: CS番号採番 + list_records 作成
          const { data: newId, error: idErr } = await supabase
            .rpc('generate_customer_id', { p_tenant_id: TENANT_ID })
          if (idErr) throw new Error(idErr.message)
          customerId = newId as string

          const adName = lead.ad_name ?? ''
          const companyName = extracted.company_name
            || `【${adName || '広告'}からの問い合わせ】`

          // FM 重複チェック
          const fmExisting = await fmFindByPhone(phone)
          let fmRecordId: string | null = null

          if (fmExisting) {
            fmRecordId = fmExisting.recordId
          } else {
            const fmResult = await fmCreateRecord({
              '顧客ID':       customerId,
              'ADNAME':      adName,
              '会社名':      companyName,
              '代表名':      extracted.representative_name,
              '都道府県':    extracted.prefecture,
              '電話番号':    phone,
              'インバウンド': '1',
            }).catch(() => null)
            fmRecordId = fmResult?.recordId ?? null
          }

          const { data: newRecord, error: lrErr } = await supabase
            .from('list_records')
            .insert({
              tenant_id:           TENANT_ID,
              customer_id:         customerId,
              phone_numbers:       [phone],
              ad_name:             adName || null,
              company_name:        companyName,
              representative_name: extracted.representative_name || null,
              prefecture:          extracted.prefecture || null,
              source:              'meta_ads',
              fm_record_id:        fmRecordId,
            })
            .select()
            .single()
          if (lrErr) throw new Error(lrErr.message)
          listRecordId = newRecord.id
        }

        // leads: meta_lead_id があれば同一、なければ webhook 先行行（webhook_lead_id あり）を UPSERT 相当でマージ
        const inquiryAt = new Date(lead.created_time).toISOString()
        const metaInquiryDate = inquiryAt.split('T')[0]

        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('tenant_id', TENANT_ID)
          .contains('source_data', { meta_lead_id: lead.id })
          .maybeSingle()

        if (existingLead) {
          totalSkipped++
        } else {
          const { data: webhookDup, error: webhookDupErr } = await supabase
            .from('leads')
            .select('id, source_data')
            .eq('tenant_id', TENANT_ID)
            .eq('list_record_id', listRecordId)
            .eq('source', 'meta_ads')
            .not('webhook_lead_id', 'is', null)
            .limit(1)
            .maybeSingle()

          if (webhookDupErr) throw new Error(webhookDupErr.message)

          if (webhookDup) {
            const prev = webhookDup.source_data
            const updatedSourceData = {
              ...(typeof prev === 'object' && prev !== null ? (prev as Record<string, unknown>) : {}),
              meta_lead_id: lead.id,
              meta_ad_id: lead.ad_id ?? null,
              meta_adset_id: lead.adset_id ?? null,
              meta_campaign_id: lead.campaign_id ?? null,
              campaign_name: lead.campaign_name ?? null,
            }
            const { error: updErr } = await supabase
              .from('leads')
              .update({
                source_data: updatedSourceData,
                inquiry_date: metaInquiryDate,
                ad_name: lead.ad_name ?? null,
                rep_title: extracted.rep_title || null,
              })
              .eq('id', webhookDup.id)
              .eq('tenant_id', TENANT_ID)
            if (updErr) throw new Error(updErr.message)
            totalSkipped++
          } else {
            const { error: leadErr } = await supabase.from('leads').insert({
              tenant_id:           TENANT_ID,
              customer_id:         customerId,
              list_record_id:      listRecordId,
              ad_name:             lead.ad_name ?? null,
              inquiry_at:          inquiryAt,
              inquiry_date:        metaInquiryDate,
              source:              'meta_ads',
              source_data:         {
                field_data:       lead.field_data,
                meta_lead_id:     lead.id,
                meta_ad_id:       lead.ad_id ?? null,
                meta_adset_id:    lead.adset_id ?? null,
                meta_campaign_id: lead.campaign_id ?? null,
                campaign_name:    lead.campaign_name ?? null,
              },
              status:              '未対応',
              company_name:        extracted.company_name || null,
              representative_name: extracted.representative_name || null,
              rep_title:           extracted.rep_title || null,
              phone_number:        phone,
              prefecture:          extracted.prefecture || null,
            })
            if (leadErr) throw new Error(leadErr.message)
            totalImported++
          }
        }
      } catch (e) {
        totalFailed++
        errors.push(`lead ${lead.id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    forms_checked:     forms.length,
    leads_found:       totalFound,
    imported:          totalImported,
    skipped_duplicate: totalSkipped,
    failed:            totalFailed,
    errors:            errors.slice(0, 10),
  })
}
