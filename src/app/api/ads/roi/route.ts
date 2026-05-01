import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const defaultSince = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultUntil = now.toISOString().slice(0, 10)
  const since = searchParams.get('since') ?? defaultSince
  const until = searchParams.get('until') ?? defaultUntil
  const platform = searchParams.get('platform') ?? null

  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) {
    return NextResponse.json({ roi: [], cohort: [], creatives: [], campaignMeta: [], noTenant: true })
  }

  const [
    { data: roi, error: roiErr },
    { data: cohort, error: cohortErr },
    { data: creatives },
    { data: campaignMeta },
  ] = await Promise.all([
    supabase.rpc('get_ad_roi_adset_daily', {
      p_tenant_id: member.tenant_id,
      p_period_start: since,
      p_period_end: until,
    }),
    supabase.rpc('get_ad_cohort_metrics', { p_tenant_id: member.tenant_id }),
    supabase
      .from('ad_creatives')
      .select('id, campaign_id, external_id, name, thumbnail_url, visible')
      .eq('tenant_id', member.tenant_id),
    supabase
      .from('ad_campaigns')
      .select('id, external_id, visible')
      .eq('tenant_id', member.tenant_id),
  ])

  const filteredRoi = platform
    ? (roi ?? []).filter((r: { platform: string }) => r.platform === platform)
    : (roi ?? [])

  return NextResponse.json({
    roi: filteredRoi,
    cohort: cohort ?? [],
    creatives: creatives ?? [],
    campaignMeta: campaignMeta ?? [],
    errors: {
      roi: roiErr?.message ?? null,
      cohort: cohortErr?.message ?? null,
    },
  })
}
