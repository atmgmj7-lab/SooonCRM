# AI CRM OS — 完全実装指示書
# Claude Code にそのまま渡して実行させること
# 作成日: 2026-05-04

---

## このファイルの使い方

Claude Code を起動して以下を指示する:

```
IMPLEMENTATION_PROMPT.md を読んで、Step 1 から順番に全て実装してください。
各Stepの完了後に「Step N 完了」と報告してから次に進んでください。
既存ファイルは必ず読んでから変更してください。
エラーが出たら止まらず内容を報告しながら続けてください。
```

---

## 設計思想

```
【現状】
スプレッドシート（リード管理）+ FM（架電管理）= 2システム分断

【目指す姿】
AI CRM OS に一本化。FM = バックアップ・参照用途のみ。

list_records（顧客マスタ・全データのハブ）
  └── leads（広告流入ごとの問い合わせ台帳）
        └── calls（架電台帳）
              └── deals（受注台帳）
```

### テーブルの役割
| テーブル | 役割 | 集計軸 |
|---------|------|--------|
| list_records | FMのリスト情報と同等。顧客IDで全データをまとめるハブ | 顧客別LTV・総架電数 |
| leads | 広告流入ごとに1行。同一顧客でも別リードとして記録 | 広告別CPO・アポ率・受注率 |
| calls | lead_id（広告別集計）+ list_record_id（顧客別集計）の両方を持つ | 時間帯別接続率・架電回数別アポ率 |
| deals | lead_id（CPO計算）+ list_record_id（LTV計算）の両方を持つ | 売上・単価 |

### 架電とリードの紐づけ方針
- callsは **list_record_id（必須）** + **lead_id（任意）** の両方を持つ
- 架電開始時に「どのリードへの架電か」を選択できる（複数リードある場合）
- デフォルトは最新のlead
- これにより「広告別架電数」と「顧客別架電数」の両方が集計できる

---

## 前提：DB側で完了済みの作業（重複実行しないこと）

- [x] leads に list_record_id (uuid, FK → list_records) 追加済み
- [x] leads の customer_id を text 型に変更済み
- [x] leads に appo_at (timestamptz) 追加済み
- [x] leads に webhook_lead_id (uuid) 追加済み
- [x] calls に lead_id (uuid, FK → leads) 追加済み
- [x] calls に called_at / duration_seconds / call_result 追加済み
- [x] generate_customer_id(p_tenant_id uuid) 関数 作成済み → CS0000001形式で採番
- [x] trg_sync_lead_from_call トリガー 作成済み → calls INSERT/UPDATE → leads 自動更新
- [x] deals テーブル 作成済み（supabase.ts 行854に型定義あり）

---

## Step 1: Supabase 型定義の再生成

### 1-1. 型ファイルを再生成する

```bash
npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/supabase.ts
```

SUPABASE_PROJECT_IDが不明な場合は .env.local の NEXT_PUBLIC_SUPABASE_URL から取得:
```bash
# https://xxxxx.supabase.co の xxxxxがproject_id
cat .env.local | grep NEXT_PUBLIC_SUPABASE_URL
```

### 1-2. 型生成後に以下のカラムが含まれているか確認

- `leads.list_record_id` (string | null)
- `leads.customer_id` (string | null) ← textに変更済みなのでstringであること
- `calls.lead_id` (string | null)
- `calls.list_record_id` (string | null)
- `list_records` テーブル全体
- `webhook_leads` テーブル全体

### 1-3. 型生成が失敗する場合の代替手順

src/types/supabase.ts に以下の型を手動で追加・修正する:

```typescript
// leads テーブルに追加すべき型
list_record_id: string | null
customer_id: string | null  // uuid → string に変更済み
appo_at: string | null
webhook_lead_id: string | null
company_name: string | null
representative_name: string | null
phone_number: string | null
prefecture: string | null
call_count: number | null
first_call_at: string | null
last_call_at: string | null
last_call_result: string | null

// calls テーブルに追加すべき型
lead_id: string | null
list_record_id: string | null
called_at: string | null
duration_seconds: number | null
call_result: string | null
```

