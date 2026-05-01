# FileMaker同期設計書（FM_SYNC_DESIGN.md）
# Phase 1: FM→Supabase 片方向 → Phase 3: 双方向化対応構造
# 2026年4月26日 統合決定版 v3

---

## 1. 設計思想

### 1.1 段階的移行戦略

```
Phase 1 (現フェーズ):
   ┌───────────┐   FM Data API   ┌──────────────┐
   │ FileMaker │  ───────────▶   │   Supabase   │
   └───────────┘   (1方向のみ)   └──────────────┘
   ★FMがマスタ                  ★読み取りミラー

Phase 3 (将来):
   ┌───────────┐   FM Data API   ┌──────────────┐
   │ FileMaker │  ◀────────────▶  │   Supabase   │
   └───────────┘   (双方向)       └──────────────┘
   ★競合解決ルールあり
```

**Phase 1の方針:**
- 安全に1次情報を蓄積することが最優先
- FMの既存運用を一切変えない
- CRM画面では編集UI表示するが、保存時は内部キューに積むのみ（実FMには書き込まない）
- データ齟齬が発生しても、FMが正として上書きされる安全設計

**Phase 3への準備:**
- `fm_sync_queue` テーブルは Phase 1 から作成
- CRM側の編集アクションは「キュー登録ロジック」を必ず通す
- ただし `enabled=false` フラグで実際の送信は停止
- Phase 3で `enabled=true` に切り替えるだけで双方向化が即座に有効

---

## 2. データフロー（Phase 1）

```
[FileMaker Pro/Server]
  │
  │ FM Data API（HTTPS）
  │ レイアウト: リスト情報 / コール履歴
  ▼
[Next.js API Route]
  src/app/api/cron/sync-fm/route.ts
  │
  ├─ 認証: FM_USERNAME / FM_PASSWORD でセッショントークン取得
  ├─ 差分取得: 修正タイムスタンプ > last_sync_at
  ├─ ページング: 100件ずつ取得
  └─ マッパー: src/lib/filemaker/mappers.ts
  │
  ▼
[Supabase]
  customers / leads / calls / deals テーブルに upsert
  fm_sync_log に履歴記録
```

### 2.1 トリガー

| 種別 | トリガー | 頻度 |
|-----|---------|------|
| 定期同期 | Vercel Cron | 毎時0分 |
| 手動同期 | `/api/cron/sync-fm?manual=true&since=...` | UI操作 |
| Webhook（オプション） | FMスクリプト → `/api/fm/webhook` | リアルタイム |

### 2.2 重要な前提

- FMの「修正タイムスタンプ」フィールドが必須（未存在なら `field_mappings` で代替指定）
- `fm_record_id` で1対1紐付け
- 衝突時は **FMが常に正**（Phase 1）

---

## 3. テーブルマッピング

### 3.1 FM「リスト情報」 → Supabase

FMの「リスト情報」レイアウトは **顧客マスタ** に近い性質を持つ。
Supabaseでは `customers` + `leads` の2テーブルに分割される。

| FMフィールド | Supabaseテーブル | カラム | 備考 |
|-------------|-----------------|-------|------|
| 顧客ID | customers | customer_code | "CS0140436" 等。同一性キー |
| 会社名 | customers | company_name | |
| 代表名 | customers | representative_name | |
| 役職 | customers | title | |
| 業種 | customers | industry | |
| 都道府県 | customers | prefecture | |
| 住所 | customers | address | |
| 会社mail | customers | email | |
| 電話番号 | customers | primary_phone | 1番目を主、複数なら phone_numbers |
| 電話番号（複数） | customers | phone_numbers | jsonb配列に格納 |
| 営業開始/終了 | customers | business_start_time / business_end_time | |
| 定休日 | customers | regular_holidays | jsonb配列 |
| ホームページ | customers | homepage_url | |
| MEO | customers | meo_status | jsonb配列 |
| ─── | ─── | ─── | ─── |
| ADNAME（広告名） | leads | ad_name | リード単位 |
| リスト譲渡日 | leads | list_handover_date | |
| リスト | leads | custom_data.list_name | |
| 新人フラグ | leads | custom_data.newcomer_flag | |
| リスト作成日時 | leads | inquiry_at | 流入日時として使用 |
| 再コール日 | leads | recall_date | |
| 再コール時刻 | leads | recall_time | |
| リスト精査 | leads | custom_data.list_screening | |
| 案件メモ | leads | custom_data.case_memo | |
| 前設日 | leads | custom_data.pre_setup_date | |
| 前設担当 | leads | custom_data.pre_setup_agent | |
| 営業担当 | leads | custom_data.sales_agent | |
| 修正タイムスタンプ | customers / leads | fm_synced_at（参考保持） | 差分取得キー |
| FMレコードID | customers / leads | fm_record_id | |

