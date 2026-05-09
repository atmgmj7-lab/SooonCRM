/**
 * 選択した webhook_leads を leads + FM に登録する
 * POST: { ids: string[] } → 各 webhook_lead を処理して FM 送信
 */
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmCreateRecord, fmFindByPhone } from '@/lib/filemaker/client'
import { normalizePhoneNumber } from '@/lib/utils/phone'

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { ids: string[] }
  const { ids } = body
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids が空です' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // webhook_leads を取得
  const { data: webhookLeads, error: wlErr } = await supabase
    .from('webhook_leads')
    .select('id, raw_data, ad_name, source, status, added_to_list_id, match_status')
    .in('id', ids)
    .eq('tenant_id', TENANT_ID)

  if (wlErr) return NextResponse.json({ error: wlErr.message }, { status: 500 })
  if (!webhookLeads?.length) return NextResponse.json({ error: 'webhook_leads が見つかりません' }, { status: 404 })

  let created = 0   // list_records + leads 新規作成
  let fm_created = 0  // FM 新規登録
  let fm_linked  = 0  // FM 既存リンク
  let failed     = 0
  const errors: string[] = []

  for (const wl of webhookLeads) {
    try {
      const raw = (wl.raw_data ?? {}) as Record<string, unknown>

      // 電話番号取得（field_data 形式 or フラット形式）
      let rawPhone = ''
      const fieldData = raw.field_data as Array<{ name: string; values: string[] }> | undefined
      if (fieldData) {
        const phoneField = fieldData.find(f =>
          ['phone_number', 'phone', '電話番号'].includes(f.name)
        )
        rawPhone = phoneField?.values?.[0] ?? ''
      } else {
        rawPhone = String(raw.phone_number ?? raw.phone ?? '')
      }
      const phone = normalizePhoneNumber(rawPhone)

      // FM 重複チェック → 新規 or リンク
      let fmRecordId: string | null = null

      // 既に added_to_list_id がある場合（自動処理済み）→ FM だけ再送
      if (wl.added_to_list_id) {
        const { data: lr } = await supabase
          .from('list_records')
          .select('id, customer_id, ad_name, company_name, representative_name, prefecture, phone_numbers, fm_record_id')
          .eq('id', wl.added_to_list_id)
          .single()

        if (lr) {
          if (lr.fm_record_id) {
            // 既に FM 登録済み → スキップ
            fm_linked++
            continue
          }
          // FM 未登録 → 今から送信
          const phones = lr.phone_numbers as string[] | null
          const ph = phones?.[0] ?? phone ?? ''
          const existing = ph ? await fmFindByPhone(ph) : null

          if (existing) {
            fmRecordId = existing.recordId
            fm_linked++
          } else {
            const result = await fmCreateRecord({
              '顧客ID':       lr.customer_id  ?? '',
              'ADNAME':      lr.ad_name       ?? wl.ad_name ?? '',
              '会社名':      lr.company_name  ?? '',
              '代表名':      lr.representative_name ?? '',
              '都道府県':    lr.prefecture    ?? '',
              '電話番号':    ph,
              'インバウンド': '1',
            })
            fmRecordId = result?.recordId ?? null
            if (fmRecordId) fm_created++
          }

          if (fmRecordId) {
            await supabase
              .from('list_records')
              .update({ fm_record_id: fmRecordId })
              .eq('id', lr.id)
          }
        }
      } else {
        // 未処理の webhook_lead → list_records + leads + FM を新規作成
        if (!phone) { failed++; errors.push(`${wl.id}: 電話番号なし`); continue }

        // 重複チェック
        const { data: existingLR } = await supabase
          .from('list_records')
          .select('id, customer_id')
          .contains('phone_numbers', JSON.stringify([phone]))
          .eq('tenant_id', TENANT_ID)
          .maybeSingle()

        let listRecordId: string
        let customerId: string

        if (existingLR) {
          listRecordId = existingLR.id
          customerId   = existingLR.customer_id ?? ''
        } else {
          const { data: newId } = await supabase
            .rpc('generate_customer_id', { p_tenant_id: TENANT_ID })
          customerId = newId as string

          // FM チェック
          const fmEx = phone ? await fmFindByPhone(phone) : null
          if (fmEx) {
            fmRecordId = fmEx.recordId; fm_linked++
          } else {
            const companyName = String(
              (fieldData?.find(f => f.name === 'company_name')?.values?.[0] ?? raw.company_name) || ''
            ) || `【${wl.ad_name || '広告'}からの問い合わせ】`

            const fmRes = await fmCreateRecord({
              '顧客ID':       customerId,
              'ADNAME':      wl.ad_name ?? '',
              '会社名':      companyName,
              '都道府県':    String(fieldData?.find(f => f.name === 'state')?.values?.[0] ?? raw.prefecture ?? ''),
              '電話番号':    phone,
              'インバウンド': '1',
            }).catch(() => null)
            fmRecordId = fmRes?.recordId ?? null
            if (fmRecordId) fm_created++
          }

          const companyName = String(
            (fieldData?.find(f => f.name === 'company_name')?.values?.[0] ?? raw.company_name) || ''
          ) || `【${wl.ad_name || '広告'}からの問い合わせ】`

          const { data: newLR } = await supabase
            .from('list_records')
            .insert({
              tenant_id:    TENANT_ID,
              customer_id:  customerId,
              phone_numbers: [phone],
              ad_name:      wl.ad_name ?? null,
              company_name: companyName,
              source:       wl.source ?? 'meta_ads',
              fm_record_id: fmRecordId,
            })
            .select()
            .single()

          listRecordId = newLR?.id ?? ''
          created++
        }

        // leads に INSERT
        if (listRecordId) {
          await supabase.from('leads').insert({
            tenant_id:      TENANT_ID,
            customer_id:    customerId,
            list_record_id: listRecordId,
            ad_name:        wl.ad_name ?? null,
            inquiry_at:     new Date().toISOString(),
            source:         wl.source ?? 'meta_ads',
            status:         '未対応',
            phone_number:   phone,
          })

          await supabase
            .from('webhook_leads')
            .update({ status: 'added', added_to_list_id: listRecordId, added_at: new Date().toISOString() })
            .eq('id', wl.id)
        }
      }
    } catch (e) {
      failed++
      errors.push(`${wl.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, created, fm_created, fm_linked, failed, errors: errors.slice(0, 10) })
}