---

## Step 2: DBスキーマの不足カラム追加

Supabase SQL Editor で以下を実行する（1本ずつ実行してエラーを確認すること）:

### 2-1. callsに list_record_id を追加

```sql
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS list_record_id uuid REFERENCES list_records(id);

CREATE INDEX IF NOT EXISTS idx_calls_list_record_id
ON calls(list_record_id);
```

### 2-2. trg_update_last_call トリガーを修正（callsのINSERT/UPDATEでlist_recordsも自動更新）

```sql
-- 既存トリガーを削除して再作成
DROP TRIGGER IF EXISTS trg_update_last_call ON calls;
DROP FUNCTION IF EXISTS update_last_call_info();

CREATE OR REPLACE FUNCTION update_last_call_info()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- list_record_id がある場合はlist_recordsの最終コール情報を自動更新
  IF NEW.list_record_id IS NOT NULL THEN
    UPDATE list_records SET
      last_call_date = COALESCE(NEW.called_at::date, NEW.call_date),
      last_call_result = COALESCE(NEW.call_result, NEW.result),
      last_call_agent = NEW.agent_name,
      last_call_count = (
        SELECT COUNT(*) FROM calls WHERE list_record_id = NEW.list_record_id
      ),
      updated_at = now()
    WHERE id = NEW.list_record_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_last_call
AFTER INSERT OR UPDATE ON calls
FOR EACH ROW
EXECUTE FUNCTION update_last_call_info();
```

### 2-3. 既存leadsを電話番号で名寄せしてlist_record_idを埋める（過去データ紐づけ）

```sql
-- phone_numberで名寄せしてlist_record_id・customer_idを更新
UPDATE leads l
SET
  list_record_id = lr.id,
  customer_id = lr.customer_id
FROM list_records lr
WHERE l.list_record_id IS NULL
  AND l.phone_number IS NOT NULL
  AND l.phone_number != ''
  AND lr.phone_numbers::text LIKE '%' ||
    regexp_replace(l.phone_number, '\D', '', 'g') || '%'
  AND l.tenant_id = lr.tenant_id;

-- 結果確認
SELECT
  COUNT(*) as total,
  COUNT(list_record_id) as matched,
  COUNT(*) - COUNT(list_record_id) as unmatched
FROM leads;
```

### 2-4. webhook_leadsに match_status カラムが存在するか確認・追加

```sql
-- 確認
SELECT column_name FROM information_schema.columns
WHERE table_name = 'webhook_leads' AND column_name = 'match_status';

-- なければ追加
ALTER TABLE webhook_leads
ADD COLUMN IF NOT EXISTS match_status text DEFAULT 'unmatched';
-- 値: unmatched / matched / new_record
```

---

## Step 3: /api/webhooks/meta/route.ts の完全実装

src/app/api/webhooks/meta/route.ts を以下のロジックで完全に書き換える。

### 処理フロー
1. `webhook_leads` に生データ保存（status: 'pending'）
2. 電話番号を正規化
3. `list_records` で名寄せ（phone_numbersカラムで検索）
4. 名寄せ結果で分岐:
   - **既存顧客** → list_record_id と customer_id を取得
   - **新規顧客** → `generate_customer_id()` でCS番号採番 → `list_records` INSERT → FM通知（非同期）
5. `leads` に INSERT（list_record_id と customer_id を必ずセット）
6. `webhook_leads.status` を 'added' に更新

### 実装コード

