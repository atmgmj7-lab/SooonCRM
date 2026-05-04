import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapFMListToSupabase } from '@/lib/filemaker/mappers'

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

  const fmRecordId = body.fm_record_id as string | undefined
  const fmFields   = body.fm_fields   as Record<string, unknown> | undefined

  if (!fmRecordId || !fmFields) {
    return NextResponse.json(
      { error: 'fm_record_id and fm_fields are required' },
      { status: 400 }
    )
  }

  const mapped = mapFMListToSupabase(fmFields)
  const supabase = createAdminClient()

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
