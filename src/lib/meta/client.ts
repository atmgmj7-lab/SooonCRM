const META_API_BASE = 'https://graph.facebook.com/v19.0'

function getToken() {
  return process.env.META_ACCESS_TOKEN!
}

function getAccountId() {
  return process.env.META_AD_ACCOUNT_ID!
}

export interface MetaCampaign {
  id: string
  name: string
  objective: string
  status: string
  created_time: string
  updated_time: string
}

export interface MetaInsight {
  campaign_id: string
  adset_id?: string
  ad_id?: string
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  clicks: string
  reach: string
  frequency: string
}

export interface MetaAdSet {
  id: string
  name: string
  campaign_id: string
  status: string
}

export interface MetaCreative {
  id: string
  name: string
  thumbnail_url?: string
}

async function fetchMeta<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${META_API_BASE}/${path}`)
  url.searchParams.set('access_token', getToken())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Meta API error ${res.status}: ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<T>
}

export async function getCampaigns(): Promise<MetaCampaign[]> {
  const data = await fetchMeta<{ data: MetaCampaign[] }>(
    `act_${getAccountId()}/campaigns`,
    {
      fields: 'id,name,objective,status,created_time,updated_time',
      limit: '200',
    }
  )
  return data.data ?? []
}

export async function getAdSets(): Promise<MetaAdSet[]> {
  const out: MetaAdSet[] = []
  const first = new URL(`${META_API_BASE}/act_${getAccountId()}/adsets`)
  first.searchParams.set('access_token', getToken())
  first.searchParams.set('fields', 'id,name,campaign_id,status')
  first.searchParams.set('limit', '500')
  let url: string | null = first.toString()
  while (url) {
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Meta API error ${res.status}: ${JSON.stringify(err)}`)
    }
    const data = (await res.json()) as {
      data?: MetaAdSet[]
      paging?: { next?: string }
    }
    out.push(...(data.data ?? []))
    url = data.paging?.next ?? null
  }
  return out
}

export async function getDailyInsights(
  since: string,
  until: string,
  level: 'campaign' | 'adset' | 'ad' = 'campaign'
): Promise<MetaInsight[]> {
  const out: MetaInsight[] = []
  let path: string | null = `act_${getAccountId()}/insights`
  const baseParams: Record<string, string> = {
    fields: 'campaign_id,adset_id,ad_id,spend,impressions,clicks,reach,frequency',
    level,
    time_range: JSON.stringify({ since, until }),
    time_increment: '1',
    limit: '500',
  }
  let first = true
  while (path) {
    const url = first ? new URL(`${META_API_BASE}/${path}`) : new URL(path)
    if (first) {
      url.searchParams.set('access_token', getToken())
      for (const [k, v] of Object.entries(baseParams)) {
        url.searchParams.set(k, v)
      }
    }
    const res = await fetch(url.toString())
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(`Meta API error ${res.status}: ${JSON.stringify(err)}`)
    }
    const data = (await res.json()) as {
      data?: MetaInsight[]
      paging?: { next?: string }
    }
    out.push(...(data.data ?? []))
    path = data.paging?.next ?? null
    first = false
  }
  return out
}

export interface MetaAd {
  id: string
  name: string
  campaign_id: string
  creative?: { id: string; name: string; thumbnail_url?: string }
}

export async function getAllAds(): Promise<MetaAd[]> {
  const data = await fetchMeta<{ data: MetaAd[] }>(
    `act_${getAccountId()}/ads`,
    {
      fields: 'id,name,campaign_id,creative{id,name,thumbnail_url}',
      limit: '500',
    }
  )
  return data.data ?? []
}

export async function getAdCreatives(campaignId: string): Promise<MetaCreative[]> {
  const data = await fetchMeta<{
    data: Array<{ id: string; name: string; creative: MetaCreative }>
  }>(
    `act_${getAccountId()}/ads`,
    {
      fields: 'id,name,creative{id,name,thumbnail_url}',
      filtering: JSON.stringify([
        { field: 'campaign.id', operator: 'EQUAL', value: campaignId },
      ]),
      limit: '200',
    }
  )
  return (data.data ?? []).map((ad) => ad.creative).filter(Boolean)
}