```typescript
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

export async function POST(request: Request) {
  const supabase = createAdminClient();

  // Meta Webhookの検証（GETリクエスト）
  const { searchParams } = new URL(request.url);
  if (searchParams.get('hub.mode') === 'subscribe') {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (searchParams.get('hub.verify_token') === verifyToken) {
      return new Response(searchParams.get('hub.challenge'));
    }
    return new Response('Forbidden', { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Meta Ads Leadgen形式のパース（entry[0].changes[0].value.leadgen_id等）
  // 直接POSTされる形式にも対応
  const leadData = extractLeadData(body);

  // 1. webhook_leadsに生データ保存
  const { data: webhookLead, error: wlError } = await supabase
    .from('webhook_leads')
    .insert({
      tenant_id: TENANT_ID,
      raw_data: body,
      source: 'meta_ads',
      ad_name: leadData.ad_name ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (wlError) {
    console.error('webhook_leads insert error:', JSON.stringify(wlError));
    return NextResponse.json({ error: wlError.message }, { status: 500 });
  }

  // 2. 電話番号正規化
  const phone = normalizePhone(leadData.phone ?? '');
  if (!phone) {
    console.log('phone_number not found, skipping leads insert');
    return NextResponse.json({ ok: true, note: 'no phone number' });
  }

  // 3. 名寄せ（既存顧客検索）
  const { data: matched } = await supabase
    .from('list_records')
    .select('id, customer_id')
    .contains('phone_numbers', JSON.stringify([phone]))
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  let listRecordId: string;
  let customerId: string;

  if (matched) {
    // 既存顧客
    listRecordId = matched.id;
    customerId = matched.customer_id;

    // webhook_leadsにmatch_statusを記録
    await supabase
      .from('webhook_leads')
      .update({ match_status: 'matched' })
      .eq('id', webhookLead.id);
  } else {
    // 新規顧客: CS番号採番
    const { data: newCustomerId, error: idError } = await supabase
      .rpc('generate_customer_id', { p_tenant_id: TENANT_ID });

    if (idError) {
      console.error('generate_customer_id error:', JSON.stringify(idError));
      return NextResponse.json({ error: idError.message }, { status: 500 });
    }

    customerId = newCustomerId;

    const { data: newRecord, error: lrError } = await supabase
      .from('list_records')
      .insert({
        tenant_id: TENANT_ID,
        customer_id: customerId,
        phone_numbers: JSON.stringify([phone]),
        ad_name: leadData.ad_name ?? null,
        company_name: leadData.company_name ?? null,
        representative_name: leadData.representative_name ?? null,
        prefecture: leadData.prefecture ?? null,
        source: 'meta_ads',
        webhook_lead_id: webhookLead.id,
      })
      .select()
      .single();

    if (lrError) {
      console.error('list_records insert error:', JSON.stringify(lrError));
      return NextResponse.json({ error: lrError.message }, { status: 500 });
    }

    listRecordId = newRecord.id;

    // webhook_leadsにmatch_statusを記録
    await supabase
      .from('webhook_leads')
      .update({ match_status: 'new_record' })
      .eq('id', webhookLead.id);

    // FM通知（非同期・失敗許容）
    notifyFileMaker(newRecord).catch(err =>
      console.error('FM notify failed (non-blocking):', JSON.stringify(err))
    );
  }

  // 4. leadsにINSERT（必ずlist_record_idとcustomer_idをセット）
  const { error: leadError } = await supabase
    .from('leads')
    .insert({
      tenant_id: TENANT_ID,
      customer_id: customerId,
      list_record_id: listRecordId,
      ad_name: leadData.ad_name ?? null,
      inquiry_at: new Date().toISOString(),
      source: 'meta_ads',
      source_data: body,
      status: '未対応',
      webhook_lead_id: webhookLead.id,
      company_name: leadData.company_name ?? null,
      representative_name: leadData.representative_name ?? null,
      phone_number: phone,
      prefecture: leadData.prefecture ?? null,
    });

  if (leadError) {
    console.error('leads insert error:', JSON.stringify(leadError));
    return NextResponse.json({ error: leadError.message }, { status: 500 });
  }

  // 5. webhook_leadsをaddedに更新
  await supabase
    .from('webhook_leads')
    .update({
      status: 'added',
      added_to_list_id: listRecordId,
    })
    .eq('id', webhookLead.id);

  return NextResponse.json({ ok: true, customer_id: customerId });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('hub.mode') === 'subscribe') {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken || searchParams.get('hub.verify_token') !== verifyToken) {
      return new Response('Forbidden', { status: 403 });
    }
    return new Response(searchParams.get('hub.challenge'));
  }
  return new Response('OK');
}

// Meta Ads Leadgen形式 & 直接POST形式の両方に対応
function extractLeadData(body: Record<string, unknown>) {
  // Meta Leadgen形式: entry[0].changes[0].value
  const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
  const change = (entry?.changes as Array<Record<string, unknown>>)?.[0];
  const value = change?.value as Record<string, unknown> | undefined;

  if (value?.field_data) {
    // Meta Ads Leadgen フォームデータ形式
    const fields: Record<string, string> = {};
    (value.field_data as Array<{ name: string; values: string[] }>).forEach(f => {
      fields[f.name] = f.values?.[0] ?? '';
    });
    return {
      phone: fields['phone_number'] ?? fields['phone'] ?? fields['電話番号'] ?? '',
      ad_name: (value.ad_name as string) ?? fields['ad_name'] ?? '',
      company_name: fields['company_name'] ?? fields['会社名'] ?? '',
      representative_name: fields['full_name'] ?? fields['代表名'] ?? '',
      prefecture: fields['state'] ?? fields['県名'] ?? fields['都道府県'] ?? '',
    };
  }

  // 直接POST形式（テスト・他ソース）
  return {
    phone: (body.phone_number as string) ?? (body.phone as string) ?? '',
    ad_name: (body.ad_name as string) ?? (body.adName as string) ?? '',
    company_name: (body.company_name as string) ?? '',
    representative_name: (body.representative_name as string) ?? '',
    prefecture: (body.prefecture as string) ?? (body.county as string) ?? '',
  };
}

// 電話番号正規化（国際形式 → 国内形式）
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('81')) return '0' + digits.slice(2);
  return digits;
}

// FM通知（非同期・失敗許容）
async function notifyFileMaker(record: Record<string, unknown>) {
  try {
    const { fmCreateRecord } = await import('@/lib/filemaker/client');
    const result = await fmCreateRecord({
      customer_id: record.customer_id as string,
      company_name: record.company_name as string,
      phone_numbers: record.phone_numbers as string,
      ad_name: record.ad_name as string,
    });
    if (result?.recordId) {
      const supabase = createAdminClient();
      await supabase
        .from('list_records')
        .update({ fm_record_id: result.recordId })
        .eq('id', record.id as string);
    }
  } catch (err) {
    throw err;
  }
}
```

