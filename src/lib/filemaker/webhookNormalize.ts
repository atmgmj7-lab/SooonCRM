import type { Json } from '@/types/supabase'

/**
 * FileMaker → /api/webhooks/filemaker 用の Body 正規化
 * - ネスト: { fm_fields: { "顧客ID": "..." } }
 * - フラット: { "fm_fields.顧客ID": "..." }
 */
const FM_FIELDS_PREFIX = 'fm_fields.'

export function normalizeFmWebhookBody(body: Record<string, unknown>): {
  fm_record_id?: string
  record_type?: string
  update_source?: unknown
  fm_fields: Record<string, unknown>
} {
  const fm_record_id =
    typeof body.fm_record_id === 'string'
      ? body.fm_record_id
      : body.fm_record_id != null
        ? String(body.fm_record_id)
        : undefined

  const record_type = typeof body.record_type === 'string' ? body.record_type : undefined

  let fm_fields: Record<string, unknown> = {}
  const nested = body.fm_fields
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    fm_fields = { ...(nested as Record<string, unknown>) }
  }

  for (const [key, val] of Object.entries(body)) {
    if (!key.startsWith(FM_FIELDS_PREFIX)) continue
    const inner = key.slice(FM_FIELDS_PREFIX.length)
    if (inner.length) fm_fields[inner] = val
  }

  return {
    fm_record_id,
    record_type,
    update_source: body.update_source,
    fm_fields,
  }
}

/** 未マップの FM 項目を custom_data.fm_webhook_extras にマージ（既存キーは上書き） */
export function mergeFmCallExtrasIntoCustomData(
  prev: Json | null | undefined,
  extras: Record<string, unknown>,
): Json {
  const base =
    prev && typeof prev === 'object' && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {}

  const prevExtrasRaw = base.fm_webhook_extras
  const prevExtras =
    prevExtrasRaw &&
    typeof prevExtrasRaw === 'object' &&
    !Array.isArray(prevExtrasRaw)
      ? { ...(prevExtrasRaw as Record<string, unknown>) }
      : {}

  return {
    ...base,
    fm_webhook_extras: { ...prevExtras, ...extras },
  } as Json
}
