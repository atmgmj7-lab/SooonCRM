import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncRangeForTenant } from '@/lib/meta/sync-service'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  // mode: 'yesterday' (default if mode omitted) | 'incremental' | 'full'
  const mode = searchParams.get('mode') ?? 'yesterday'
  const sinceParam = searchParams.get('since')

  const supabase = createAdminClient()
  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 404 })

  /** Meta 取り込み終端日（UTC 日付）。昨日固定だと増分で since が今日のとき常に「最新」扱いになり同期されない */
  const untilStr = new Date().toISOString().slice(0, 10)

  let sinceStr = untilStr

  if (mode === 'incremental') {
    const { data: syncState } = await supabase
      .from('ad_sync_state')
      .select('last_synced_date')
      .eq('tenant_id', member.tenant_id)
      .single()
    if (syncState?.last_synced_date) {
      const next = new Date(syncState.last_synced_date)
      next.setDate(next.getDate() + 1)
      sinceStr = next.toISOString().slice(0, 10)
    } else {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      sinceStr = d.toISOString().slice(0, 10)
    }
  } else if (mode === 'full') {
    sinceStr = sinceParam ?? new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)
  }

  if (sinceStr > untilStr) {
    return NextResponse.json({ success: true, message: 'Already up to date' })
  }

  try {
    const result = await syncRangeForTenant(supabase, member.tenant_id, sinceStr, untilStr)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
