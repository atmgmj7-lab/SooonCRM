// FileMaker Data API クライアント
// Claris Cloud (FM Cloud v22) — AWS Cognito SRP 認証 + FMID セッション
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js'

const COGNITO_URL  = 'https://cognito-idp.us-west-2.amazonaws.com/'
const USER_POOL_ID = 'us-west-2_NqkuZcXQY'
const CLIENT_ID    = '4l9rvl4mv5es1eep1qe97cautn'

function getBaseUrl() {
  const host = (process.env.FM_HOST ?? '').trim()
  const db   = (process.env.FM_DATABASE ?? '').trim()
  return `https://${host}/fmi/data/v2/databases/${encodeURIComponent(db)}`
}

// Claris ID トークンを取得（リフレッシュトークン優先 → SRP フォールバック）
async function getClarisIdToken(): Promise<string> {
  const refreshToken = (process.env.FM_REFRESH_TOKEN ?? '').trim()
  if (refreshToken) {
    const res = await fetch(COGNITO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refreshToken },
        ClientId: CLIENT_ID,
      }),
    })
    if (res.ok) {
      const data = await res.json() as { AuthenticationResult: { IdToken: string } }
      return data.AuthenticationResult.IdToken
    }
  }

  // SRP 認証（FM_USERNAME / FM_PASSWORD 使用）
  const username = (process.env.FM_USERNAME ?? '').trim()
  const password = (process.env.FM_PASSWORD ?? '').trim()
  if (!username || !password) throw new Error('FM_USERNAME / FM_PASSWORD が未設定です')

  return new Promise<string>((resolve, reject) => {
    const userPool    = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID })
    const cognitoUser = new CognitoUser({ Username: username, Pool: userPool })
    const authDetails = new AuthenticationDetails({ Username: username, Password: password })
    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (result) => resolve(result.getIdToken().getJwtToken()),
      onFailure: (err)    => reject(new Error(`Claris ID SRP認証失敗: ${err.message ?? String(err)}`)),
    })
  })
}

// FM Data API セッショントークン（モジュールキャッシュ）
let _token: string | null = null
let _tokenExpiry: number  = 0

export async function getFMToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token

  const idToken = await getClarisIdToken()
  const res = await fetch(`${getBaseUrl()}/sessions`, {
    method: 'POST',
    headers: { Authorization: `FMID ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`FM auth failed: ${res.status} ${err}`)
  }

  const headerToken = res.headers.get('X-FM-Data-Access-Token')
  if (headerToken) {
    _token = headerToken
  } else {
    const data = await res.json() as { response: { token: string } }
    _token = data.response.token
  }
  _tokenExpiry = Date.now() + 14 * 60 * 1000
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

  const url = `${getBaseUrl()}/layouts/${encodeURIComponent(layout)}/records?${searchParams}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  if (res.status === 401) { _token = null; return fmGetRecords(layout, params) }
  if (!res.ok) { const body = await res.text(); throw new Error(`FM getRecords failed: ${res.status} ${body}`) }
  return res.json() as Promise<{ response: { data: { recordId: string; fieldData: Record<string, unknown> }[] } }>
}

export async function fmFindRecords(
  layout: string,
  query: Record<string, string>[],
  params: { _offset?: number; _limit?: number } = {}
) {
  const token = await getFMToken()
  const res = await fetch(`${getBaseUrl()}/layouts/${encodeURIComponent(layout)}/_find`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, ...params }),
  })

  if (res.status === 401) { _token = null; return fmFindRecords(layout, query, params) }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { messages?: { code: string }[] }
    // FM error code 401 = no records match the request
    if (body.messages?.[0]?.code === '401') return { response: { data: [] } }
    throw new Error(`FM findRecords failed: ${res.status} ${JSON.stringify(body)}`)
  }
  return res.json() as Promise<{ response: { data: { recordId: string; fieldData: Record<string, unknown> }[] } }>
}

export async function fmLogout() {
  if (!_token) return
  await fetch(`${getBaseUrl()}/sessions/${_token}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  })
  _token = null
}

export async function fmUpdateRecord(
  layout: string,
  recordId: string,
  fieldData: Record<string, unknown>
): Promise<void> {
  const token = await getFMToken()
  const res = await fetch(
    `${getBaseUrl()}/layouts/${encodeURIComponent(layout)}/records/${recordId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fieldData }),
    }
  )
  if (res.status === 401) {
    _token = null
    return fmUpdateRecord(layout, recordId, fieldData)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`FM updateRecord failed: ${res.status} ${body}`)
  }
}

export async function fmCreateRecord(
  fieldData: Record<string, unknown>
): Promise<{ recordId: string } | null> {
  const layout = process.env.FM_LAYOUT_LIST
  if (!layout) return null
  const token = await getFMToken()
  const res = await fetch(
    `${getBaseUrl()}/layouts/${encodeURIComponent(layout)}/records`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fieldData }),
    }
  )
  if (res.status === 401) {
    _token = null
    return fmCreateRecord(fieldData)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`FM createRecord failed: ${res.status} ${body}`)
  }
  const data = await res.json() as { response: { recordId: string } }
  return { recordId: data.response.recordId }
}
