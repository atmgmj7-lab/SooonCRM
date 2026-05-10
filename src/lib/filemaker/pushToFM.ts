import { fmFindByPhone, fmCreateRecord, fmGetRecordById } from '@/lib/filemaker/client'
import { mapFMListToSupabase } from '@/lib/filemaker/mappers'
import { createAdminClient } from '@/lib/supabase/admin'

const TENANT_ID = process.env.DEFAULT_TENANT_ID

export async function pushNewLeadToFM(lead: {
  ad_name?: string | null
  inquiry_at?: string | null
  company_name?: string | null
  representative_name?: string | null
  prefecture?: string | null
  phone_numbers?: string[]
  title?: string | null
  newcomer_flag?: string | null
}): Promise<{ ok: boolean; fm_record_id?: string; error?: string }> {
  const host     = process.env.FM_HOST
  const database = process.env.FM_DATABASE
  const username = process.env.FM_USERNAME
  const password = process.env.FM_PASSWORD

  if (!host || !database || !username || !password) {
    console.warn('[pushToFM] FM環境変数が未設定のためスキップ')
    return { ok: false, error: 'FM環境変数未設定' }
  }

  const baseUrl = `https://${host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}`

  const loginRes = await fetch(`${baseUrl}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
    body: JSON.stringify({}),
  })

  if (!loginRes.ok) return { ok: false, error: 'FM認証失敗' }
  const loginJson = (await loginRes.json()) as { response?: { token?: string } }
  const token = loginJson.response?.token
  if (!token) return { ok: false, error: 'FMトークン取得失敗' }

  try {
    const createRes = await fetch(`${baseUrl}/layouts/リスト情報/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        fieldData: {
          'ADNAME':       lead.ad_name ?? '',
          'リスト作成日時': lead.inquiry_at
            ? new Date(lead.inquiry_at).toLocaleDateString('ja-JP')
            : '',
          '会社名':       lead.company_name ?? '',
          '代表名':       lead.representative_name ?? '',
          '都道府県':     lead.prefecture ?? '',
          '電話番号':     lead.phone_numbers?.[0] ?? '',
          '役職':         lead.title ?? '',
          '新人フラグ':   lead.newcomer_flag ?? '',
        },
      }),
    })

    if (!createRes.ok) return { ok: false, error: 'FMレコード作成失敗' }
    const createJson = (await createRes.json()) as { response?: { recordId?: string | number } }
    const fm_record_id = String(createJson.response?.recordId ?? '')
    return { ok: true, fm_record_id }
  } finally {
    await fetch(`${baseUrl}/sessions/${token}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {})
  }
}

/**
 * 電話番号重複チェック付きでリード情報をFMに登録する
 * - 電話番号がFMに存在する場合 → 既存レコードIDを返す（FM登録スキップ）
 * - 存在しない場合 → 新規作成してレコードIDを返す
 */
export async function upsertListRecordToFM(lead: {
  company_name?: string | null
  representative_name?: string | null
  prefecture?: string | null
  phone_numbers?: string[]
  ad_name?: string | null
  inquiry_at?: string | null
  title?: string | null
  newcomer_flag?: string | null
  /** Supabase list_records.id — 指定時は FM 連携後に list_records を更新する */
  list_record_id?: string | null
}): Promise<{ ok: boolean; fm_record_id?: string; action?: 'created' | 'linked'; error?: string }> {
  const phone = lead.phone_numbers?.[0]

  // 電話番号で重複チェック
  if (phone) {
    const existing = await fmFindByPhone(phone)
    if (existing) {
      console.log(`[upsertToFM] 電話番号重複 → リンクのみ: ${phone} → fm_record_id=${existing.recordId}`)
      if (lead.list_record_id && TENANT_ID) {
        const supabase = createAdminClient()
        const { error } = await supabase
          .from('list_records')
          .update({ fm_record_id: existing.recordId })
          .eq('id', lead.list_record_id)
          .eq('tenant_id', TENANT_ID)
        if (error) console.error('[upsertToFM] list_records link update error:', error.message)
      }
      return { ok: true, fm_record_id: existing.recordId, action: 'linked' }
    }
  }

  // 新規作成
  try {
    const created = await fmCreateRecord({
      ADNAME:      lead.ad_name ?? '',
      リスト作成日時: lead.inquiry_at ? new Date(lead.inquiry_at).toLocaleDateString('ja-JP') : '',
      会社名:       lead.company_name ?? '',
      代表名:       lead.representative_name ?? '',
      都道府県:     lead.prefecture ?? '',
      電話番号:     phone ?? '',
      役職:         lead.title ?? '',
      新人フラグ:   lead.newcomer_flag ?? '',
    })
    if (!created) return { ok: false, error: 'FMレコード作成失敗' }

    const recordId = created.recordId
    const fmRow = await fmGetRecordById(recordId)
    if (!fmRow) {
      console.warn('[upsertToFM] fmGetRecordById が空 — FM生成フィールドを list_records に反映できません')
    }

    if (lead.list_record_id && TENANT_ID) {
      const mapped = fmRow ? mapFMListToSupabase(fmRow.fieldData) : null
      const fmCustomerId =
        mapped?.customer_id != null && mapped.customer_id !== ''
          ? String(mapped.customer_id)
          : null
      const listCreatedAt = mapped?.list_created_at ?? null

      const patch: {
        fm_record_id: string
        customer_id?: string
        list_created_at?: string
      } = { fm_record_id: recordId }
      if (fmCustomerId) patch.customer_id = fmCustomerId
      if (listCreatedAt) patch.list_created_at = listCreatedAt

      const supabase = createAdminClient()
      const { error } = await supabase
        .from('list_records')
        .update(patch)
        .eq('id', lead.list_record_id)
        .eq('tenant_id', TENANT_ID)
      if (error) console.error('[upsertToFM] list_records update error:', error.message)
    } else if (!TENANT_ID && lead.list_record_id) {
      console.warn('[upsertToFM] DEFAULT_TENANT_ID 未設定のため list_records をスキップ')
    }

    return { ok: true, fm_record_id: recordId, action: 'created' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[upsertToFM] error:', msg)
    return { ok: false, error: msg }
  }
}
