# FM同期 実装指示書 — sooon-crm
# tenant_id: dde9bea6-a017-49e6-a1b6-88494e1e3b4d
# このファイルをClaude Codeにそのまま渡して実行させること

---

## 前提・確定済み設計

### FMバージョン
- FileMaker Pro 22.0.4 (クラウド版)
- Data API: `/fmi/data/v1/` エンドポイント
- **最初にやること**: Vercel環境変数に以下を追加し、curl疎通確認を行う

```bash
# 疎通確認コマンド（ローカルで実行）
curl -sk -X POST \
  "https://${FM_HOST}/fmi/data/v1/databases/${FM_DATABASE}/sessions" \
  -H "Content-Type: application/json" \
  -d '{"fmDataSource": []}' \
  -u "${FM_USERNAME}:${FM_PASSWORD}"
# → {"response":{"token":"..."}} が返れば接続OK
```

### 紐づけルール（確定）
- `calls.list_record_id` → `list_records.id`（UUID外部キー）
- `calls`をFMから取り込む際は `customer_id`（CS番号）で `list_records` を名寄せして `list_record_id` をセット
- `webhook_leads` と `list_records` は `phone_numbers` で照合（一致→既存レコード更新、不一致→pending保存）
- `fm_record_id` が同期の重複防止キー（list_records・calls両方に持つ）

---

## STEP 0: 環境変数追加

`.env.local` および Vercel ダッシュボードに追加：

```env
# FileMaker Data API
FM_HOST=                    # 例: your-server.filemaker-cloud.com
FM_DATABASE=                # データベース名
FM_USERNAME=                # FMアカウント
FM_PASSWORD=                # FMパスワード
FM_LAYOUT_LIST=リスト情報   # リスト情報レイアウト名（FMで確認）
FM_LAYOUT_CALLS=コール履歴  # コール履歴レイアウト名（FMで確認）
CRON_SECRET=                # 任意のランダム文字列（openssl rand -hex 32）
```

---

## STEP 1: Supabaseスキーマ確認・追加

### 1-1. 既存 list_records に不足カラムがあれば追加

```sql
-- list_recordsにfm_record_idがなければ追加
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS fm_record_id text;
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS fm_modification_id text;
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS customer_id text;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_list_records_fm_record ON list_records(fm_record_id);
CREATE INDEX IF NOT EXISTS idx_list_records_customer_id ON list_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_list_records_phone ON list_records USING GIN(phone_numbers);
```

### 1-2. callsテーブルを FM_IMPLEMENTATION.md の定義に置き換え

```sql
-- 既存callsテーブルをdrop & recreate
DROP TABLE IF EXISTS calls CASCADE;

CREATE TABLE calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  list_record_id uuid NOT NULL REFERENCES list_records(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES tenant_members(id),

  -- FMコール履歴フィールド完全再現
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  call_start_time text,
  call_end_date date,
  call_end_time text,
  call_number int NOT NULL DEFAULT 1,
  agent_name text,
  call_result text,
  call_category text,
  reissue_pending text,
  list_name text,
  rep_level text,
  rep_level2 text,
  ci text,
  appo_detail text,
  call_duration_minutes float,

  -- AI CRM OS独自
  direction text NOT NULL DEFAULT 'outbound',
  audio_r2_key text,
  custom_data jsonb NOT NULL DEFAULT '{}',

  -- FM連携用
  fm_record_id text,  -- TAxxxxxx相当

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calls_list_record ON calls(list_record_id);
CREATE INDEX idx_calls_tenant ON calls(tenant_id);
CREATE INDEX idx_calls_date ON calls(call_date DESC);
CREATE INDEX idx_calls_result ON calls(call_result);
CREATE INDEX idx_calls_fm_record ON calls(fm_record_id);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON calls
  USING (tenant_id = (SELECT tenant_id FROM tenant_members WHERE clerk_user_id = auth.uid()::text LIMIT 1));
```

