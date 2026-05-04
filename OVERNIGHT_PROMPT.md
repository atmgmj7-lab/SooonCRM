# AI CRM OS — Overnight完全実装指示書
# 朝起きたら確認作業だけで終わる状態にすること
# Claude Code にそのまま渡して実行させること

---

## 使い方

```
OVERNIGHT_PROMPT.md を読んで、Task 1から順番に全て実装してください。
各Task完了後に「Task N 完了」と報告してから次に進んでください。
既存ファイルは必ず読んでから変更してください。
SQLは実行せず出力だけしてください（★マークがついたものは除く）。
エラーが出たら止まらず内容を報告しながら続けてください。
全Task完了後に git add -A && git commit && vercel --prod を実行してください。
```

---

## 現在の状態（今日完了済み）

- [x] webhook受信 → webhook_leadsに保存
- [x] 電話番号で名寄せ → list_recordsと紐づけ
- [x] 新規顧客はCS番号自動採番（CS0180516まで採番済み）
- [x] leadsテーブルにlist_record_id・customer_id が正しくセットされる
- [x] 既存leads 1,770件の名寄せ完了
- [x] callsにlead_id・list_record_id の両カラム追加済み
- [x] trg_sync_lead_from_call トリガー作成済み
- [x] trg_update_last_call トリガー作成済み
- [x] fn_update_inquiry_stats トリガー修正済み
- [x] デプロイ済み・動作確認済み（CS0180516が正常採番）

## 残っている作業（これを全部やること）

---

## Task 1: GitHub Actions 自動化セットアップ

### 1-1. ディレクトリ・既存ファイル確認

```bash
ls -la .github/workflows/ 2>/dev/null || echo "ディレクトリなし"
cat vercel.json 2>/dev/null || echo "なし"
cat scripts/sync-calls-bulk.ts | head -30
cat scripts/sync-list-bulk.ts | head -30 2>/dev/null || echo "なし"
```

### 1-2. .github/workflows/sync-fm.yml を作成

```yaml
name: FM Delta Sync

on:
  schedule:
    - cron: '0 */2 * * *'  # 2時間ごと（JST 9時・11時・13時・15時・17時・19時・21時・23時）
  workflow_dispatch:         # 手動実行も可能

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run FM delta sync
        run: npx tsx scripts/sync-list-bulk.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DEFAULT_TENANT_ID: ${{ secrets.DEFAULT_TENANT_ID }}
          FM_HOST: ${{ secrets.FM_HOST }}
          FM_DATABASE: ${{ secrets.FM_DATABASE }}
          FM_USERNAME: ${{ secrets.FM_USERNAME }}
          FM_PASSWORD: ${{ secrets.FM_PASSWORD }}
          FM_REFRESH_TOKEN: ${{ secrets.FM_REFRESH_TOKEN }}
          FM_LAYOUT_LIST: ${{ secrets.FM_LAYOUT_LIST }}
          FM_LAYOUT_CALLS: ${{ secrets.FM_LAYOUT_CALLS }}
```

### 1-3. .github/workflows/sync-calls.yml を作成

```yaml
name: FM Calls Sync

on:
  schedule:
    - cron: '30 */1 * * *'  # 1時間ごと（毎時30分）
  workflow_dispatch:

jobs:
  sync-calls:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run calls sync
        run: npx tsx scripts/sync-calls-bulk.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DEFAULT_TENANT_ID: ${{ secrets.DEFAULT_TENANT_ID }}
          FM_HOST: ${{ secrets.FM_HOST }}
          FM_DATABASE: ${{ secrets.FM_DATABASE }}
          FM_USERNAME: ${{ secrets.FM_USERNAME }}
          FM_PASSWORD: ${{ secrets.FM_PASSWORD }}
          FM_REFRESH_TOKEN: ${{ secrets.FM_REFRESH_TOKEN }}
          FM_LAYOUT_CALLS: ${{ secrets.FM_LAYOUT_CALLS }}
```

### 1-4. .github/workflows/rematch-leads.yml を作成

