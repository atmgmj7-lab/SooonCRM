import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  let userId: string | null = null
  try {
    const session = await auth()
    userId = session.userId
  } catch {}

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  const result: Record<string, unknown> = {
    userId,
    supabaseUrl: supabaseUrl.slice(0, 40),
    hasServiceRoleKey,
  }

  try {
    const supabase = createAdminClient()

    // tenants
    const { data: tenants, error: te } = await supabase.from('tenants').select('id')
    result.tenants = te ? { error: te.message } : { count: tenants?.length ?? 0 }

    // find user tenant
    let tenantId: string | null = null
    if (userId) {
      const { data: m, error: me } = await supabase
        .from('tenant_members').select('tenant_id').eq('clerk_user_id', userId).limit(1).single()
      result.userTenant = me ? { error: me.message } : { tenantId: m?.tenant_id }
      tenantId = m?.tenant_id ?? null
    }

    if (tenantId) {
      // ad_campaigns count
      const { data: camps, error: ce } = await supabase
        .from('ad_campaigns').select('id').eq('tenant_id', tenantId)
      result.adCampaigns = ce ? { error: ce.message } : { count: camps?.length ?? 0 }

      // ad_spend_daily count
      const { data: spend, error: se } = await supabase
        .from('ad_spend_daily').select('id').eq('tenant_id', tenantId)
      result.adSpendDaily = se ? { error: se.message } : { count: spend?.length ?? 0 }

      // test get_ad_roi RPC
      const now = new Date()
      const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      const until = now.toISOString().slice(0, 10)
      const { data: roi, error: re } = await supabase.rpc('get_ad_roi', {
        p_tenant_id: tenantId, p_period_start: since, p_period_end: until,
      })
      result.getRoiRpc = re ? { error: re.message } : { rowCount: (roi as unknown[])?.length ?? 0, sample: (roi as unknown[])?.[0] ?? null }

      // test insert into ad_campaigns
      const { error: insertErr } = await supabase.from('ad_campaigns').upsert(
        { tenant_id: tenantId, external_id: 'debug_test_001', platform: 'meta', name: 'Debug Test Campaign', status: 'paused' },
        { onConflict: 'tenant_id,external_id' }
      )
      result.adCampaignsInsertTest = insertErr ? { error: insertErr.message, code: insertErr.code } : { success: true }

      // cleanup test row
      if (!insertErr) {
        await supabase.from('ad_campaigns').delete().eq('external_id', 'debug_test_001').eq('tenant_id', tenantId)
      }
    }
  } catch (e) {
    result.fatalError = String(e)
  }

  return NextResponse.json(result)
}
