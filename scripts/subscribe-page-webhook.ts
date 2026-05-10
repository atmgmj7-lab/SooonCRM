/**
 * NexusbyhomeページをAdsReportアプリに購読登録する
 * 実行: npx tsx scripts/subscribe-page-webhook.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const USER_TOKEN = process.env.META_ACCESS_TOKEN!
const PAGE_ID = '203228529537250'  // Nexusbyhome
const META = 'https://graph.facebook.com/v19.0'

async function get(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${META}/${path}`)
  url.searchParams.set('access_token', USER_TOKEN)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return fetch(url.toString()).then(r => r.json())
}

async function post(path: string, body: Record<string, string>) {
  const url = new URL(`${META}/${path}`)
  const form = new URLSearchParams({ ...body, access_token: USER_TOKEN })
  return fetch(url.toString(), { method: 'POST', body: form }).then(r => r.json())
}

async function main() {
  console.log('\n=== Nexusbyhome Webhook購読登録 ===\n')

  // Step1: ページアクセストークンを取得（ユーザートークン→ページトークン）
  console.log('【Step1】ページアクセストークンを取得...')
  const accounts = await get('me/accounts', { fields: 'id,name,access_token' }) as {
    data?: Array<{ id: string; name: string; access_token: string }>
    error?: { message: string }
  }

  if (accounts.error) {
    console.error('❌ ページ一覧取得エラー:', accounts.error.message)
    console.log('→ アクセストークンにpages_show_list権限が必要です')
    return
  }

  const page = accounts.data?.find(p => p.id === PAGE_ID)
  if (!page) {
    console.log('管理ページ一覧:', accounts.data?.map(p => `${p.name}(${p.id})`).join(', '))
    console.error(`❌ ページID ${PAGE_ID} が見つかりません`)
    console.log('→ Business Manager経由のページは me/accounts では取得できない場合があります')

    // Business Manager経由でのページアクセストークン取得を試みる
    console.log('\nBusiness Manager経由でページトークンを取得中...')
    const bizPage = await get(`${PAGE_ID}`, { fields: 'id,name,access_token' }) as {
      id?: string; name?: string; access_token?: string; error?: { message: string }
    }
    if (bizPage.error || !bizPage.access_token) {
      console.error('❌ ページトークン取得失敗:', bizPage.error?.message ?? '不明')
      console.log('\n📋 手動での対処手順:')
      console.log('1. Meta Developers → Graph API Explorer')
      console.log('2. 「ユーザーまたはページ」ドロップダウン → 「Nexusbyhome」を選択')
      console.log('3. Generate Access Token をクリック')
      console.log('4. そのページトークンを .env.local の META_PAGE_ACCESS_TOKEN に追加')
      console.log('5. このスクリプトを再度実行')
      return
    }

    console.log(`✅ ページトークン取得成功: ${bizPage.name}`)
    await subscribeWithToken(bizPage.access_token)
    return
  }

  console.log(`✅ ページ「${page.name}」のトークン取得成功`)
  await subscribeWithToken(page.access_token)
}

async function subscribeWithToken(pageToken: string) {
  console.log('\n【Step2】現在の購読状況を確認...')
  const currentSubs = await fetch(
    `${META}/${PAGE_ID}/subscribed_apps?access_token=${pageToken}`
  ).then(r => r.json()) as {
    data?: Array<{ name?: string; link?: string; subscribed_fields?: string[] }>
    error?: { message: string }
  }

  if (currentSubs.error) {
    console.error('❌ 購読状況確認エラー:', currentSubs.error.message)
  } else {
    console.log('現在の購読:', currentSubs.data?.length
      ? currentSubs.data.map(a => `${a.name ?? '不明'}(${a.subscribed_fields?.join(',')})`).join(', ')
      : '(なし)')
  }

  console.log('\n【Step3】AdsReportアプリにleadgenフィールドで購読登録...')
  const subResult = await fetch(
    `${META}/${PAGE_ID}/subscribed_apps`,
    {
      method: 'POST',
      body: new URLSearchParams({
        subscribed_fields: 'leadgen',
        access_token: pageToken,
      }),
    }
  ).then(r => r.json()) as { success?: boolean; error?: { message: string } }

  if (subResult.error) {
    console.error('❌ 購読登録エラー:', subResult.error.message)
    if (subResult.error.message.includes('development')) {
      console.log('\n⚠️  アプリが開発モードのため登録できない可能性があります')
      console.log('→ Meta Developers → AdsReport → アプリレビュー → ライブモードに切り替えてください')
    }
  } else if (subResult.success) {
    console.log('✅ 購読登録成功！')

    // 確認
    const afterSubs = await fetch(
      `${META}/${PAGE_ID}/subscribed_apps?access_token=${pageToken}`
    ).then(r => r.json()) as {
      data?: Array<{ name?: string; subscribed_fields?: string[] }>
    }
    console.log('登録後の購読:', afterSubs.data?.map(
      a => `${a.name ?? '不明'}(${a.subscribed_fields?.join(',')})`
    ).join(', '))

    console.log('\n🎉 完了！次回のMetaリードからWebhookが届くようになります')
    console.log('ただしAdsReportが開発モードの場合は本番リードが届かない可能性があります。')
    console.log('→ developers.facebook.com → AdsReport → ライブモードに変更することを推奨します')
  } else {
    console.log('レスポンス:', JSON.stringify(subResult))
  }
}

main().catch(console.error)