---

## Step 4: /api/webhook-leads/add-to-list/route.ts の修正

src/app/api/webhook-leads/add-to-list/route.ts を読んでから以下の処理を追加する。

### 追加すべき処理

「リストに追加」ボタン押下時のフローを以下に修正:

```typescript
// 既存の list_records INSERT 処理の後に以下を追加

// leads にも INSERT する（問い合わせ履歴として記録）
const { error: leadError } = await supabase
  .from('leads')
  .insert({
    tenant_id: TENANT_ID,
    customer_id: customerId,           // list_recordsのcustomer_id
    list_record_id: listRecordId,      // 作成・紐づけしたlist_recordsのid
    ad_name: webhookLead.ad_name ?? null,
    inquiry_at: webhookLead.received_at ?? new Date().toISOString(),
    source: webhookLead.source ?? 'meta_ads',
    source_data: webhookLead.raw_data ?? {},
    status: '未対応',
    webhook_lead_id: webhookLead.id,
    company_name: mappedData.company_name ?? null,
    representative_name: mappedData.representative_name ?? null,
    phone_number: normalizedPhone,
    prefecture: mappedData.prefecture ?? null,
  });

if (leadError) {
  console.error('leads insert error in add-to-list:', JSON.stringify(leadError));
  // leads INSERTが失敗してもlist_recordsは作成済みなので処理継続
  // エラーはログに残す
}

// webhook_leads の match_status も更新
await supabase
  .from('webhook_leads')
  .update({
    status: 'added',
    added_to_list_id: listRecordId,
    match_status: existingRecord ? 'matched' : 'new_record',
  })
  .eq('id', webhookLead.id);
```

---

## Step 5: /components/list/ActionSidebar.tsx の架電開始処理実装