```yaml
name: Rematch Unmatched Leads

on:
  schedule:
    - cron: '0 17 * * *'  # UTC 17:00 = JST 翌2:00
  workflow_dispatch:

jobs:
  rematch:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run lead rematch
        run: npx tsx scripts/rematch-leads.ts
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          DEFAULT_TENANT_ID: ${{ secrets.DEFAULT_TENANT_ID }}
```

### 1-5. vercel.jsonのcron設定を確認・削除

vercel.jsonが存在する場合、cronsキーがあれば削除する（GitHub Actionsに移行するため）。

### 1-6. scripts/rematch-leads.ts を作成

既存の scripts/ ディレクトリを確認してから作成する。

```typescript
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

function normalizePhone(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return [];
  const patterns: string[] = [digits];
  if (digits.startsWith('81')) patterns.push('0' + digits.slice(2));
  if (digits.length === 10 && !digits.startsWith('0')) patterns.push('0' + digits);
  if (digits.length === 11 && digits.startsWith('0')) patterns.push(digits.slice(1));
  return [...new Set(patterns)];
}

async function main() {
  console.log('未マッチleads名寄せバッチ開始');

  const { data: unmatchedLeads, error } = await supabase
    .from('leads')
    .select('id, phone_number, tenant_id')
    .is('list_record_id', null)
    .eq('tenant_id', TENANT_ID)
    .not('phone_number', 'is', null)
    .not('phone_number', 'eq', '');

  if (error) {
    console.error('leads取得エラー:', error);
    process.exit(1);
  }

  console.log(`未マッチ件数: ${unmatchedLeads?.length ?? 0}`);

  let matched = 0;
  let unmatched = 0;
  let processed = 0;

  for (const lead of unmatchedLeads ?? []) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`処理中: ${processed}/${unmatchedLeads?.length}`);
    }

    const phonePatterns = normalizePhone(lead.phone_number ?? '');
    let foundRecord = null;

    for (const phone of phonePatterns) {
      const { data } = await supabase
        .from('list_records')
        .select('id, customer_id')
        .contains('phone_numbers', JSON.stringify([phone]))
        .eq('tenant_id', TENANT_ID)
        .maybeSingle();

      if (data) {
        foundRecord = data;
        break;
      }
    }

    if (foundRecord) {
      await supabase
        .from('leads')
        .update({
          list_record_id: foundRecord.id,
          customer_id: foundRecord.customer_id,
        })
        .eq('id', lead.id);
      matched++;
    } else {
      unmatched++;
    }
  }

  console.log('===== 完了 =====');
  console.log(`新たにマッチ: ${matched}件`);
  console.log(`依然未マッチ: ${unmatched}件`);
}

main().catch(console.error);
```

### 1-7. GitHub Secrets設定手順をコンソールに出力

```
以下のコマンドを実行してSecrets設定URLを表示:
echo "GitHub Secrets設定URL:"
echo "https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/settings/secrets/actions"
echo ""
echo "以下のSecretsを追加してください(.env.localの値をコピー):"
echo "NEXT_PUBLIC_SUPABASE_URL"
echo "SUPABASE_SERVICE_ROLE_KEY"
echo "DEFAULT_TENANT_ID"
echo "FM_HOST"
echo "FM_DATABASE"
echo "FM_USERNAME"
echo "FM_PASSWORD"
echo "FM_REFRESH_TOKEN"
echo "FM_LAYOUT_LIST"
echo "FM_LAYOUT_CALLS"
```

---

## Task 2: /api/webhooks/filemaker/route.ts の完全実装確認・補完

既存ファイルを読んでから以下が全て実装されているか確認し、不足分のみ追加する。

### 必須チェックリスト

**① x-fm-secret 認証ヘッダーチェック**
```typescript
const secret = request.headers.get('x-fm-secret');
if (process.env.FM_WEBHOOK_SECRET && secret !== process.env.FM_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**② ループ防止チェック**
```typescript
const body = await request.json();
if (body.update_source === 'WEB') {
  return NextResponse.json({ ok: true, skipped: true });
}
```

**③ fm_record_id で list_records を検索してupsert**
```typescript
const { data: existing } = await supabase
  .from('list_records')
  .select('id')
  .eq('fm_record_id', body.fm_record_id)
  .eq('tenant_id', TENANT_ID)
  .maybeSingle();