### 3.2 FM「コール履歴」 → Supabase calls

FMの「コール履歴」は1架電1レコード。

| FMフィールド | Supabaseカラム | 備考 |
|-------------|---------------|------|
| 顧客ID | customer_id | customers.customer_code から逆引き |
| 対応履歴ID | fm_record_id | "TA0000150" 等 |
| コール結果 | result | "NG" / "留守" / "決め" / "アポOK" 等 |
| コール開始日 | started_at （日付部分） | |
| コール開始時刻 | started_at （時刻部分） | |
| コール終了時刻 | ended_at | |
| コール開始曜日 | day_of_week | "(火)" 等 |
| コール時間_秒 | duration_seconds | |
| 担当者名 | agent_display_name | |
| クライアント識別 | custom_data.client_id | "asa8a9e" 等 |
| 代表hit | rep_hit | "ヒット" or null |
| CL | cl | |
| リストレベル | rep_level | "3R" 等 |
| 対応カテゴリ | category | "受付拒否" / "即NG" 等 |
| 担当レベル | rep_level2 | |
| アポ情報詳細 | appo_detail | |

### 3.3 FMにあってSupabaseに対応カラムがない項目

すべて `custom_data jsonb` に格納する。
キーはFMのフィールド名をスネークケース変換（例: `代表hit` → `rep_hit`）。

`field_mappings` テーブルで明示的に管理：

```sql
INSERT INTO field_mappings (
  tenant_id, source_type, source_field,
  target_table, target_field, transform_type
) VALUES
  ('<tenant>', 'fm_list', '案件メモ', 'leads', 'custom_data.case_memo', 'jsonb_path'),
  ('<tenant>', 'fm_calls', 'クライアント識別', 'calls', 'custom_data.client_id', 'jsonb_path');
```

---

## 4. 同期実装

### 4.1 ディレクトリ構成

```
src/lib/filemaker/
├── client.ts        # FM Data API HTTPクライアント
├── auth.ts          # セッショントークン管理
├── sync.ts          # 同期メインロジック（差分検出・upsert）
├── mappers.ts       # FMフィールド→Supabaseカラム変換
└── types.ts         # FMレコード型定義
```

### 4.2 client.ts の設計

```typescript
// src/lib/filemaker/client.ts
import { FM_HOST, FM_DATABASE, FM_USERNAME, FM_PASSWORD } from '@/lib/env';

export class FileMakerClient {
  private token: string | null = null;
  private tokenExpires: Date | null = null;

  async authenticate() {
    if (this.token && this.tokenExpires && this.tokenExpires > new Date()) {
      return this.token;
    }
    const res = await fetch(
      `https://${FM_HOST}/fmi/data/v1/databases/${FM_DATABASE}/sessions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${FM_USERNAME}:${FM_PASSWORD}`).toString('base64'),
        },
      }
    );
    const data = await res.json();
    this.token = data.response.token;
    this.tokenExpires = new Date(Date.now() + 14 * 60 * 1000); // 14分後（FMは15分）
    return this.token;
  }

  async findRecords(layout: string, query: any, opts: { limit?: number; offset?: number; sort?: any[] } = {}) {
    const token = await this.authenticate();
    const res = await fetch(
      `https://${FM_HOST}/fmi/data/v1/databases/${FM_DATABASE}/layouts/${encodeURIComponent(layout)}/_find`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query,
          limit: opts.limit ?? 100,
          offset: opts.offset ?? 1,
          sort: opts.sort,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(`FM API error: ${JSON.stringify(data.messages)}`);
    return data.response.data;
  }
}
```

### 4.3 sync.ts の設計（差分同期）

```typescript
// src/lib/filemaker/sync.ts
import { createServerSupabase } from '@/lib/supabase/server';
import { FileMakerClient } from './client';
import { mapFmListToSupabase, mapFmCallToSupabase } from './mappers';