src/components/list/ActionSidebar.tsx を読んでから「開始」ボタンに以下の処理を追加する。

### 動作仕様

```
「開始」ボタン押下
  ↓
その顧客のleadsを取得（list_record_idで検索）
  ↓
leadsが0件 → アラート「先にリードを登録してください」
leadsが1件 → 自動選択してcall作成
leadsが複数件 → モーダルで選択（デフォルト：最新lead）
  ↓
calls INSERT:
  - list_record_id: 現在のlist_recordのid
  - lead_id: 選択したleadのid
  - called_at: now()
  - tenant_id: TENANT_ID
  - agent_name: 現在のユーザー名
  - call_result: null（終了時に更新）
```

### calls INSERT のAPI呼び出し

```typescript
// 既存の /api/calls エンドポイントを使うか、新規作成する
const response = await fetch('/api/calls', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    list_record_id: listRecordId,
    lead_id: selectedLeadId,
    called_at: new Date().toISOString(),
  }),
});
```

### リード選択モーダルのUI仕様

```
┌─────────────────────────────┐
│ どのリードへの架電ですか？   │
├─────────────────────────────┤
│ ○ 歯科特化型広告            │
│   2026-04-28 問い合わせ     │ ← 最新（デフォルト選択）
├─────────────────────────────┤
│ ○ 金額表示_ポップ広告       │
│   2025-06-22 問い合わせ     │
├─────────────────────────────┤
│         [架電開始]          │
└─────────────────────────────┘
```

---

## Step 6: /api/calls/route.ts の作成・修正

