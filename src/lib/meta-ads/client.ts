const META_API_VERSION = 'v19.0'
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

export type MetaAdInsight = {
  ad_id: string
  ad_name: string
  impressions: string
  clicks: string
  reach: string
  spend: string
  cpm: string
  cpc: string
  ctr: string
}

export type MetaAdCreative = {
  id: string
  name: string
  creative?: {
    thumbnail_url?: string
    image_url?: string
  }
}

export async function fetchAdInsights(params: {
  adAccountId: string
  accessToken: string
  since: string
  until: string
}): Promise<MetaAdInsight[]> {
  const url = new URL(`${BASE_URL}/act_${params.adAccountId}/insights`)
  url.searchParams.set('fields', 'ad_id,ad_name,impressions,clicks,reach,spend,cpm,cpc,ctr')
  url.searchParams.set('time_range', JSON.stringify({ since: params.since, until: params.until }))
  url.searchParams.set('level', 'ad')
  url.searchParams.set('access_token', params.accessToken)
  url.searchParams.set('limit', '500')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`)
  const data = await res.json() as { data?: MetaAdInsight[] }
  return data.data ?? []
}

export async function fetchAdCreatives(params: {
  adAccountId: string
  accessToken: string
}): Promise<MetaAdCreative[]> {
  const url = new URL(`${BASE_URL}/act_${params.adAccountId}/ads`)
  url.searchParams.set('fields', 'id,name,creative{thumbnail_url,image_url,object_story_spec}')
  url.searchParams.set('access_token', params.accessToken)
  url.searchParams.set('limit', '500')

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`)
  const data = await res.json() as { data?: MetaAdCreative[] }
  return data.data ?? []
}
