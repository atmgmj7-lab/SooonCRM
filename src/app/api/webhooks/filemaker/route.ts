import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapFMListToSupabase, mapFMCallToSupabase } from '@/lib/filemaker/mappers'

export async function POST(request: Request) {
  // FM Webhook 認証チェック
  const secret = request.headers.get('x-fm-secret')
  if (process.env.FM_WEBHOOK_SECRET && secret !== process.env.FM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ループ防止: Web側からの更新がFMから反射してきた場合は無視
  if (body.update_source === 'WEB') {
    console.log('[fm-webhook] skipped (update_source=WEB)')
    return NextResponse.json({ skipped: true })
  }

  const fmRecordId  = body.fm_record_id  as string | undefined
  const fmFields    = body.fm_fields     as Record<string, unknown> | undefined
  const recordType  = (body.record_type  as string | undefined) ?? 'list_record'
  const tenantId    = process.env.DEFAULT_TENANT_ID

  if (!fmRecordId || !fmFields) {
    return NextResponse.json(
      { error: 'fm_record_id and fm_fields are required' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // --- コール履歴更新 ---
  if (recordType === 'call') {
    const mapped = mapFMCallToSupabase(fmFields)
    const { fm_customer_id, ...callData } = mapped

    // list_record_id を顧客IDで解決
    let listRecordId: string | null = null
    if (fm_customer_id && tenantId) {
      const { data: lr } = await supabase
        .from('list_records')
        .select('id')
        .eq('customer_id', fm_customer_id)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      listRecordId = lr?.id ?? null
    }

    const { error } = await supabase
      .from('calls')
      .upsert(
        {
          ...callData,
          fm_record_id:    fmRecordId,
          list_record_id:  listRecordId,
          tenant_id:       tenantId ?? null,
        },
        { onConflict: 'fm_record_id' }
      )

    if (error) {
      console.error('[fm-webhook] calls upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    // trg_call_to_list_record が自動で last_call_result / last_call_at を更新する
    return NextResponse.json({ ok: true })
  }

  // --- リスト情報更新（デフォルト） ---
  const mapped = mapFMListToSupabase(fmFields)

  const { data: existing } = await supabase
    .from('list_records')
    .select('id')
    .eq('fm_record_id', fmRecordId)
    .maybeSingle()

  if (!existing) {
    console.log('[fm-webhook] fm_record_id not found, skipping:', fmRecordId)
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await supabase
    .from('list_records')
    .update({ ...mapped, updated_at: new Date().toISOString() })
    .eq('id', existing.id)

  if (error) {
    console.error('[fm-webhook] supabase update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