export async function syncFmList(tenantId: string, since: Date) {
  const fm = new FileMakerClient();
  const supabase = createServerSupabase();
  const sinceFmFormat = formatFmTimestamp(since);

  // FMから差分取得（修正タイムスタンプ > since）
  let offset = 1;
  const pageSize = 100;
  let totalUpserted = 0;

  // 同期ログ開始
  const { data: log } = await supabase.from('fm_sync_log').insert({
    tenant_id: tenantId,
    sync_direction: 'fm_to_supabase',
    sync_type: 'delta',
    target_layout: 'リスト情報',
    status: 'running',
  }).select().single();

  try {
    while (true) {
      const records = await fm.findRecords(
        'リスト情報',
        [{ '修正タイムスタンプ': `>=${sinceFmFormat}` }],
        { limit: pageSize, offset, sort: [{ fieldName: '修正タイムスタンプ', sortOrder: 'ascend' }] }
      );

      if (records.length === 0) break;

      for (const fmRec of records) {
        const { customer, lead } = mapFmListToSupabase(fmRec, tenantId);

        // customers をupsert（customer_code で一意）
        const { data: cust } = await supabase
          .from('customers')
          .upsert(customer, { onConflict: 'tenant_id,customer_code' })
          .select('id')
          .single();

        // leads をupsert（fm_record_id で一意 / 同じFMレコードの重複防止）
        if (cust) {
          await supabase.from('leads').upsert(
            { ...lead, customer_id: cust.id },
            { onConflict: 'tenant_id,fm_record_id' }
          );
        }

        totalUpserted++;
      }

      offset += pageSize;
      if (records.length < pageSize) break;
    }

    await supabase.from('fm_sync_log').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      records_total: totalUpserted,
      records_updated: totalUpserted,
    }).eq('id', log!.id);

    return { upserted: totalUpserted };
  } catch (error) {
    await supabase.from('fm_sync_log').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error_log: { message: String(error) },
    }).eq('id', log!.id);
    throw error;
  }
}

export async function syncFmCalls(tenantId: string, since: Date) {
  // 同様の実装。コール履歴 → calls テーブル
  // customer_id を customer_code から逆引き
  // lead_id は最新の leads から推定（同じcustomerの最新リード）or custom_dataで広告名で照合
}
```

### 4.4 Cron API Route

```typescript
// src/app/api/cron/sync-fm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncFmList, syncFmCalls } from '@/lib/filemaker/sync';
import { CRON_SECRET } from '@/lib/env';

