import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import type { Json } from '@/types/supabase'
import { mapFMListToSupabase, mapFMCallToSupabase } from '@/lib/filemaker/mappers'
import { mergeFmCallExtrasIntoCustomData } from '@/lib/filemaker/webhookNormalize'

const TENANT_ID = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('x-fm-secret')
  if (!process.env.FM_WEBHOOK_SECRET || authHeader !== process.env.FM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    event  = 'record_updated',
    layout = '',
    recordId,
    data: fmData = {},
  } = body as {
    event?: string
    layout?: string
    recordId?: string
    data?: Record<string, unknown>
    // Legacy fields
    action?: string
    record?: Record<string, unknown>
  }

  // Legacy format compatibility
  const legacyRecord = body.record as Record<string, unknown> | undefined
  const legacyAction = body.action as string | undefined
  if (legacyRecord && !recordId) {
    return handleLegacyLeadWebhook(body, legacyAction, legacyRecord)
  }

  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Route by layout
  const layoutLower = layout.toLowerCase()

  // ── List records layout ──────────────────────────────────────
  if (layoutLower.includes('list') || layoutLower.includes('リスト')) {
    const mapped = mapFMListToSupabase({ ...fmData, ...{ fm_record_id: recordId } })

    if (event === 'record_deleted') {
      const { error } = await supabase
        .from('list_records')
        .update({ deleted_at: new Date().toISOString() })
        .eq('tenant_id', TENANT_ID)
        .eq('fm_record_id', recordId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, action: 'deleted', table: 'list_records' })
    }

    const { data, error } = await supabase
      .from('list_records')
      .upsert(
        { ...mapped, tenant_id: TENANT_ID, fm_record_id: recordId, updated_at: new Date().toISOString() },
        { onConflict: 'fm_record_id' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('[FM webhook] list_records upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action: 'upserted', table: 'list_records', id: data.id })
  }

  // ── Calls layout ─────────────────────────────────────────────
  if (layoutLower.includes('call') || layoutLower.includes('コール') || layoutLower.includes('対応')) {
    const mapped = mapFMCallToSupabase({ ...fmData, ...{ fm_record_id: recordId } })
    const customerId = mapped.fm_customer_id

    let customDataOverride: Json | undefined
    const { fm_customer_id: _c, fm_webhook_extras, ...callColumns } = mapped
    void _c

    if (Object.keys(fm_webhook_extras).length > 0) {
      const { data: prevRow } = await supabase
        .from('calls')
        .select('custom_data')
        .eq('fm_record_id', recordId)
        .maybeSingle()

      customDataOverride = mergeFmCallExtrasIntoCustomData(prevRow?.custom_data, fm_webhook_extras)
    }

    // Resolve list_record_id from customer_id
    let listRecordId: string | null = null
    if (customerId) {
      const { data: lr } = await supabase
        .from('list_records')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .eq('customer_id', customerId)
        .limit(1)
        .single()
      listRecordId = lr?.id ?? null
    }

    if (!listRecordId) {
      console.warn('[FM webhook] could not resolve list_record_id for call:', recordId)
      return NextResponse.json({ ok: true, action: 'skipped', reason: 'no_list_record_id' })
    }

    if (event === 'record_deleted') {
      const { error } = await supabase
        .from('calls')
        .update({ deleted_at: new Date().toISOString() })
        .eq('tenant_id', TENANT_ID)
        .eq('fm_record_id', recordId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, action: 'deleted', table: 'calls' })
    }

    const { data, error } = await supabase
      .from('calls')
      .upsert(
        {
          ...callColumns,
          ...(customDataOverride !== undefined ? { custom_data: customDataOverride } : {}),
          tenant_id: TENANT_ID,
          list_record_id: listRecordId,
          fm_record_id: recordId,
        },
        { onConflict: 'fm_record_id' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('[FM webhook] calls upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action: 'upserted', table: 'calls', id: data.id })
  }

  return NextResponse.json({ ok: true, action: 'skipped', reason: 'unknown_layout' })
}

// Legacy format: { action, record } → leads table
async function handleLegacyLeadWebhook(
  _body: Record<string, unknown>,
  action: string | undefined,
  record: Record<string, unknown>
): Promise<NextResponse> {
  if (!record.fm_record_id) {
    return NextResponse.json({ error: 'fm_record_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (action === 'delete') {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .eq('fm_record_id', record.fm_record_id as string)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'deleted' })
  }

  const payload = {
    tenant_id:        TENANT_ID,
    fm_record_id:     record.fm_record_id as string,
    ad_name:          (record.ad_name as string) ?? null,
    inquiry_at:       (record.inquiry_at as string) ?? null,
    list_created_at:  (record.list_created_at as string) ?? null,
    status:           (record.status as string) ?? '新規',
    deal_amount:      (record.deal_amount as number) ?? null,
    initial_fee:      (record.initial_fee as number) ?? null,
    monthly_fee:      (record.monthly_fee as number) ?? null,
    source:           'fm_sync',
    source_data: {
      company_name:        record.company_name,
      representative_name: record.representative_name,
      phone_numbers:       record.phone_numbers,
      prefecture:          record.prefecture,
      call_count:          record.call_count,
      fm_synced_at:        new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('leads')
    .upsert(payload, { onConflict: 'fm_record_id,tenant_id' })
    .select('id')
    .single()

  if (error) {
    console.error('[FM webhook legacy] upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: 'upserted', id: data.id })
}
