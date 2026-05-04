import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmUpdateRecord } from '@/lib/filemaker/client'

// Supabase カラム → FM フィールド名 逆マッピング
const TO_FM: Record<string, string> = {
  case_memo:   '案件メモ',
  recall_date: '再コール日',
  recall_time: '再コール時刻',
}

function toFMDate(iso: string): string {
  return iso.replace(/-/g, '/')
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { fields: Record<string, string>; fmRecordId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { fields, fmRecordId } = body
  if (!fields || Object.keys(fields).length === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // 1. Supabase 更新
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('list_records')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[list-records PATCH] supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. FM 非同期更新（fire-and-forget）
  if (fmRecordId && process.env.FM_LAYOUT_LIST) {
    const fmFields: Record<string, unknown> = { update_source: 'WEB' }
    for (const [col, val] of Object.entries(fields)) {
      const fmKey = TO_FM[col]
      if (fmKey) {
        fmFields[fmKey] = col === 'recall_date' && val ? toFMDate(val) : val
      }
    }

    fmUpdateRecord(process.env.FM_LAYOUT_LIST, fmRecordId, fmFields).catch((err: unknown) => {
      console.error('[list-records PATCH] FM sync error:', err)
    })
  }

  return NextResponse.json({ ok: true })
}
