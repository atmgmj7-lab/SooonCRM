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
