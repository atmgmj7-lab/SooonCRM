import { config } from 'dotenv'
config({ path: '.env.local' })

const token = process.env.META_ACCESS_TOKEN!
const META = 'https://graph.facebook.com/v19.0'

async function main() {
  console.log('\n=== Meta トークン詳細診断 ===\n')

  // 1. 権限スコープ確認
  console.log('【1】このトークンが持っている権限:')
  const perms = await fetch(`${META}/me/permissions?access_token=${token}`).then(r => r.json()) as {
    data?: Array<{ permission: string; status: string }>
    error?: { message: string }
  }
  if (perms.error) {
    console.log('エラー:', perms.error.message)
  } else {
    const granted = (perms.data ?? []).filter(p => p.status === 'granted').map(p => p.permission)
    const declined = (perms.data ?? []).filter(p => p.status === 'declined').map(p => p.permission)
    console.log('✅ 許可済み:', granted.join(', ') || '(なし)')
    console.log('❌ 拒否/未取得:', declined.join(', ') || '(なし)')

    const needed = ['leads_retrieval', 'pages_manage_metadata', 'pages_read_engagement', 'ads_management']
    const missing = needed.filter(p => !granted.includes(p))
    if (missing.length > 0) {
      console.log('\n⚠️  Webhook受信に必要な権限が不足:')
      missing.forEach(p => console.log(`   - ${p}`))
    }
  }

  // 2. 広告アカウントへのアクセス確認
  console.log('\n【2】アクセス可能な広告アカウント:')
  const adAccounts = await fetch(`${META}/me/adaccounts?fields=id,name,account_status&access_token=${token}`).then(r => r.json()) as {
    data?: Array<{ id: string; name: string; account_status?: number }>
    error?: { message: string }
  }
  if (adAccounts.error) {
    console.log('エラー:', adAccounts.error.message)
  } else if (!adAccounts.data?.length) {
    console.log('⚠️  アクセス可能な広告アカウントなし')
  } else {
    adAccounts.data.forEach(a => console.log(`   - ${a.name} (${a.id})`))
  }

  // 3. ビジネスマネージャー確認
  console.log('\n【3】ビジネスマネージャー:')
  const businesses = await fetch(`${META}/me/businesses?fields=id,name&access_token=${token}`).then(r => r.json()) as {
    data?: Array<{ id: string; name: string }>
    error?: { message: string }
  }
  if (businesses.error) {
    console.log('エラー:', businesses.error.message)
  } else if (!businesses.data?.length) {
    console.log('⚠️  ビジネスマネージャーなし（個人アカウントのみ）')
  } else {
    for (const biz of businesses.data) {
      console.log(`   ビジネス: ${biz.name} (${biz.id})`)

      // ビジネス管理下のページを確認
      const bizPages = await fetch(`${META}/${biz.id}/owned_pages?fields=id,name&access_token=${token}`).then(r => r.json()) as {
        data?: Array<{ id: string; name: string }>
        error?: { message: string }
      }
      if (bizPages.data?.length) {
        bizPages.data.forEach(p => console.log(`     - ページ: ${p.name} (${p.id})`))
      }
    }
  }

  // 4. 直接ページアクセス確認
  console.log('\n【4】管理可能なFacebookページ:')
  const pages = await fetch(`${META}/me/accounts?fields=id,name,tasks&access_token=${token}`).then(r => r.json()) as {
    data?: Array<{ id: string; name: string; tasks?: string[] }>
    error?: { message: string }
  }
  if (pages.error) {
    console.log('エラー:', pages.error.message)
  } else if (!pages.data?.length) {
    console.log('❌ このアカウントで管理可能なページが見つかりません')
    console.log()
    console.log('━━━ 🚨 これが問題の根本原因の可能性が高い ━━━')
    console.log('広告を出しているFacebookページの管理者権限が')
    console.log('このアクセストークンのアカウントにない可能性があります。')
    console.log()
    console.log('確認してほしいこと:')
    console.log('  1. 広告を出しているFacebookページは何というページですか？')
    console.log('  2. そのページの管理者は誰ですか？')
    console.log('  3. Meta Business Suite でページ管理者を確認してください')
  } else {
    pages.data.forEach(p => console.log(`   ✅ ${p.name} (${p.id})`))
  }

  console.log('\n=== 診断完了 ===')
}

main().catch(console.error)
