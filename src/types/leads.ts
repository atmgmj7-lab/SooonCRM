export type Lead = {
  id: string
  tenant_id: string
  inquiry_date: string | null
  ad_name: string | null
  adset_id: string | null
  company_name: string | null
  rep_title: string | null
  representative_name: string | null
  prefecture: string | null
  phone_number: string | null
  email_address: string | null
  lead_detail: string | null
  form_q1: string | null
  form_q2: string | null
  form_q3: string | null
  last_call_result: string | null
  call_count: number
  recall_date: string | null
  recall_time: string | null
  jitsuyo_ok: boolean
  ichiyou_ng: boolean
  order_closed: boolean
  initial_fee: number | null
  monthly_fee: number | null
  contract_months: number | null
  total_revenue: number | null
  list_record_id: string | null
  imported_from_csv: boolean
  csv_row_number: number | null
  created_at: string
}

export type LeadManualFields = Pick<
  Lead,
  | 'last_call_result'
  | 'call_count'
  | 'recall_date'
  | 'recall_time'
  | 'jitsuyo_ok'
  | 'ichiyou_ng'
  | 'order_closed'
  | 'initial_fee'
  | 'monthly_fee'
  | 'contract_months'
  | 'total_revenue'
  | 'list_record_id'
>

export const MANUAL_LEAD_FIELDS: (keyof LeadManualFields)[] = [
  'last_call_result',
  'call_count',
  'recall_date',
  'recall_time',
  'jitsuyo_ok',
  'ichiyou_ng',
  'order_closed',
  'initial_fee',
  'monthly_fee',
  'contract_months',
  'total_revenue',
  'list_record_id',
]

export const LAST_CALL_RESULT_OPTIONS = [
  '',
  'アポOK',
  'NG',
  '留守',
  '対象外',
  '再コール',
  '思案中',
]

export type AdSetLeadStats = {
  adset_id: string
  total_leads: number
  appo_ok_count: number
  order_count: number
  total_revenue: number
  appo_rate: number
  order_rate: number
}

export const DEFAULT_CSV_MAPPING: Record<string, keyof Lead> = {
  '問い合わせ日': 'inquiry_date',
  '広告名': 'ad_name',
  '会社名': 'company_name',
  '役職': 'rep_title',
  '代表名': 'representative_name',
  '県名': 'prefecture',
  '電話番号': 'phone_number',
  'phone_number': 'phone_number',
  'メール': 'email_address',
  '詳細': 'lead_detail',
  '最終架電結果': 'last_call_result',
  'コール数': 'call_count',
  '再日': 'recall_date',
  '再時間': 'recall_time',
  '実用O': 'jitsuyo_ok',
  '1用N': 'ichiyou_ng',
  '受注': 'order_closed',
  '初期': 'initial_fee',
  '月額': 'monthly_fee',
  '契約月数': 'contract_months',
  '総受注額': 'total_revenue',
}
