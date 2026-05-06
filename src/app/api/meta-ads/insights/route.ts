import { fetchAdInsights, fetchAdCreatives } from '@/lib/meta-ads/client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since') ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const until = searchParams.get('until') ?? new Date().toISOString().slice(0, 10)

  const adAccountId = process.env.META_AD_ACCOUNT_ID ?? ''
  const accessToken = process.env.META_ACCESS_TOKEN ?? ''

  if (!adAccountId || !accessToken) {
    return NextResponse.json(
      { error: 'META_AD_ACCOUNT_ID または META_ACCESS_TOKEN が未設定です' },
      { status: 503 }
    )
  }

  try {
    const [insights, creatives] = await Promise.all([
      fetchAdInsights({ adAccountId, accessToken, since, until }),
      fetchAdCreatives({ adAccountId, accessToken }),
    ])

    const creativeMap: Record<string, string | null> = Object.fromEntries(
      creatives.map((c) => [
        c.name,
        c.creative?.image_url ?? c.creative?.thumbnail_url ?? null,
      ])
    )

    const merged = insights.map((ins) => ({
      adName:           ins.ad_name,
      impressions:      Number(ins.impressions),
      clicks:           Number(ins.clicks),
      reach:            Number(ins.reach),
      adSpend:          Number(ins.spend),
      cpm:              Number(ins.cpm),
      cpc:              Number(ins.cpc),
      ctr:              Number(ins.ctr),
      creativeImageUrl: creativeMap[ins.ad_name] ?? null,
    }))

    return NextResponse.json({ data: merged })
  } catch (err) {
    console.error('[meta-ads/insights]', err)
    return NextResponse.json({ error: 'Meta API 取得に失敗しました' }, { status: 502 })
  }
}