### 1-3. trg_update_last_call トリガー作成

```sql
CREATE OR REPLACE FUNCTION update_last_call_info()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE list_records SET
    last_call_date        = NEW.call_date,
    last_call_start_time  = NEW.call_start_time,
    last_call_end_time    = NEW.call_end_time,
    last_call_agent       = NEW.agent_name,
    last_call_result      = NEW.call_result,
    last_call_category    = NEW.call_category,
    last_call_count       = (SELECT COUNT(*) FROM calls WHERE list_record_id = NEW.list_record_id),
    last_call_list_name   = NEW.list_name,
    last_call_rep_level   = NEW.rep_level,
    last_call_rep_level2  = NEW.rep_level2,
    last_call_appo_detail = NEW.appo_detail,
    updated_at            = now()
  WHERE id = NEW.list_record_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_last_call
  AFTER INSERT OR UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_last_call_info();
```

### 1-4. webhook_leads の電話番号照合用インデックス

```sql
-- webhook_leadsのphone照合用
ALTER TABLE webhook_leads ADD COLUMN IF NOT EXISTS phone_normalized text;
CREATE INDEX IF NOT EXISTS idx_webhook_leads_phone ON webhook_leads(phone_normalized);
```

---

## STEP 2: FMクライアント実装

### ファイル: `src/lib/filemaker/client.ts`

```typescript
// FileMaker Data API クライアント
// FM Cloud v22対応

const FM_BASE = `https://${process.env.FM_HOST}/fmi/data/v1/databases/${process.env.FM_DATABASE}`;

let _token: string | null = null;
let _tokenExpiry: number = 0;