export async function GET(req: NextRequest) {
  // Cron認証
  if (req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  const sinceParam = url.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60 * 60 * 1000); // デフォルト1時間前

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 });
  }

  const listResult = await syncFmList(tenantId, since);
  const callsResult = await syncFmCalls(tenantId, since);

  return NextResponse.json({
    list: listResult,
    calls: callsResult,
  });
}
```

### 4.5 Vercel Cron 設定

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-fm?tenant_id=<<your_tenant_uuid>>",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## 5. マッパー実装（mappers.ts）

```typescript
// src/lib/filemaker/mappers.ts
export function mapFmListToSupabase(fmRec: any, tenantId: string) {
  const fields = fmRec.fieldData;
  const portalData = fmRec.portalData ?? {};

  // 電話番号は複数対応
  const phones: string[] = [];
  for (const key of ['電話番号', '電話番号_2', '電話番号_3']) {
    if (fields[key]) phones.push(String(fields[key]));
  }

  const customer = {
    tenant_id: tenantId,
    customer_code: fields['顧客ID'] || `FM_${fmRec.recordId}`,
    primary_phone: phones[0] ?? null,
    phone_numbers: phones,
    company_name: fields['会社名'] ?? null,
    representative_name: fields['代表名'] ?? null,
    title: fields['役職'] ?? null,
    industry: fields['業種'] ?? null,
    prefecture: fields['都道府県'] ?? null,
    address: fields['住所'] ?? null,
    email: fields['会社mail'] ?? null,
    business_start_time: fields['営業開始'] ?? null,
    business_end_time: fields['営業終了'] ?? null,
    regular_holidays: parseHolidays(fields['定休日']),
    homepage_url: fields['ホームページ'] ?? null,
    meo_status: parseMeoStatus(fields['MEO']),
    fm_record_id: fmRec.recordId,
    fm_modification_id: fmRec.modId,
    fm_synced_at: new Date().toISOString(),
    custom_data: collectCustomFields(fields, [
      '顧客ID', '会社名', '代表名', '役職', '業種', '都道府県', '住所', '会社mail',
      '電話番号', '営業開始', '営業終了', '定休日', 'ホームページ', 'MEO',
    ]),
  };

  const lead = {
    tenant_id: tenantId,
    inquiry_at: fields['リスト作成日時'] ?? new Date().toISOString(),
    source: 'meta_ads', // ADNAMEから判定する場合は別ロジック
    ad_name: fields['ADNAME'] ?? null,
    list_handover_date: fields['リスト譲渡日'] ?? null,
    recall_date: fields['再コール日'] ?? null,
    recall_time: fields['再コール時刻'] ?? null,
    fm_record_id: fmRec.recordId,
    fm_synced_at: new Date().toISOString(),
    custom_data: {
      list_name: fields['リスト'],
      newcomer_flag: fields['新人フラグ'],
      list_screening: fields['リスト精査'],
      case_memo: fields['案件メモ'],
      pre_setup_date: fields['前設日'],
      pre_setup_agent: fields['前設担当'],
      sales_agent: fields['営業担当'],
    },
    source_data: {
      ad_name: fields['ADNAME'],
    },
  };

  return { customer, lead };
}

function parseHolidays(value: string | null): string[] {
  if (!value) return [];
  return ['月','火','水','木','金','土','日'].filter(d => value.includes(d));
}

function parseMeoStatus(value: any): string[] {
  // FMのMEOフィールドの実体に応じて実装
  return Array.isArray(value) ? value : [];
}

function collectCustomFields(fields: any, exclude: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(fields)) {
    if (exclude.includes(key)) continue;
    if (fields[key] === '' || fields[key] === null) continue;
    result[key] = fields[key];
  }
  return result;
}
```

---

## 6. 競合解決ルール

### 6.1 Phase 1（FM→Supabase 片方向）

- **FMが常に正**
- Supabase上で編集された値は、次回FM同期時に上書きされる
- ただしSupabase独自のカラム（`temperature`, `priority_score` 等のAI判定値）は保持される
- 同期は upsert なので、FMで削除されたレコードはSupabaseに残る（孤児化対策は別途）

### 6.2 Phase 3（双方向化時）

`fm_sync_queue` で書き込み要求を一旦キューに積む：

```typescript
// src/lib/filemaker/queue.ts
export async function enqueueFmWrite(
  tenantId: string,
  table: 'customers' | 'leads' | 'calls' | 'deals',
  recordId: string,
  operation: 'create' | 'update' | 'delete',
  payload: any
) {
  const supabase = createServerSupabase();

  // Phase 1ではenabled=falseで保存のみ（実送信なし）
  await supabase.from('fm_sync_queue').insert({
    tenant_id: tenantId,
    enabled: process.env.FM_BIDIRECTIONAL_ENABLED === 'true',
    direction: 'supabase_to_fm',
    target_table: table,
    target_record_id: recordId,
    operation,
    payload,
    status: 'queued',
  });
}
```

Phase 3 では Trigger.dev ジョブで `enabled=true` のキューを処理し、FMに書き戻す。

### 6.3 競合検知（Phase 3で実装）

```sql
-- FMの修正タイムスタンプ vs Supabaseのupdated_at
-- 両方が変更されている場合は競合
WITH conflict_check AS (
  SELECT
    l.id,
    l.updated_at AS supabase_updated,
    l.fm_synced_at,
    l.custom_data->>'fm_modification_timestamp' AS fm_updated
  FROM leads l
  WHERE l.tenant_id = $1
)
SELECT * FROM conflict_check
WHERE supabase_updated > fm_synced_at
  AND fm_updated::timestamptz > fm_synced_at;
