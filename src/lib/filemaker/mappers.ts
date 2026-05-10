// FMフィールド名 → Supabaseカラム名 マッピング
// FM Data API から取得した実際のフィールド名を使用（2026-05-02 全フィールド確認済み）
import { parseAndNormalizePhones } from '@/lib/utils/phone'

// ---- リスト情報 → list_records ----
export function mapFMListToSupabase(fmFields: Record<string, unknown>) {
  return {
    // ── 基本情報 ─────────────────────────────────────────────
    customer_id:           fmFields['顧客ID']          ?? null,
    ad_name:               fmFields['ADNAME']           ?? null,
    list_handover_date:    parseDateJP(fmFields['リスト譲渡日'] as string),
    list_name:             fmFields['リスト']           ?? null,
    industry:              fmFields['業種']             ?? null,
    newcomer_flag:         fmFields['新人フラグ']        ?? null,
    list_created_at:       parseDateTimeJP(fmFields['リスト作成日時'] as string),
    company_name:          fmFields['会社名']           ?? null,
    representative_name:   fmFields['代表名']           ?? null,
    title:                 fmFields['役職']             ?? null,
    regular_holidays:      parseArray(fmFields['定休日'] as string),
    prefecture:            fmFields['都道府県']         ?? null,
    phone_numbers:         parsePhones(fmFields['電話番号'] as string),
    company_email:         fmFields['メールアドレス']   ?? null,
    business_start_time:   fmFields['営業開始時間']     ?? null,
    business_end_time:     fmFields['営業終了時間']     ?? null,
    homepage_exists:       fmFields['ホームページ有無'] ?? null,
    address:               fmFields['住所']             ?? null,
    recall_date:           parseDateJP(fmFields['再コール日'] as string),
    recall_time:           fmFields['再コール時刻']     ?? null,
    list_screening:        fmFields['リスト精査']       ?? null,
    homepage_url:          fmFields['ホームページURL']  ?? null,
    meo_status:            parseArray(fmFields['MEO'] as string),
    case_memo:             fmFields['案件メモ']         ?? null,
    meeting_date:          parseDateJP(fmFields['商談日'] as string),
    meeting_time:          fmFields['商談時刻']         ?? null,
    zoom_url:              fmFields['担当ZOOM']         ?? null,
    // ── ZOOM・メール設定用 ────────────────────────────────────
    zoom_pw:               fmFields['ZOOMPW']           ?? null,
    zoom_id:               fmFields['ZOOMID']           ?? null,
    zoom_link:             fmFields['ZOOMリンク']        ?? null,
    email_subject:         fmFields['件名']             ?? null,
    email_body:            fmFields['本文']             ?? null,
    // ── 最終コール情報（FMの「最終*」フィールド）─────────────
    last_agent_name:       fmFields['最終担当者名']      ?? null,
    last_rep_level:        fmFields['最終代表レベル']    ?? null,
    last_rep_level2:       fmFields['最終対応レベル']    ?? null,
    last_rep_hit:          fmFields['最終代表hit']       ?? null,
    last_call_category:    fmFields['最終対応カテゴリ']  ?? null,
    last_list_level:       fmFields['最終リストレベル']  ?? null,
    last_call_start_time:  fmFields['最終コール開始時刻'] ?? null,
    last_call_end_time:    fmFields['最終コール終了時刻'] ?? null,
    last_call_duration_sec: parseFloat(String(fmFields['最終コール時間_秒'] ?? '')) || null,
    last_call_duration_min: parseFloat(String(fmFields['最終コール時間_分'] ?? '')) || null,
    last_appo_detail:      fmFields['最終アポ情報詳細']  ?? null,
    last_cl:               fmFields['最終CL']           ?? null,
    last_call_result:      fmFields['最終コール結果']    ?? null,
    last_call_at:          parseDateJP(fmFields['最終コール開始日'] as string),
  }
}