export async function getFMToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await fetch(`${FM_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(
        `${process.env.FM_USERNAME}:${process.env.FM_PASSWORD}`
      ).toString('base64')}`,
    },
    body: JSON.stringify({ fmDataSource: [] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FM auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  _token = data.response.token;
  _tokenExpiry = Date.now() + 14 * 60 * 1000; // 14分（FMトークンは15分）
  return _token!;
}

export async function fmGetRecords(
  layout: string,
  params: {
    _offset?: number;
    _limit?: number;
    _sort?: { fieldName: string; sortOrder: 'ascend' | 'descend' }[];
    query?: Record<string, string>[];
  } = {}
) {
  const token = await getFMToken();
  const searchParams = new URLSearchParams();
  if (params._offset) searchParams.set('_offset', String(params._offset));
  if (params._limit)  searchParams.set('_limit',  String(params._limit));
  if (params._sort)   searchParams.set('_sort',   JSON.stringify(params._sort));

  const url = `${FM_BASE}/layouts/${encodeURIComponent(layout)}/records?${searchParams}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`FM getRecords failed: ${res.status}`);
  return res.json();
}

export async function fmFindRecords(
  layout: string,
  query: Record<string, string>[],
  params: { _offset?: number; _limit?: number } = {}
) {
  const token = await getFMToken();
  const res = await fetch(`${FM_BASE}/layouts/${encodeURIComponent(layout)}/_find`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, ...params }),
  });

  if (res.status === 401) {
    // トークン期限切れ → 再取得してリトライ
    _token = null;
    return fmFindRecords(layout, query, params);
  }
  if (!res.ok) throw new Error(`FM findRecords failed: ${res.status}`);
  return res.json();
}

export async function fmLogout() {
  if (!_token) return;
  await fetch(`${FM_BASE}/sessions/${_token}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${_token}` },
  });
  _token = null;
}
```

---

## STEP 3: フィールドマッパー実装

### ファイル: `src/lib/filemaker/mappers.ts`

```typescript
// FMフィールド名 → Supabaseカラム名 マッピング
// FMのコール履歴レイアウトのフィールド名を元に作成

// ---- リスト情報 → list_records ----
export function mapFMListToSupabase(fmFields: Record<string, unknown>) {
  return {
    customer_id:           fmFields['顧客ID']         ?? null,
    ad_name:               fmFields['ADNAME']          ?? fmFields['広告名'] ?? null,
    list_handover_date:    parseDateJP(fmFields['リスト譲渡日'] as string),
    list_name:             fmFields['リスト']          ?? null,
    industry:              fmFields['業種']            ?? null,
    newcomer_flag:         fmFields['新人フラグ']       ?? null,
    list_created_at:       parseDateTimeJP(fmFields['リスト作成日時'] as string),
    company_name:          fmFields['会社名']          ?? null,
    representative_name:   fmFields['代表名']          ?? null,
    title:                 fmFields['役職']            ?? null,
    regular_holidays:      parseHolidays(fmFields['定休日'] as string),
    prefecture:            fmFields['都道府県']        ?? null,
    phone_numbers:         parsePhones(fmFields['電話番号'] as string),
    company_email:         fmFields['会社mail']        ?? null,
    business_start_time:   fmFields['営業開始']        ?? null,
    business_end_time:     fmFields['営業終了']        ?? null,
    address:               fmFields['住所']            ?? null,
    recall_date:           parseDateJP(fmFields['再コール日'] as string),
    recall_time:           fmFields['再コール時刻']    ?? null,
    list_screening:        fmFields['リスト精査']      ?? null,
    homepage_url:          fmFields['ホームページURL'] ?? null,
    meo_status:            parseMEO(fmFields['MEO'] as string),
    case_memo:             fmFields['案件メモ']        ?? null,
    pre_setup_date:        parseDateJP(fmFields['前設日'] as string),
    pre_setup_agent:       fmFields['前設担当']        ?? null,
    sales_agent:           fmFields['営業担当']        ?? null,
  };
}

// ---- コール履歴 → calls ----
export function mapFMCallToSupabase(fmFields: Record<string, unknown>) {
  return {
    // customer_id は呼び出し側で list_record_id に変換する
    fm_customer_id:        fmFields['顧客ID']         as string | null,
    call_date:             parseDateJP(fmFields['コール開始日'] as string),
    call_start_time:       fmFields['コール開始時刻'] as string | null,
    call_end_date:         parseDateJP(fmFields['コール終了日'] as string),
    call_end_time:         fmFields['コール終了時刻'] as string | null,
    call_number:           Number(fmFields['コール回数'] ?? 1),
    agent_name:            fmFields['担当者名']        as string | null,
    call_result:           fmFields['コール結果']      as string | null,
    call_category:         fmFields['対応カテゴリ']    as string | null,
    reissue_pending:       fmFields['再出し/ペンディング'] as string | null,
    list_name:             fmFields['リスト名']        as string | null,
    rep_level:             fmFields['代表レベル']      as string | null,
    rep_level2:            fmFields['代表レベル2']     as string | null,
    ci:                    fmFields['CI']              as string | null,
    appo_detail:           fmFields['アポ情報詳細']    as string | null,
    call_duration_minutes: parseFloat(String(fmFields['コール時間_分'] ?? '0')) || null,
  };
}

// ---- ヘルパー関数 ----
function parseDateJP(val?: string): string | null {
  if (!val) return null;
  // FM形式: "2025/04/15" または "04/15/2025" → ISO "2025-04-15"
  const m = val.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  const m2 = val.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
  return null;
}

function parseDateTimeJP(val?: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString().replace('Z', '+00:00');
}

function parsePhones(val?: string): string[] {
  if (!val) return [];
  return val.split(/[,\n、]/).map(s => s.trim()).filter(Boolean);
}

function parseHolidays(val?: string): string[] {
  if (!val) return [];
  return val.split(/[,、\s]/).map(s => s.trim()).filter(Boolean);
}

function parseMEO(val?: string): string[] {
  if (!val) return [];
  return val.split(/[,、]/).map(s => s.trim()).filter(Boolean);
}
```

---

## STEP 4: 同期ロジック実装

### ファイル: `src/lib/filemaker/sync.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { fmGetRecords, fmLogout } from './client';
import { mapFMListToSupabase, mapFMCallToSupabase } from './mappers';

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';
const BATCH_SIZE = 100;

// ---- リスト情報同期 ----
export async function syncListRecords(sinceModified?: string) {
  const supabase = await createClient();
  const layout = process.env.FM_LAYOUT_LIST!;
  let offset = 1;
  let totalSynced = 0;
  let totalErrors = 0;

  while (true) {
    const result = await fmGetRecords(layout, {
      _offset: offset,
      _limit: BATCH_SIZE,
      _sort: [{ fieldName: '修正タイムスタンプ', sortOrder: 'ascend' }],
    });

    const records = result.response?.data ?? [];
    if (records.length === 0) break;

    for (const rec of records) {
      try {
        const fmRecordId = String(rec.recordId);
        const fields = rec.fieldData as Record<string, unknown>;

        // 修正タイムスタンプ確認（デルタ同期）
        if (sinceModified && fields['修正タイムスタンプ']) {
          if (String(fields['修正タイムスタンプ']) <= sinceModified) continue;
        }

        const mapped = mapFMListToSupabase(fields);
        const customerId = fields['顧客ID'] as string | null;

        const { error } = await supabase
          .from('list_records')
          .upsert({
            tenant_id: TENANT_ID,
            fm_record_id: fmRecordId,
            fm_modification_id: String(fields['修正タイムスタンプ'] ?? ''),
            ...mapped,
          }, {
            onConflict: 'fm_record_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`list upsert error [${fmRecordId}]:`, error.message);
          totalErrors++;
        } else {
          totalSynced++;
        }
      } catch (e) {
        console.error('list sync row error:', e);
        totalErrors++;
      }
    }

    if (records.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  await fmLogout();
  return { totalSynced, totalErrors };
}

// ---- コール履歴同期 ----
export async function syncCalls(sinceModified?: string) {
  const supabase = await createClient();
  const layout = process.env.FM_LAYOUT_CALLS!;
  let offset = 1;
  let totalSynced = 0;
  let totalErrors = 0;

  // customer_id → list_records.id のキャッシュ
  const customerIdCache = new Map<string, string>();

  const getListRecordId = async (customerId: string): Promise<string | null> => {
    if (customerIdCache.has(customerId)) return customerIdCache.get(customerId)!;

    const { data } = await supabase
      .from('list_records')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('customer_id', customerId)
      .single();

    if (data?.id) {
      customerIdCache.set(customerId, data.id);
      return data.id;
    }
    return null;
  };

  while (true) {
    const result = await fmGetRecords(layout, {
      _offset: offset,
      _limit: BATCH_SIZE,
      _sort: [{ fieldName: '修正タイムスタンプ', sortOrder: 'ascend' }],
    });

    const records = result.response?.data ?? [];
    if (records.length === 0) break;

    for (const rec of records) {
      try {
        const fmRecordId = String(rec.recordId);
        const fields = rec.fieldData as Record<string, unknown>;

        if (sinceModified && fields['修正タイムスタンプ']) {
          if (String(fields['修正タイムスタンプ']) <= sinceModified) continue;
        }

        const mapped = mapFMCallToSupabase(fields);
        const customerId = mapped.fm_customer_id;

        if (!customerId) {
          totalErrors++;
          continue;
        }

        const listRecordId = await getListRecordId(customerId);
        if (!listRecordId) {
          // list_recordsに親レコードがない → スキップ（後でlist同期後に再実行）
          console.warn(`No list_record for customer_id: ${customerId}`);
          totalErrors++;
          continue;
        }

        const { fm_customer_id, ...callData } = mapped;
        const { error } = await supabase
          .from('calls')
          .upsert({
            tenant_id: TENANT_ID,
            list_record_id: listRecordId,
            fm_record_id: fmRecordId,
            ...callData,
          }, {
            onConflict: 'fm_record_id',
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`call upsert error [${fmRecordId}]:`, error.message);
          totalErrors++;
        } else {
          totalSynced++;
        }
      } catch (e) {
        console.error('call sync row error:', e);
        totalErrors++;
      }
    }

    if (records.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  await fmLogout();
  return { totalSynced, totalErrors };
}
```

---

## STEP 5: Cron APIルート実装

### ファイル: `src/app/api/cron/sync-fm/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncListRecords, syncCalls } from '@/lib/filemaker/sync';

export const maxDuration = 300; // 5分（Vercel Pro）

export async function POST(req: NextRequest) {
  // Cron認証
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fullSync = body.fullSync === true;

  try {
    // デルタ同期: 前回同期時刻を取得
    const supabase = await createClient();
    let sinceModified: string | undefined;

    if (!fullSync) {
      const { data } = await supabase
        .from('sync_logs')
        .select('synced_at')
        .eq('type', 'fm_list')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single();
      sinceModified = data?.synced_at;
    }

    // 1. リスト情報を先に同期（callsの親なので必ず先）
    const listResult = await syncListRecords(sinceModified);

    // 2. コール履歴を同期
    const callResult = await syncCalls(sinceModified);

    // 3. 同期ログ記録
    await supabase.from('sync_logs').insert({
      type: 'fm_list',
      synced_at: new Date().toISOString(),
      records_synced: listResult.totalSynced,
      errors: listResult.totalErrors,
    });
    await supabase.from('sync_logs').insert({
      type: 'fm_calls',
      synced_at: new Date().toISOString(),
      records_synced: callResult.totalSynced,
      errors: callResult.totalErrors,
    });

    return NextResponse.json({
      success: true,
      list: listResult,
      calls: callResult,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('sync-fm error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron からのGETも受け付ける
export async function GET(req: NextRequest) {
  return POST(req);
}
```

### sync_logs テーブル追加（Supabaseで実行）

```sql
CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  type text NOT NULL,           -- fm_list / fm_calls / webhook
  synced_at timestamptz NOT NULL DEFAULT now(),
  records_synced int DEFAULT 0,
  errors int DEFAULT 0,
  meta jsonb DEFAULT '{}'
);
CREATE INDEX idx_sync_logs_type ON sync_logs(type, synced_at DESC);
```

---

## STEP 6: Vercel Cron設定

### `vercel.json` に追加（プロジェクトルート）

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-fm",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## STEP 7: webhook_leads ↔ list_records 照合ロジック

### ファイル: `src/lib/leads/phone-match.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

const TENANT_ID = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';

// 電話番号を正規化（数字のみ・先頭の81/+81を0に変換）
export function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('81')) normalized = '0' + normalized.slice(2);
  return normalized;
}

// webhook_leadのphone_numberでlist_recordsを照合
export async function matchOrCreateListRecord(webhookLeadId: string) {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('webhook_leads')
    .select('*')
    .eq('id', webhookLeadId)
    .single();

  if (!lead) throw new Error('webhook_lead not found');

  const rawPhone = lead.raw_data?.phone_number ?? lead.raw_data?.電話番号 ?? '';
  const normalized = normalizePhone(String(rawPhone));

  if (!normalized) {
    return { matched: false, listRecordId: null };
  }

  // list_records.phone_numbers (jsonb配列) 内で照合
  const { data: existing } = await supabase
    .from('list_records')
    .select('id, phone_numbers')
    .eq('tenant_id', TENANT_ID)
    .contains('phone_numbers', JSON.stringify([normalized]))
    .limit(1)
    .single();

  if (existing) {
    // 一致 → 既存リストのwebhook_lead_idを更新
    await supabase
      .from('list_records')
      .update({
        webhook_lead_id: webhookLeadId,
        source: 'meta_ads',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    await supabase
      .from('webhook_leads')
      .update({
        status: 'added',
        added_to_list_id: existing.id,
        added_at: new Date().toISOString(),
      })
      .eq('id', webhookLeadId);

    return { matched: true, listRecordId: existing.id };
  }

  // 不一致 → pendingのまま（手動承認待ち）
  return { matched: false, listRecordId: null };
}

// 手動承認: webhook_leadをlist_recordsに昇格
export async function promoteWebhookLead(webhookLeadId: string, addedBy: string) {
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from('webhook_leads')
    .select('*')
    .eq('id', webhookLeadId)
    .single();

  if (!lead || lead.status !== 'pending') throw new Error('Lead not found or already processed');

  const rawPhone = lead.raw_data?.phone_number ?? '';
  const normalized = normalizePhone(String(rawPhone));

  const { data: newRecord, error } = await supabase
    .from('list_records')
    .insert({
      tenant_id: TENANT_ID,
      source: 'meta_ads',
      ad_name: lead.ad_name ?? lead.raw_data?.広告名,
      company_name: lead.mapped_data?.company_name ?? lead.raw_data?.会社名,
      representative_name: lead.mapped_data?.representative_name ?? lead.raw_data?.代表名,
      title: lead.mapped_data?.title ?? lead.raw_data?.役職,
      prefecture: lead.mapped_data?.prefecture ?? lead.raw_data?.県名,
      phone_numbers: normalized ? [normalized] : [],
      webhook_lead_id: webhookLeadId,
      source_data: lead.raw_data ?? {},
    })
    .select('id')
    .single();

  if (error || !newRecord) throw new Error(`Failed to create list_record: ${error?.message}`);

  await supabase
    .from('webhook_leads')
    .update({
      status: 'added',
      added_to_list_id: newRecord.id,
      added_at: new Date().toISOString(),
      added_by: addedBy,
    })
    .eq('id', webhookLeadId);

  return { listRecordId: newRecord.id };
}
```

---

## STEP 8: 実装確認チェックリスト

実装後、以下を全て確認すること:

```
[ ] curl疎通確認: FM CloudにHTTPS(443)で到達できる
[ ] list_recordsにfm_record_id, customer_idカラムが存在する
[ ] callsテーブルがFM_IMPLEMENTATION.mdの定義通りに再作成されている
[ ] trg_update_last_callトリガーが存在する（supabase→table editor→triggers）
[ ] sync_logsテーブルが存在する
[ ] 環境変数 FM_HOST, FM_DATABASE, FM_USERNAME, FM_PASSWORD, CRON_SECRET が設定済み
[ ] /api/cron/sync-fm に POST して { list: { totalSynced: N }, calls: { totalSynced: N } } が返る
[ ] 手動フルシンク: POST /api/cron/sync-fm body={"fullSync":true} でリスト情報がSupabaseに入る
[ ] callsのlist_record_idがlist_records.idに正しく紐づいている
[ ] phone-match.tsのnormalizePhoneで "818052800503" → "08052800503" に変換される
[ ] vercel.jsonのcron設定が反映されている（Vercel Dashboard → Settings → Cron Jobs）
```

---

## 注意事項

1. **FMフィールド名は推測禁止** — 実際のFMレイアウトを開いて正確なフィールド名を確認してからmappers.tsを修正すること
2. **リスト情報を必ずcallsより先に同期** — callsはlist_record_idが必要なため
3. **FM Cloudのポート** — FileMaker Cloudは443のみ。ファイアウォール設定不要
4. **デルタ同期キー** — FMの`修正タイムスタンプ`フィールドが存在しない場合はフルシンクのみに切り替える
5. **RLSポリシー** — callsテーブルのRLSは必ずSERVICE_ROLE_KEYで同期処理を行うこと（anonymousキーでは失敗する）

---

_このプロンプトはsooon-crmプロジェクト用 — 2026-04-30 設計確定_
