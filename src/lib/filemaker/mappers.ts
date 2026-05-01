// FMフィールド名 → Supabaseカラム名 マッピング
// FMのコール履歴レイアウトのフィールド名を元に作成

// ---- リスト情報 → list_records ----
export function mapFMListToSupabase(fmFields: Record<string, unknown>) {
  return {
    customer_id:           fmFields['顧客ID']         ?? null,
    ad_name:               fmFields['ADNAME']          ?? fmFields['広告名'] ?? null,
    list_handover_date:    parseDateJP(fmFields['リスト譲渡日'] as string),
    list_name:             fmFields['リスト']          ?? null,
    industry:              fmFields['業種']            ?? null,
    newcomer_flag:         fmFields['新人フラグ']       ?? null,
    list_created_at:       parseDateTimeJP(fmFields['リスト作成日時'] as string),
    company_name:          fmFields['会社名']          ?? null,
    representative_name:   fmFields['代表名']          ?? null,
    title:                 fmFields['役職']            ?? null,
    regular_holidays:      parseHolidays(fmFields['定休日'] as string),
    prefecture:            fmFields['都道府県']        ?? null,
    phone_numbers:         parsePhones(fmFields['電話番号'] as string),
    company_email:         fmFields['会社mail']        ?? null,
    business_start_time:   fmFields['営業開始']        ?? null,
    business_end_time:     fmFields['営業終了']        ?? null,
    address:               fmFields['住所']            ?? null,
    recall_date:           parseDateJP(fmFields['再コール日'] as string),
    recall_time:           fmFields['再コール時刻']    ?? null,
    list_screening:        fmFields['リスト精査']      ?? null,
    homepage_url:          fmFields['ホームページURL'] ?? null,
    meo_status:            parseMEO(fmFields['MEO'] as string),
    case_memo:             fmFields['案件メモ']        ?? null,
    pre_setup_date:        parseDateJP(fmFields['前設日'] as string),
    pre_setup_agent:       fmFields['前設担当']        ?? null,
    sales_agent:           fmFields['営業担当']        ?? null,
  }
}

// ---- コール履歴 → calls ----
export function mapFMCallToSupabase(fmFields: Record<string, unknown>) {
  return {
    // customer_id は呼び出し側で list_record_id に変換する
    fm_customer_id:        fmFields['顧客ID']         as string | null,
    call_date:             parseDateJP(fmFields['コール開始日'] as string),
    call_start_time:       fmFields['コール開始時刻'] as string | null,
    call_end_date:         parseDateJP(fmFields['コール終了日'] as string),
    call_end_time:         fmFields['コール終了時刻'] as string | null,
    call_number:           Number(fmFields['コール回数'] ?? 1),
    agent_name:            fmFields['担当者名']        as string | null,
    call_result:           fmFields['コール結果']      as string | null,
    call_category:         fmFields['対応カテゴリ']    as string | null,
    reissue_pending:       fmFields['再出し/ペンディング'] as string | null,
    list_name:             fmFields['リスト名']        as string | null,
    rep_level:             fmFields['代表レベル']      as string | null,
    rep_level2:            fmFields['代表レベル2']     as string | null,
    ci:                    fmFields['CI']              as string | null,
    appo_detail:           fmFields['アポ情報詳細']    as string | null,
    call_duration_minutes: parseFloat(String(fmFields['コール時間_分'] ?? '0')) || null,
  }
}

// ---- ヘルパー関数 ----
function parseDateJP(val?: string): string | null {
  if (!val) return null
  // FM形式: "2025/04/15" または "04/15/2025" → ISO "2025-04-15"
  const m = val.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  const m2 = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`
  return null
}

function parseDateTimeJP(val?: string): string | null {
  if (!val) return null
  return new Date(val).toISOString().replace('Z', '+00:00')
}

function parsePhones(val?: string): string[] {
  if (!val) return []
  return val.split(/[,\n、]/).map(s => s.trim()).filter(Boolean)
}

function parseHolidays(val?: string): string[] {
  if (!val) return []
  return val.split(/[,、\s]/).map(s => s.trim()).filter(Boolean)
}

function parseMEO(val?: string): string[] {
  if (!val) return []
  return val.split(/[,、]/).map(s => s.trim()).filter(Boolean)
}
