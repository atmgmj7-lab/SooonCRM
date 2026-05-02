import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncListRecords, syncCalls } from '@/lib/filemaker/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5分（Vercel Pro）

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // target: 'list'(デフォルト・Vercel cron用) | 'calls' | 'all'
  // calls は202,781件のためVercel 300s制限を超えるので、ローカルで実行する
  const body = await req.json().catch(() => ({})) as { target?: string }
  const target = body.target ?? 'list'

  try {
    const supabase = createAdminClient()
    let listResult = { totalSynced: 0, totalErrors: 0, totalSkipped: 0 }
    let callResult = { totalSynced: 0, totalErrors: 0, totalSkipped: 0 }

    if (target === 'list' || target === 'all') {
      listResult = await syncListRecords()
      await supabase.from('sync_logs').insert({
        type: 'fm_list',
        synced_at: new Date().toISOString(),
        records_synced: listResult.totalSynced,
        errors: listResult.totalErrors,
      })
    }

    if (target === 'calls' || target === 'all') {
      callResult = await syncCalls()
      await supabase.from('sync_logs').insert({
        type: 'fm_calls',
        synced_at: new Date().toISOString(),
        records_synced: callResult.totalSynced,
        errors: callResult.totalErrors,
      })
    }

    return NextResponse.json({
      success: true,
      target,
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
