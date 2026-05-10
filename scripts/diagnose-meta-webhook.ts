/**
 * Meta Webhook 診断スクリプト
 * 実行: npx tsx scripts/diagnose-meta-webhook.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID!   // "666710788876944"
const META_BASE = 'https://graph.facebook.com/v19.0'

async function apiFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${META_BASE}/${path}`)
  url.searchParams.set('access_token', ACCESS_TOKEN)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  return res.json()
}

async function main() {
  console.log('\n==============================')
  console.log('  Meta Webhook 診断ツール')
  console.log('==============================\n')

  if (!ACCESS_TOKEN) {
    console.error('❌ META_ACCESS_TOKEN が .env.local に設定されていません')
    process.exit(1)
  }

  // Step 1: トークンの有効性確認
  console.log('【Step 1】アクセストークンの確認')
  const me = await apiFetch('me', { fields: 'id,name' })
  if (me.error) {
    console.error('❌ トークンエラー:', me.error.message)
    console.log('   → Metaのアクセストークンが期限切れか無効です')
    console.log('   → developers.facebook.com でトークンを再発行してください')
    process.exit(1)
  }
  console.log(`✅ トークン有効: ${me.name} (id: ${me.id})`)

  // Step 2: 広告アカウントに紐づくFacebookページを取得
  console.log('\n【Step 2】広告アカウントに紐づくFacebookページ一覧')
  const pages = await apiFetch('me/accounts', { fields: 'id,name,access_token,category' })
  if (pages.error) {
    console.error('❌ ページ一覧取得エラー:', pages.error.message)
  } else if (!pages.data?.length) {
    console.warn('⚠️  管理しているFacebookページが見つかりません')
    console.log('   → このアクセストークンのアカウントでページが管理されているか確認してください')
  } else {
    console.log(`✅ ${pages.data.length}件のページが見つかりました:`)
    for (const page of pages.data as Array<{ id: string; name: string; category?: string; access_token?: string }>) {
      console.log(`   - ${page.name} (ID: ${page.id}, カテゴリ: ${page.category ?? '—'})`)

      // Step 3: 各ページのWebhook購読状況確認
      if (page.access_token) {
        const url = new URL(`${META_BASE}/${page.id}/subscribed_apps`)
        url.searchParams.set('access_token', page.access_token)
        const subs = await fetch(url.toString()).then(r => r.json()) as {
          data?: Array<{ link?: string; subscribed_fields?: string[] }>
          error?: { message: string }
        }

        if (subs.error) {
          console.log(`     ⚠️  購読状況取得エラー: ${subs.error.message}`)
        } else if (!subs.data?.length) {
          console.log(`     ❌ このページはどのアプリにも購読されていません`)
          console.log(`        → リードが届かない原因はここです！`)
          console.log(`        → 下記コマンドで購読を登録できます（PAGE_ACCESS_TOKENは上記のtoken）:`)
          console.log(`        curl -X POST "${META_BASE}/${page.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${page.access_token.slice(0, 20)}..."`)
        } else {
          for (const app of subs.data) {
            const fields = app.subscribed_fields ?? []
            const hasLeadgen = fields.includes('leadgen')
            console.log(`     📱 購読中アプリ: ${app.link ?? '(不明)'}`)
            console.log(`        購読フィールド: ${fields.join(', ') || '(なし)'}`)
            if (hasLeadgen) {
              console.log(`        ✅ leadgen フィールド購読済み → Webhookは届くはず`)
            } else {
              console.log(`        ❌ leadgen フィールドなし → リードが届かない！`)
              console.log(`           → Metaアプリのwebhook設定でleadgenを追加してください`)
            }
          }
        }
      }
    }
  }

  // Step 4: 最新のリードgen ID確認（実際にMetaからリードが来ているか）
  console.log('\n【Step 3】最近のリードフォーム（リードが存在するか確認）')
  const forms = await apiFetch(`act_${AD_ACCOUNT_ID}/leadgen_forms`, {
    fields: 'id,name,leads_count',
    limit: '5',
  })
  if (forms.error) {
    console.error('❌ フォーム一覧取得エラー:', forms.error.message)
  } else if (!forms.data?.length) {
    console.warn('⚠️  リードフォームが見つかりません')
  } else {
    console.log('✅ リードフォーム:')
    for (const f of forms.data as Array<{ id: string; name: string; leads_count?: number }>) {
      console.log(`   - ${f.name} (${f.leads_count ?? 0}件のリード)`)

      // 最新のleadgenを1件取得
      const leads = await apiFetch(`${f.id}/leads`, {
        fields: 'id,created_time,field_data',
        limit: '1',
      }) as { data?: Array<{ id: string; created_time: string; field_data?: unknown[] }> }
      if (leads.data?.[0]) {
        const l = leads.data[0]
        console.log(`     最新リード: ${l.id} (${l.created_time})`)
        console.log(`     field_data件数: ${l.field_data?.length ?? 0}件`)
      }
    }
  }

  // Step 5: 今後の対処手順
  console.log('\n==============================')
  console.log('  診断完了 - 対処手順')
  console.log('==============================')
  console.log(`
❶ Facebookページの購読登録（最重要）
   Meta developers.facebook.com → 対象アプリ → Webhooks
   → Facebookページ → "ページを購読" → leadgen にチェック

❷ それでも届かない場合
   上記診断結果の「購読中アプリ」欄のURLを確認
   → sooon-crm の Webhooks URLが登録されているか確認

❸ アクセストークンが期限切れの場合
   長期間有効なPage Access Tokenに切り替えが必要
  `)
}

main().catch(console.error)
