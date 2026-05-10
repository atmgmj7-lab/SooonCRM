/**
 * 広告アカウントから「実際に使われているFacebookページ」を特定する
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const TOKEN = process.env.META_ACCESS_TOKEN!
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID!
const META = 'https://graph.facebook.com/v19.0'

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${META}/${path}`)
  url.searchParams.set('access_token', TOKEN)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return fetch(url.toString()).then(r => r.json())
}

async function main() {
  console.log('\n=== 広告からFacebookページを特定 ===\n')

  // 最近のキャンペーンからページIDを探す
  console.log('【キャンペーン一覧】')
  const campaigns = await get(`act_${AD_ACCOUNT_ID}/campaigns`, {
    fields: 'id,name,status',
    limit: '10',
  }) as { data?: Array<{ id: string; name: string; status: string }>; error?: { message: string } }

  if (campaigns.error) {
    console.log('エラー:', campaigns.error.message)
    return
  }

  const pageIds = new Set<string>()

  for (const camp of (campaigns.data ?? []).slice(0, 5)) {
    console.log(`キャンペーン: ${camp.name} (${camp.status})`)

    // 広告セットからページIDを取得
    const adsets = await get(`${camp.id}/adsets`, {
      fields: 'id,name,promoted_object',
      limit: '5',
    }) as { data?: Array<{ id: string; name: string; promoted_object?: { page_id?: string } }> }

    for (const adset of adsets.data ?? []) {
      const pageId = adset.promoted_object?.page_id
      if (pageId) {
        pageIds.add(pageId)
        console.log(`  → ページID: ${pageId}`)
      }
    }

    // 広告からもページIDを取得
    const ads = await get(`${camp.id}/ads`, {
      fields: 'id,name,creative{page_id}',
      limit: '5',
    }) as { data?: Array<{ id: string; name: string; creative?: { page_id?: string } }> }

    for (const ad of ads.data ?? []) {
      const pageId = ad.creative?.page_id
      if (pageId) {
        pageIds.add(pageId)
      }
    }
  }

  if (pageIds.size === 0) {
    console.log('\n⚠️ キャンペーンからページIDが取得できませんでした')

    // リードフォームからページを探す
    console.log('\n【リードフォームからページを特定】')
    const forms = await get(`act_${AD_ACCOUNT_ID}/leadgen_forms`, {
      fields: 'id,name,page_id',
      limit: '10',
    }) as { data?: Array<{ id: string; name: string; page_id?: string }>; error?: { message: string } }

    if (forms.error) {
      console.log('リードフォームエラー:', forms.error.message)
    } else {
      for (const f of forms.data ?? []) {
        console.log(`フォーム: ${f.name}`)
        if (f.page_id) {
          pageIds.add(f.page_id)
          console.log(`  → ページID: ${f.page_id}`)
        }
      }
    }
  }

  // 特定されたページの情報を取得
  if (pageIds.size > 0) {
    console.log('\n=== 特定されたFacebookページ ===')
    for (const pageId of pageIds) {
      const page = await get(pageId, { fields: 'id,name,category,fan_count' }) as {
        id?: string; name?: string; category?: string; fan_count?: number; error?: { message: string }
      }
      if (page.error) {
        console.log(`ページID ${pageId}: アクセス不可 (${page.error.message})`)
      } else {
        console.log(`✅ ページ名: ${page.name}`)
        console.log(`   ページID: ${page.id}`)
        console.log(`   カテゴリ: ${page.category}`)
      }

      // このページの購読状況を確認（管理者権限があれば）
      const subs = await get(`${pageId}/subscribed_apps`) as {
        data?: Array<{ name?: string; subscribed_fields?: string[] }>
        error?: { message: string }
      }
      if (subs.error) {
        console.log(`   購読状況: 確認不可（管理者権限なし）`)
        console.log(`   ⚠️  このページの管理者に依頼が必要です`)
      } else if (!subs.data?.length) {
        console.log(`   購読状況: ❌ 未購読（webhook届かない）`)
      } else {
        for (const app of subs.data) {
          const hasLeadgen = app.subscribed_fields?.includes('leadgen')
          console.log(`   購読アプリ: ${app.name ?? '(不明)'}`)
          console.log(`   leadgen: ${hasLeadgen ? '✅ 購読済み' : '❌ 未購読'}`)
        }
      }
    }

    console.log('\n=== 次のアクション ===')
    const ids = Array.from(pageIds)
    console.log(`
対象ページID: ${ids.join(', ')}

このページのwebhook購読を登録するには管理者権限が必要です。
以下のいずれかを実施してください:

A) あなた自身がページ管理者の場合:
   Meta Business Suite → 対象ページ → 設定 → 詳細設定
   → 購読済みアプリ → 「AdsReport」を追加 → leadgenにチェック

B) 別の人がページ管理者の場合:
   その人に上記操作を依頼するか、
   あなたをページ管理者に追加してもらってください

C) コードで購読登録する場合（ページ管理者のトークンが必要）:
   curl -X POST "https://graph.facebook.com/v19.0/${ids[0]}/subscribed_apps" \\
     -d "subscribed_fields=leadgen" \\
     -d "access_token=<ページ管理者のページアクセストークン>"
    `)
  } else {
    console.log('\n❌ ページIDを特定できませんでした')
    console.log('Meta Ads Manager で広告を出しているページを直接確認してください')
  }
}

main().catch(console.error)