```

競合時の解決ポリシー（テナント設定で選択可能）：
- `fm_wins`: FMが優先
- `supabase_wins`: Supabaseが優先
- `latest_wins`: 最終更新日時が新しい方
- `manual`: 管理画面で人間が選択

---

## 7. 監視・運用

### 7.1 同期状態のダッシュボード

`/settings/fm-sync-log` 画面で表示：
- 直近24時間の同期履歴
- 成功/失敗の件数
- 失敗時のエラー詳細
- 手動同期トリガー

### 7.2 アラート

以下のとき Slack 通知（Webhook）：
- 同期が3回連続で失敗
- FMセッショントークン取得失敗
- 1時間以内に同期が実行されていない

### 7.3 整合性チェック

日次cronで以下を確認し、`agent_instructions` にレポート：
- FM側のレコード数 vs Supabase側のレコード数の差
- `fm_record_id` が同じだがデータが異なるレコード
- Supabaseにあって FMにないレコード（オーファン）

---

## 8. 環境変数

```env
# FileMaker Data API
FM_HOST=fm.example.com
FM_DATABASE=Sooon_Sales_DB
FM_USERNAME=api_user
FM_PASSWORD=xxx
FM_LAYOUT_LIST=リスト情報
FM_LAYOUT_CALLS=コール履歴

# 双方向同期 (Phase 3で true に切替)
FM_BIDIRECTIONAL_ENABLED=false

# Cron認証
CRON_SECRET=xxx
```

---

## 9. テスト戦略

### 9.1 ユニットテスト

```typescript
// __tests__/filemaker/mappers.test.ts
describe('mapFmListToSupabase', () => {
  it('maps FM record to customer + lead', () => {
    const fmRec = {
      recordId: '12345',
      modId: '1',
      fieldData: {
        '顧客ID': 'CS0140436',
        '会社名': '村上工業',
        '代表名': '村上浩太',
        '電話番号': '08052800503',
        // ...
      },
    };
    const { customer, lead } = mapFmListToSupabase(fmRec, 'tenant-1');
    expect(customer.customer_code).toBe('CS0140436');
    expect(customer.primary_phone).toBe('08052800503');
  });
});
```

### 9.2 結合テスト

ローカル開発時は FileMaker のサンプルDBを用意し、`syncFmList` を実行して
Supabase に正しくupsertされることを確認する。

### 9.3 本番リハーサル

- ステージングテナントで全件同期を1回実行
- レコード数の一致を確認
- ランダムで10件ピックアップして手動で値を比較
- 問題なければ本番テナントで実行

---

## 10. 関連ドキュメント

- `REQUIREMENTS.md` — 要件定義書（全体像）
- `DB_SCHEMA.sql` — fm_sync_log / fm_sync_queue の物理定義
- `fm-import/field-mapping/` — FMフィールド名の正本（推測禁止）

---

_End of FM_SYNC_DESIGN.md_