if (existing) {
  // 更新
  await supabase
    .from('list_records')
    .update({
      company_name: body.company_name ?? undefined,
      representative_name: body.representative_name ?? undefined,
      prefecture: body.prefecture ?? undefined,
      recall_date: body.recall_date ?? undefined,
      recall_time: body.recall_time ?? undefined,
      case_memo: body.case_memo ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);
} else {
  // fm_record_idが一致するレコードがない場合はスキップ（新規作成はWebhook側で行う）
  console.log('fm_record_id not found, skipping:', body.fm_record_id);
}
```

**④ レスポンス**
```typescript
return NextResponse.json({ ok: true });
```

---

## Task 3: /api/leads/route.ts の集計API対応

既存ファイルを読んでから以下のクエリパラメータ対応を確認・追加する。

### 対応するパラメータ
- `?ad_name=xxx` → 広告名でフィルタ（部分一致）
- `?status=xxx` → ステータスでフィルタ
- `?from=YYYY-MM-DD&to=YYYY-MM-DD` → 期間フィルタ（inquiry_at）
- `?page=1&limit=50` → ページネーション（デフォルト: page=1, limit=50）

### レスポンス形式

```typescript
return NextResponse.json({
  leads: data,
  pagination: {
    total: count,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil((count ?? 0) / limitNum),
  },
  summary: {
    total_leads: count ?? 0,
    appo_count: appoCount,
    appo_rate: count ? Math.round((appoCount / count) * 1000) / 10 : 0,
    won_count: wonCount,
    won_rate: count ? Math.round((wonCount / count) * 1000) / 10 : 0,
    avg_call_count: avgCallCount,
  },
});
```

### summaryの集計クエリ

```typescript
// 同じフィルタ条件でsummaryを集計
const { data: summaryData } = await supabase
  .from('leads')
  .select('status, call_count, appo_at')
  .eq('tenant_id', TENANT_ID)
  // 同じフィルタ条件を適用

const appoCount = summaryData?.filter(l => l.appo_at !== null).length ?? 0;
const wonCount = summaryData?.filter(l => l.status === '受注').length ?? 0;
const totalCallCount = summaryData?.reduce((sum, l) => sum + (l.call_count ?? 0), 0) ?? 0;
const avgCallCount = summaryData?.length
  ? Math.round((totalCallCount / summaryData.length) * 10) / 10
  : 0;
```

---

## Task 4: /api/calls/route.ts の確認・補完

既存ファイルを読んでから以下が実装されているか確認・補完する。

### POST（新規コール追加）
```typescript
export async function POST(request: Request) {
  const supabase = createAdminClient();
  const body = await request.json();
  const { list_record_id, lead_id, called_at, agent_name } = body;

  if (!list_record_id) {
    return NextResponse.json({ error: 'list_record_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calls')
    .insert({
      tenant_id: process.env.DEFAULT_TENANT_ID!,
      list_record_id,
      lead_id: lead_id ?? null,
      called_at: called_at ?? new Date().toISOString(),
      agent_name: agent_name ?? null,
      call_result: null,
    })
    .select()
    .single();

  if (error) {
    console.error('calls insert error:', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, call: data });
}
```

### PATCH（コール結果更新）
```typescript
export async function PATCH(request: Request) {
  const supabase = createAdminClient();
  const body = await request.json();
  const { id, call_result, duration_seconds, memo } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('calls')
    .update({
      call_result,
      duration_seconds: duration_seconds ?? null,
      memo: memo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

---

## Task 5: 型定義の最終同期

```bash
# Supabase型定義を最新状態に再生成
npx supabase gen types typescript --linked > src/types/supabase.ts
```

失敗する場合はスキップしてエラーを報告すること。

---

## Task 6: ビルド確認・デプロイ

```bash
# 型エラー確認
npx tsc --noEmit 2>&1 | head -50

# ビルド確認
npm run build

# 全変更をコミット
git add -A
git commit -m "feat: GitHub Actions自動化・FM Webhook・leads集計API・calls API完全実装"

# GitHubにpush（GitHub Actionsを有効化）
git push origin main

# Vercelにデプロイ
vercel --prod
```

---

## Task 7: 最終動作確認（全て自動でテストすること）

### 7-1. 新規リードWebhookテスト
```bash
curl -s -X POST https://sooon-crm.vercel.app/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "08099998888",
    "ad_name": "overnight_test",
    "company_name": "夜間テスト会社",
    "representative_name": "夜間テスト太郎",
    "prefecture": "大阪府"
  }'
```
期待: `{"ok":true,"customer_id":"CS018XXXX"}`

### 7-2. 重複リードテスト（同一電話番号）
```bash
curl -s -X POST https://sooon-crm.vercel.app/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "08099998888",
    "ad_name": "overnight_test_重複",
    "company_name": "夜間テスト会社"
  }'
```
期待: 同じcustomer_idが返る（重複なのでlist_recordsは新規作成されない）

### 7-3. leads集計APIテスト
```bash
curl -s "https://sooon-crm.vercel.app/api/leads?page=1&limit=5" | python3 -m json.tool 2>/dev/null || \
curl -s "https://sooon-crm.vercel.app/api/leads?page=1&limit=5"
```
期待: `summary.total_leads` が数値で返る

### 7-4. DB最終確認クエリを出力

以下のSQLをコンソールに出力すること（ユーザーがSupabaseで実行して確認する）:

```sql
-- 朝の確認クエリ（Supabase SQL Editorで実行）

-- 1. 全体サマリー
SELECT
  (SELECT COUNT(*) FROM list_records WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d') as total_customers,
  (SELECT COUNT(*) FROM leads WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d') as total_leads,
  (SELECT COUNT(*) FROM leads WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d' AND list_record_id IS NOT NULL) as matched_leads,
  (SELECT COUNT(*) FROM leads WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d' AND list_record_id IS NULL) as unmatched_leads,
  (SELECT COUNT(*) FROM webhook_leads WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d' AND status = 'added') as webhook_added,
  (SELECT COUNT(*) FROM webhook_leads WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d' AND status = 'pending') as webhook_pending;

-- 2. 直近のleads（overnight_testが入っているか）
SELECT
  lr.customer_id,
  lr.company_name,
  l.ad_name,
  l.inquiry_at,
  l.status,
  l.list_record_id IS NOT NULL as is_matched
FROM leads l
LEFT JOIN list_records lr ON lr.id = l.list_record_id
ORDER BY l.inquiry_at DESC
LIMIT 10;

-- 3. 広告別集計
SELECT
  ad_name,
  COUNT(*) as lead_count,
  COUNT(appo_at) as appo_count,
  ROUND(COUNT(appo_at)::numeric / COUNT(*) * 100, 1) as appo_rate_pct,
  COUNT(CASE WHEN status = '受注' THEN 1 END) as won_count,
  ROUND(AVG(call_count), 1) as avg_calls
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND ad_name IS NOT NULL
GROUP BY ad_name
ORDER BY lead_count DESC
LIMIT 10;
```

---

## 朝の確認作業リスト（なりきよさんが実施）

### GitHub Secrets設定（必須）
```
https://github.com/[username]/Sooon-CRM/settings/secrets/actions
で .env.local の以下の値を登録:

NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DEFAULT_TENANT_ID
FM_HOST
FM_DATABASE
FM_USERNAME
FM_PASSWORD
FM_REFRESH_TOKEN
FM_LAYOUT_LIST
FM_LAYOUT_CALLS
```

### 動作確認
- [ ] Vercelデプロイが成功しているか
- [ ] 上記の確認クエリ3本をSupabaseで実行
- [ ] overnight_testのleadが登録されているか
- [ ] GitHub ActionsのActionsタブでワークフローが認識されているか
- [ ] .env.localのSecretsをGitHubに登録

### FM側対応（なりきよさんのみ実施可能）
- [ ] FMスクリプトワークスペースで「Push To Web CRM」スクリプト作成
- [ ] OnRecordCommitトリガーに設定
- [ ] テストレコードで双方向同期の動作確認
```
