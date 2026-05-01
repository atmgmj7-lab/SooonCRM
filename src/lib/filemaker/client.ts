// FileMaker Data API クライアント
// FM Cloud v22対応

const FM_BASE = `https://${process.env.FM_HOST}/fmi/data/v1/databases/${encodeURIComponent(process.env.FM_DATABASE ?? '')}`

let _token: string | null = null
let _tokenExpiry: number = 0

export async function getFMToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token

  const res = await fetch(`${FM_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(
        `${process.env.FM_USERNAME}:${process.env.FM_PASSWORD}`
      ).toString('base64')}`,
    },
    body: JSON.stringify({ fmDataSource: [] }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`FM auth failed: ${res.status} ${err}`)
  }

  const data = await res.json() as { response: { token: string } }
  _token = data.response.token
  _tokenExpiry = Date.now() + 14 * 60 * 1000 // 14分（FMトークンは15分）
  return _token!
}

export async function fmGetRecords(
  layout: string,
  params: {
    _offset?: number
    _limit?: number
    _sort?: { fieldName: string; sortOrder: 'ascend' | 'descend' }[]
  } = {}
) {
  const token = await getFMToken()
  const searchParams = new URLSearchParams()
  if (params._offset) searchParams.set('_offset', String(params._offset))
  if (params._limit)  searchParams.set('_limit',  String(params._limit))
  if (params._sort)   searchParams.set('_sort',   JSON.stringify(params._sort))

  const url = `${FM_BASE}/layouts/${encodeURIComponent(layout)}/records?${searchParams}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`FM getRecords failed: ${res.status}`)
  return res.json() as Promise<{ response: { data: { recordId: string; fieldData: Record<string, unknown> }[] } }>
}

export async function fmFindRecords(
  layout: string,
  query: Record<string, string>[],
  params: { _offset?: number; _limit?: number } = {}
) {
  const token = await getFMToken()
  const res = await fetch(`${FM_BASE}/layouts/${encodeURIComponent(layout)}/_find`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, ...params }),
  })

  if (res.status === 401) {
    // トークン期限切れ → 再取得してリトライ
    _token = null
    return fmFindRecords(layout, query, params)
  }
  if (!res.ok) throw new Error(`FM findRecords failed: ${res.status}`)
  return res.json() as Promise<{ response: { data: { recordId: string; fieldData: Record<string, unknown> }[] } }>
}

export async function fmLogout() {
  if (!_token) return
  await fetch(`${FM_BASE}/sessions/${_token}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${_token}` },
  })
  _token = null
}
