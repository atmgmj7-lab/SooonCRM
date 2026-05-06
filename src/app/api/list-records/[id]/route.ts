import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmUpdateRecord } from '@/lib/filemaker/client'

// Supabase カラム → FM フィールド名 逆マッピング
const TO_FM: Record<string, string> = {
  company_name:         '会社名',
  representative_name:  '代表名',
  title:                '役職',
  prefecture:           '都道府県',
  phone_numbers:        '電話番号',
  company_email:        'メールアドレス',
  address:              '住所',
  business_start_time:  '営業開始時間',
  business_end_time:    '営業終了時間',
  homepage_exists:      'ホームページ有無',
  homepage_url:         'ホームページURL',
  regular_holidays:     '定休日',
  meo_status:           'MEO',
  list_screening:       'リスト精査',
  recall_date:          '再コール日',
  recall_time:          '再コール時刻',
  meeting_date:         '商談日',
  meeting_time:         '商談時刻',
  zoom_url:             '担当ZOOM',
  case_memo:            '案件メモ',
  newcomer_flag:        '新人フラグ',
  industry:             '業種',
}

// Read-only fields that must never be updated via this endpoint
const READONLY = new Set([
  'id', 'tenant_id', 'fm_record_id', 'customer_id', 'list_created_at',
  'created_at', 'last_call_result', 'last_call_count', 'last_call_date',
  'last_call_agent', 'last_call_category', 'inquiry_count',
])

function toFMValue(col: string, val: unknown): unknown {
  if (col === 'recall_date' || col === 'meeting_date') {
    return typeof val === 'string' ? val.replace(/-/g, '/') : val
  }
  if (Array.isArray(val)) return (val as string[]).join('、')
  return val
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { fields: Record<string, unknown>; fmRecordId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { fields, fmRecordId } = body
  if (!fields || Object.keys(fields).length === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Strip readonly fields
  const safeFields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (!READONLY.has(k)) safeFields[k] = v
  }
  if (Object.keys(safeFields).length === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('list_records')
    .update({ ...safeFields, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[list-records PATCH] supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // FM 非同期更新（fire-and-forget）
  if (fmRecordId && process.env.FM_LAYOUT_LIST) {
    const fmFields: Record<string, unknown> = { update_source: 'WEB' }
    for (const [col, val] of Object.entries(safeFields)) {
      const fmKey = TO_FM[col]
      if (fmKey) fmFields[fmKey] = toFMValue(col, val)
    }
    if (Object.keys(fmFields).length > 1) {
      fmUpdateRecord(process.env.FM_LAYOUT_LIST, fmRecordId, fmFields).catch((err: unknown) => {
        console.error('[list-records PATCH] FM sync error:', err)
      })
    }
  }

  return NextResponse.json({ ok: true })
}
