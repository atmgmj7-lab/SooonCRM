import { NextResponse } from 'next/server'
import { syncRangeForTenant } from '@/lib/meta/sync-service'
import { createAdminClient } from '@/lib/supabase/admin'

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  if (req.headers.get('x-cron-secret') === expected) return true
  const auth = req.headers.get('authorization')
  if (!auth) return false
  const match = /^Bearer\s+(.*)$/i.exec(auth.trim())
  return Boolean(match && match[1].trim() === expected)
}

async function runIncrementalSync(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: tenants } = await supabase.from('tenants').select('id')
  if (!tenants?.length) return NextResponse.json({ message: 'No tenants found' })

  const untilStr = new Date().toISOString().slice(0, 10)

  const results = []
  for (const tenant of tenants) {
    try {
      const { data: syncState } = await supabase
        .from('ad_sync_state')
        .select('last_synced_date')
        .eq('tenant_id', tenant.id)
        .single()

      let sinceStr = untilStr
      if (syncState?.last_synced_date) {
        const next = new Date(syncState.last_synced_date)
        next.setDate(next.getDate() + 1)
        sinceStr = next.toISOString().slice(0, 10)
      } else {
        const d = new Date()
        d.setDate(d.getDate() - 90)
        sinceStr = d.toISOString().slice(0, 10)
      }

      if (sinceStr > untilStr) {
        results.push({ tenantId: tenant.id, message: 'Already up to date' })
        continue
      }

      const result = await syncRangeForTenant(supabase, tenant.id, sinceStr, untilStr)
      results.push({ tenantId: tenant.id, ...result })
    } catch (e) {
      results.push({ tenantId: tenant.id, error: String(e) })
    }
  }

  return NextResponse.json({ success: true, results })
}

export async function GET(req: Request) {
  return runIncrementalSync(req)
}

export async function POST(req: Request) {
  return runIncrementalSync(req)
}
