// FMフィールド名 → Supabaseカラム名 マッピング
// FM Data API から取得した実際のフィールド名を使用（2026-05-02 全フィールド確認済み）
import { parseAndNormalizePhones } from '@/lib/utils/phone'

// ---- リスト情報 → list_records ----
export function mapFMListToSupabase(fmFields: Record<string, unknown>) {
  return {
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
  }
}

// ---- コール履歴 → calls ----
export function mapFMCallToSupabase(fmFields: Record<string, unknown>) {
  return {
    // 呼び出し側で list_record_id に変換する
    fm_customer_id:        fmFields['顧客ID']          as string | null,
    call_date:             parseDateJP(fmFields['コール開始日'] as string),
    call_start_time:       fmFields['コール開始時刻']  as string | null,
    call_end_time:         fmFields['コール終了時刻']  as string | null,
    call_duration_minutes: parseFloat(String(fmFields['コール時間_分'] ?? '0')) || null,
    call_duration_seconds: parseFloat(String(fmFields['コール時間_秒'] ?? '0')) || null,
    claris_id:             fmFields['クラリスID']       as string | null,
    agent_name:            fmFields['担当者名']         as string | null,
    rep_hit:               fmFields['代表hit']          as string | null,
    ci:                    fmFields['CL']               as string | null,
    rep_level:             fmFields['リストレベル']     as string | null,
    call_category:         fmFields['対応カテゴリ']     as string | null,
    rep_level2:            fmFields['担当レベル']       as string | null,
    appo_detail:           fmFields['アポ情報詳細']     as string | null,
    call_result:           fmFields['コール結果']       as string | null,
    hidden_flag:           fmFields['非表示']           as string | null,
    list_source:           fmFields['リスト仕入れ先']  as string | null,
    call_history_id:       fmFields['対応履歴ID']       as string | null,
    inquiry_date:          parseDateJP(fmFields['問い合わせ日'] as string),
  }
}

// ---- ヘルパー関数 ----
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
