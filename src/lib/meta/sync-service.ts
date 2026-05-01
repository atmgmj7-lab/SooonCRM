import { getCampaigns, getDailyInsights, getAllAds, getAdSets, type MetaInsight } from '@/lib/meta/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type AdSpendDailyInsert = Database['public']['Tables']['ad_spend_daily']['Insert']

export async function syncRangeForTenant(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  since: string,
  until: string
): Promise<{
  since: string
  until: string
  campaigns: number
  adSets: number
  creatives: number
  spendRows: number
}> {
  const campaigns = await getCampaigns()
  const extToDbId = new Map<string, string>()

  for (const c of campaigns) {
    const { data } = await supabase
      .from('ad_campaigns')
      .upsert(
        {
          tenant_id: tenantId,
          external_id: c.id,
          platform: 'meta',
          name: c.name,
          objective: c.objective?.toLowerCase() ?? null,
          status: c.status === 'ACTIVE' ? 'active' : c.status === 'PAUSED' ? 'paused' : 'ended',
        },
        { onConflict: 'tenant_id,external_id' }
      )
      .select('id')
      .single()
    if (data) extToDbId.set(c.id, data.id)
  }

  const adSetsMeta = await getAdSets()
  const adsetExtToDb = new Map<string, string>()
  for (const a of adSetsMeta) {
    const campaignDbId = extToDbId.get(a.campaign_id)
    if (!campaignDbId) continue
    const { data } = await supabase
      .from('ad_sets')
      .upsert(
        {
          tenant_id: tenantId,
          campaign_id: campaignDbId,
          external_id: a.id,
          name: a.name,
          status: a.status === 'ACTIVE' ? 'active' : a.status === 'PAUSED' ? 'paused' : 'ended',
        },
        { onConflict: 'tenant_id,external_id' }
      )
      .select('id')
      .single()
    if (data) adsetExtToDb.set(a.id, data.id)
  }

  const ads = await getAllAds()

  for (const ad of ads) {
    const campaignDbId = extToDbId.get(ad.campaign_id)
    if (!campaignDbId) continue
    await supabase
      .from('ad_creatives')
      .upsert(
        {
          tenant_id: tenantId,
          campaign_id: campaignDbId,
          external_id: ad.id,
          name: ad.name || ad.creative?.name || ad.id,
          thumbnail_url: ad.creative?.thumbnail_url ?? null,
        },
        { onConflict: 'tenant_id,external_id' }
      )
      .select('id')
      .single()
  }

  await supabase
    .from('ad_spend_daily')
    .delete()
    .eq('tenant_id', tenantId)
    .gte('spend_date', since)
    .lte('spend_date', until)
    .is('creative_id', null)

  const insights = await getDailyInsights(since, until, 'adset')
  const spendRows: AdSpendDailyInsert[] = []

  for (const insight of insights) {
    const campaignDbId = extToDbId.get(insight.campaign_id)
    const ins = insight as MetaInsight & { ad_set_id?: string }
    const adsetId = ins.adset_id ?? ins.ad_set_id
    const adsetDbId = adsetId ? adsetExtToDb.get(String(adsetId)) : undefined
    if (!campaignDbId || !adsetDbId) continue
    spendRows.push({
      tenant_id: tenantId,
      campaign_id: campaignDbId,
      ad_set_id: adsetDbId,
      creative_id: null,
      spend_date: insight.date_start,
      spend_amount: Math.round(parseFloat(insight.spend ?? '0')),
      impressions: parseInt(insight.impressions ?? '0', 10),
      clicks: parseInt(insight.clicks ?? '0', 10),
      reach: parseInt(insight.reach ?? '0', 10),
      frequency: parseFloat(insight.frequency ?? '0'),
    })
  }

  if (spendRows.length > 0) {
    const { error: insertErr } = await supabase.from('ad_spend_daily').insert(spendRows)
    if (insertErr) {
      throw new Error(`ad_spend_daily insert: ${insertErr.message}`)
    }
  }

  await supabase
    .from('ad_sync_state')
    .upsert(
      { tenant_id: tenantId, last_synced_date: until, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id' }
    )

  return {
    since,
    until,
    campaigns: campaigns.length,
    adSets: adSetsMeta.length,
    creatives: ads.length,
    spendRows: spendRows.length,
  }
}
