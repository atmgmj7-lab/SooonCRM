import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncListRecords, syncCalls } from '@/lib/filemaker/sync'

export const maxDuration = 300 // 5分（Vercel Pro）

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { fullSync?: boolean }
  const fullSync = body.fullSync === true

  try {
    const supabase = createAdminClient()
    let sinceModified: string | undefined

    if (!fullSync) {
      const { data } = await supabase
        .from('sync_logs')
        .select('synced_at')
        .eq('type', 'fm_list')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single()
      sinceModified = data?.synced_at ?? undefined
    }

    // 1. リスト情報を先に同期（callsの親なので必ず先）
    const listResult = await syncListRecords(sinceModified)

    // 2. コール履歴を同期
    const callResult = await syncCalls(sinceModified)

    // 3. 同期ログ記録
    await supabase.from('sync_logs').insert({
      type: 'fm_list',
      synced_at: new Date().toISOString(),
      records_synced: listResult.totalSynced,
      errors: listResult.totalErrors,
    })
    await supabase.from('sync_logs').insert({
      type: 'fm_calls',
      synced_at: new Date().toISOString(),
      records_synced: callResult.totalSynced,
      errors: callResult.totalErrors,
    })

    return NextResponse.json({
      success: true,
      list: listResult,
      calls: callResult,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('sync-fm error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Vercel Cron からのGETも受け付ける
export async function GET(req: NextRequest) {
  return POST(req)
}