// mapFMCallToSupabase が列に落とす FM フィールド（それ以外は fm_webhook_extras に入れる）
const FM_CALL_FIELDS_TO_COLUMNS = new Set([
  '顧客ID',
  '対応履歴ID',
  'コール結果',
  'コール開始日',
  'コール開始時刻',
  'コール終了時刻',
  'コール時間_分',
  'コール時間_秒',
  'クラリスID',
  '担当者名',
  '代表hit',
  'CL',
  'リストレベル',
  '代表レベル',
  '対応カテゴリ',
  '担当レベル',
  'アポ情報詳細',
  '非表示',
  'リスト仕入れ先',
  '問い合わせ日',
  'リスト',
])

// ---- コール履歴 → calls ----
export function mapFMCallToSupabase(fmFields: Record<string, unknown>) {
  const callDate = parseDateJP(fmFields['コール開始日'] as string)
  const startTime = fmFields['コール開始時刻'] as string | null

  const row = {
    // 呼び出し側で list_record_id に変換する
    fm_customer_id:        fmFields['顧客ID']          as string | null,
    call_date:             callDate ?? new Date().toISOString().slice(0, 10),
    call_start_time:       startTime,
    called_at:             parseCallStartedAtTokyo(callDate, startTime),
    call_end_time:         fmFields['コール終了時刻']  as string | null,
    call_duration_minutes: parseFloat(String(fmFields['コール時間_分'] ?? '0')) || null,
    call_duration_seconds: parseFloat(String(fmFields['コール時間_秒'] ?? '0')) || null,
    claris_id:             fmFields['クラリスID']       as string | null,
    agent_name:            fmFields['担当者名']         as string | null,
    rep_hit:               fmFields['代表hit']          as string | null,
    ci:                    fmFields['CL']               as string | null,
    rep_level:             fmFields['リストレベル']     as string | null,
    daihyo_level:          fmFields['代表レベル']       as string | null,
    call_category:         fmFields['対応カテゴリ']     as string | null,
    rep_level2:            fmFields['担当レベル']       as string | null,
    appo_detail:           fmFields['アポ情報詳細']     as string | null,
    call_result:           fmFields['コール結果']       as string | null,
    hidden_flag:           fmFields['非表示']           as string | null,
    list_source:           fmFields['リスト仕入れ先']  as string | null,
    list_name:             fmFields['リスト']           as string | null,
    call_history_id:       fmFields['対応履歴ID']       as string | null,
    inquiry_date:          parseDateJP(fmFields['問い合わせ日'] as string),
  }

  const fm_webhook_extras: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fmFields)) {
    if (k === 'fm_record_id') continue
    if (FM_CALL_FIELDS_TO_COLUMNS.has(k)) continue
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    fm_webhook_extras[k] = v
  }

  return { ...row, fm_webhook_extras }
}

// ---- ヘルパー関数 ----
/** コール開始日 + 開始時刻を JST として解釈し、timestamptz 文字列にする */
function parseCallStartedAtTokyo(dateIsoYmd: string | null, timeRaw: unknown): string | null {
  if (!dateIsoYmd) return null
  const t = typeof timeRaw === 'string' ? timeRaw.trim() : ''
  const tm = t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  const hh = ((tm?.[1] ?? '0').padStart(2, '0'))
  const mm = ((tm?.[2] ?? '0').padStart(2, '0'))
  const ss = ((tm?.[3] ?? '0').padStart(2, '0'))
  const d = new Date(`${dateIsoYmd}T${hh}:${mm}:${ss}+09:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace('Z', '+00:00')
}

function parseDateJP(val?: string): string | null {
  if (!val || val === '?') return null
  // FM形式: "2025/04/15" → ISO "2025-04-15"
  const m = val.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // FM形式: "04/15/2025" → ISO "2025-04-15"
  const m2 = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`
  return null
}

function parseDateTimeJP(val?: string): string | null {
  if (!val) return null
  try {
    return new Date(val).toISOString().replace('Z', '+00:00')
  } catch {
    return null
  }
}

function parsePhones(val?: string): string[] {
  return parseAndNormalizePhones(val)
}

function parseArray(val?: string): string[] {
  if (!val) return []
  return val.split(/[,、\s]/).map(s => s.trim()).filter(Boolean)
}
