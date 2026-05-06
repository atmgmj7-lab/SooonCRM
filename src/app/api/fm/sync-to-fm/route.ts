import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fmUpdateRecord, fmCreateRecord } from '@/lib/filemaker/client'
import { auth } from '@/lib/auth'

// Supabase list_records → FM フィールド名マッピング
function toFMFields(rec: Record<string, unknown>): Record<string, unknown> {
  const phones = (rec.phone_numbers as string[] | null) ?? []
  const holidays = (rec.regular_holidays as string[] | null) ?? []
  const meo = (rec.meo_status as string[] | null) ?? []

  const fmDate = (iso: string | null | undefined) =>
    typeof iso === 'string' ? iso.replace(/-/g, '/') : ''

  return {
    会社名:           rec.company_name ?? '',
    代表名:           rec.representative_name ?? '',
    役職:             rec.title ?? '',
    都道府県:         rec.prefecture ?? '',
    電話番号:         phones.join('\n'),
    メールアドレス:   rec.company_email ?? '',
    住所:             rec.address ?? '',
    営業開始時間:     rec.business_start_time ?? '',
    営業終了時間:     rec.business_end_time ?? '',
    ホームページ有無: rec.homepage_exists ?? '',
    ホームページURL:  rec.homepage_url ?? '',
    定休日:           holidays.join('、'),
    MEO:              meo.join('、'),
    リスト精査:       rec.list_screening ?? '',
    再コール日:       fmDate(rec.recall_date as string),
    再コール時刻:     rec.recall_time ?? '',
    商談日:           fmDate(rec.meeting_date as string),
    商談時刻:         rec.meeting_time ?? '',
    担当ZOOM:         rec.zoom_url ?? '',
    案件メモ:         rec.case_memo ?? '',
    業種:             rec.industry ?? '',
    新人フラグ:       rec.newcomer_flag ?? '',
    update_source:    'WEB',
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const layout = process.env.FM_LAYOUT_LIST
  if (!layout) return NextResponse.json({ error: 'FM_LAYOUT_LIST not configured' }, { status: 500 })

  let body: { list_record_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.list_record_id) {
    return NextResponse.json({ error: 'list_record_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: rec, error } = await supabase
    .from('list_records')
    .select('*')
    .eq('id', body.list_record_id)
    .single()

  if (error || !rec) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  const fmFields = toFMFields(rec as Record<string, unknown>)

  try {
    if (rec.fm_record_id) {
      // 既存レコード更新
      await fmUpdateRecord(layout, rec.fm_record_id as string, fmFields)
      return NextResponse.json({ ok: true, action: 'updated', fm_record_id: rec.fm_record_id })
    } else {
      // 新規レコード作成
      const created = await fmCreateRecord(fmFields)
      if (created?.recordId) {
        // fm_record_id をSupabaseに保存
        await supabase
          .from('list_records')
          .update({ fm_record_id: created.recordId })
          .eq('id', body.list_record_id)
      }
      return NextResponse.json({ ok: true, action: 'created', fm_record_id: created?.recordId ?? null })
    }
  } catch (err) {
    console.error('[sync-to-fm] FM error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