src/app/api/calls/route.ts を確認し、以下の処理が実装されているか確認・修正する。

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
      list_record_id,                         // 顧客への紐づけ（必須）
      lead_id: lead_id ?? null,               // リードへの紐づけ（任意）
      called_at: called_at ?? new Date().toISOString(),
      agent_name: agent_name ?? null,
      call_result: null,                      // 終了時にPATCHで更新
    })
    .select()
    .single();

  if (error) {
    console.error('calls insert error:', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // trg_update_last_call が自動発火 → list_recordsの最終コール情報が更新される
  // trg_sync_lead_from_call が自動発火 → leadsのcall_count等が更新される

  return NextResponse.json({ ok: true, call: data });
}
```

### PATCH（コール結果更新）

```typescript
export async function PATCH(request: Request) {
  const supabase = createAdminClient();
  const body = await request.json();

  const { id, call_result, call_end_time, duration_seconds, appo_detail, memo } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('calls')
    .update({
      call_result,
      duration_seconds: duration_seconds ?? null,
      appo_detail: appo_detail ?? null,
      memo: memo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // トリガーが自動発火:
  // → leads.status / appo_at / call_count が自動更新される
  // → list_records.last_call_result が自動更新される

  return NextResponse.json({ ok: true });
}
```

---

## Step 7: 環境変数の補完

.env.local に以下を追加・確認する:

```bash
# Meta Webhookの検証トークン（任意の文字列でOK、Meta側と揃えること）
META_WEBHOOK_VERIFY_TOKEN=your_verify_token_here

# FM Webhook認証（FMスクリプトからのPOST認証用）
FM_WEBHOOK_SECRET=your_fm_secret_here
```

/api/webhooks/filemaker/route.ts に認証チェックが実装されているか確認:

```typescript
// FMからのWebhookに認証ヘッダーチェックを追加
const secret = request.headers.get('x-fm-secret');
if (process.env.FM_WEBHOOK_SECRET && secret !== process.env.FM_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Step 8: ビルド確認・デプロイ

### 8-1. 型エラー確認

```bash
npx tsc --noEmit
```

エラーが出た場合は全て修正すること。特に以下を確認:
- `leads.list_record_id` の型不一致
- `calls.list_record_id` の型不一致
- `calls.lead_id` の NOT NULL 制約（nullable に変更すること）

### 8-2. ビルド確認

```bash
npm run build
```

### 8-3. デプロイ

```bash
git add -A && git commit -m "feat: leads・calls・list_records 完全連携実装"
vercel --prod
```

---

## Step 9: 動作確認

### 9-1. 新規リードのWebhookテスト

```bash
curl -X POST https://sooon-crm.vercel.app/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "09011112222",
    "ad_name": "テスト広告_新規",
    "company_name": "新規テスト会社",
    "representative_name": "新規テスト太郎",
    "prefecture": "大阪府"
  }'
```

期待するレスポンス:
```json
{ "ok": true, "customer_id": "CS0180514" }
```

### 9-2. 重複リードのテスト（同一電話番号）

```bash
curl -X POST https://sooon-crm.vercel.app/api/webhooks/meta \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "09011112222",
    "ad_name": "別の広告_再問い合わせ",
    "company_name": "新規テスト会社"
  }'
```

期待する動作: 同一 list_record_id に紐づく leads が2件になる

### 9-3. Supabaseで結合確認

```sql
-- 全テーブル結合確認（最新10件）
SELECT
  lr.customer_id,
  lr.company_name,
  COUNT(DISTINCT l.id) as lead_count,
  COUNT(DISTINCT c.id) as call_count,
  MAX(l.ad_name) as latest_ad,
  MAX(l.inquiry_at) as latest_inquiry,
  lr.last_call_result,
  COALESCE(SUM(d.amount), 0) as total_deal
FROM list_records lr
LEFT JOIN leads l ON l.list_record_id = lr.id
LEFT JOIN calls c ON c.list_record_id = lr.id
LEFT JOIN deals d ON d.list_record_id = lr.id
WHERE lr.tenant_id = current_setting('app.tenant_id', true)::uuid
GROUP BY lr.id, lr.customer_id, lr.company_name, lr.last_call_result
ORDER BY MAX(l.inquiry_at) DESC NULLS LAST
LIMIT 10;

-- 広告別集計（CPO計算用）
SELECT
  l.ad_name,
  COUNT(DISTINCT l.id) as lead_count,
  COUNT(DISTINCT c.id) as total_calls,
  ROUND(COUNT(DISTINCT c.id)::numeric / NULLIF(COUNT(DISTINCT l.id), 0), 2) as avg_calls_per_lead,
  COUNT(DISTINCT CASE WHEN l.appo_at IS NOT NULL THEN l.id END) as appo_count,
  ROUND(
    COUNT(DISTINCT CASE WHEN l.appo_at IS NOT NULL THEN l.id END)::numeric
    / NULLIF(COUNT(DISTINCT l.id), 0) * 100, 1
  ) as appo_rate_pct,
  COUNT(DISTINCT CASE WHEN l.status = '受注' THEN l.id END) as won_count
FROM leads l
LEFT JOIN calls c ON c.lead_id = l.id
WHERE l.tenant_id = (SELECT id FROM tenants LIMIT 1)
GROUP BY l.ad_name
ORDER BY lead_count DESC;
```

---

## 完了条件チェックリスト

### DB
- [ ] calls に list_record_id カラムがある
- [ ] trg_update_last_call が INSERT/UPDATE 両方で発火する
- [ ] 既存leadsの名寄せ結果を確認（matched件数）

### API
- [ ] /api/webhooks/meta で新規リード → list_records + leads + webhook_leads が同時作成される
- [ ] /api/webhooks/meta で重複リード → 既存list_recordsに紐づくleadsが追加される
- [ ] /api/webhook-leads/add-to-list で「追加」ボタン押下後 leads にも登録される
- [ ] /api/calls POST で list_record_id + lead_id の両方がセットされる
- [ ] /api/calls PATCH でコール結果更新後 trg_sync_lead_from_call が発火してleadsが更新される
- [ ] /api/webhooks/filemaker に認証ヘッダーチェックがある

### UI
- [ ] /list/[id] の「開始」ボタンでリード選択モーダルが出る（複数リードの場合）
- [ ] 架電開始後 calls テーブルにレコードが作成される

### 集計
- [ ] Step 9-3 の確認クエリが正しいデータを返す
- [ ] 広告別集計でリード数・架電数・アポ率が表示される
```
