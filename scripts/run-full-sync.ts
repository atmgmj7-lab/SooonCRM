import { config } from 'dotenv'
config({ path: '.env.local' })

import { syncListRecords, syncCalls } from '../src/lib/filemaker/sync'
import { createAdminClient } from '../src/lib/supabase/admin'

async function main() {
  console.log('フルシンク開始:', new Date().toISOString())

  console.log('\n[1/2] リスト情報同期中...')
  const listResult = await syncListRecords(undefined)
  console.log('リスト同期完了:', listResult)

  console.log('\n[2/2] コール履歴同期中...')
  const callResult = await syncCalls(undefined)
  console.log('コール同期完了:', callResult)

  const supabase = createAdminClient()
  await supabase.from('sync_logs').insert([
    { type: 'fm_list',  synced_at: new Date().toISOString(), records_synced: listResult.totalSynced,  errors: listResult.totalErrors },
    { type: 'fm_calls', synced_at: new Date().toISOString(), records_synced: callResult.totalSynced, errors: callResult.totalErrors },
  ])
  console.log('\n✓ sync_logs 記録完了')
  console.log('終了:', new Date().toISOString())
}

main().catch(e => { console.error('エラー:', e); process.exit(1) })
