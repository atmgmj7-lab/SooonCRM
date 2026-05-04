import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapFMListToSupabase } from '@/lib/filemaker/mappers'

export async function POST(request: Request) {
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

  const { error } = await supabase
    .from('list_records')
    .update({ ...mapped, updated_at: new Date().toISOString() })
    .eq('fm_record_id', fmRecordId)

  if (error) {
    console.error('[fm-webhook] supabase update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[fm-webhook] updated list_record for fm_record_id:', fmRecordId)
  return NextResponse.json({ ok: true })
}
