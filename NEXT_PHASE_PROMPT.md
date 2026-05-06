# AI CRM OS — 次フェーズ完全実装プロンプト

> **前提**: アナリティクス画面v2実装済み・ビルド成功済み。
> **このプロンプトの実行順**: 必ず上から順番に。スキップ禁止。
> **tenant_id**: `dde9bea6-a017-49e6-a1b6-88494e1e3b4d`（全クエリに必須）

---

## 【事前調査】実装前に必ず実行すること

以下のSQLをSupabaseで実行し、結果をコメントとして残してから実装を開始してください。

```sql
-- ① leadsテーブルの全カラム確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads'
ORDER BY ordinal_position;

-- ② inquiry_at / list_created_at の実データ分布確認
SELECT
  CASE
    WHEN inquiry_at IS NOT NULL THEN to_char(inquiry_at, 'YYYY-MM')
    ELSE 'NULL'
  END AS inquiry_month,
  CASE
    WHEN list_created_at IS NOT NULL THEN to_char(list_created_at, 'YYYY-MM')
    ELSE 'NULL'
  END AS list_created_month,
  COUNT(*) AS cnt
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
GROUP BY inquiry_month, list_created_month
ORDER BY inquiry_month DESC
LIMIT 30;

-- ③ 広告名未設定リードの実態
SELECT COUNT(*) AS null_ad_count, source
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND ad_name IS NULL
GROUP BY source;

-- ④ dealsテーブルの全カラム確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'deals'
ORDER BY ordinal_position;

-- ⑤ leads の initial_fee / monthly_fee 存在確認
SELECT
  COUNT(*) AS total,
  COUNT(initial_fee) AS has_initial_fee,
  COUNT(monthly_fee) AS has_monthly_fee
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';
```

---

## TASK 1: アナリティクス — データ精度の根本修正

### 1-1. 月次集計の日付ロジック最終確定

`src/app/(dashboard)/analytics/_lib/aggregations.ts` の `getLeadMonth` 関数を以下に置き換えてください。
調査①②の結果に基づいて分岐を確定してください。

```typescript
/**
 * リードの問い合わせ月を返す。
 * 優先順位: inquiry_at > list_created_at > null（created_atは絶対に使わない）
 * created_at = Supabaseへのインポート日時のため、過去データが全て2026-04になる。
 */
export function getLeadMonth(lead: Lead): string | null {
  const raw = lead.inquiry_at ?? lead.list_created_at ?? null
  if (!raw) return null

  const date = new Date(raw)
  if (isNaN(date.getTime())) return null

  const year = date.getFullYear()
  const now = new Date()

  // 異常値を除外: 2020年以前 or 現在より1ヶ月以上未来
  if (year < 2020 || date > new Date(now.getFullYear(), now.getMonth() + 1, 1)) return null

  return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
```

### 1-2. 「広告名未設定」の除外オプション追加

`AnalyticsClient.tsx` のフィルタ部分に「広告名未設定を除外」チェックボックスを追加してください。

```tsx
const [excludeNoAd, setExcludeNoAd] = useState(true) // デフォルトON

// filteredLeads の計算に追加
if (excludeNoAd) {
  leads = leads.filter(l => l.ad_name && l.ad_name.trim() !== '')
}
```

ヘッダーの期間フィルタ行の末尾に配置：

```tsx
<label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
  <input
    type="checkbox"
    checked={excludeNoAd}
    onChange={e => setExcludeNoAd(e.target.checked)}
    style={{ accentColor: '#0D9488', width: 13, height: 13 }}
  />
  広告名未設定を除外
</label>
```

### 1-3. KPIカードに「データ基準」バッジを追加

`KpiCardRow.tsx` の最下部に小さく「集計基準: inquiry_at / list_created_at」と「対象期間」を表示してください。

```tsx
<div style={{ padding: '6px 24px 8px', fontSize: 10.5, color: '#9CA3AF', borderTop: '1px solid #F1F5F9' }}>
  集計基準: 問い合わせ日（inquiry_at）優先 / 未設定はリスト作成日（list_created_at）で補完
  　|　 広告名未設定リードは除外中
</div>
```

---

## TASK 2: Supabase RPC の追加（パフォーマンス改善）

現在 `page.tsx` で全leadsを取得してクライアントサイドで集計しているため、件数増加時に遅くなります。
以下のRPC関数をSupabaseに追加し、`page.tsx` のデータ取得をRPC経由に変更してください。

### 2-1. Supabaseダッシュボードで以下のSQLを実行

```sql
-- 広告別集計RPC
CREATE OR REPLACE FUNCTION get_ad_analytics(
  p_tenant_id UUID,
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  ad_name           TEXT,
  leads             BIGINT,
  appo              BIGINT,
  chosei            BIGINT,
  saiyo_ok          BIGINT,
  saiyo_ng          BIGINT,
  juchu             BIGINT,
  ng                BIGINT,
  taishogai         BIGINT,
  kanryo            BIGINT,
  mi_call           BIGINT,
  rusu              BIGINT,
  mikomi_a          BIGINT,
  mikomi_b          BIGINT,
  mikomi_c          BIGINT,
  mikanryo          BIGINT,
  total_revenue     BIGINT,
  cashflow_revenue  BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(l.ad_name, '広告名未設定') AS ad_name,
    COUNT(*)                            AS leads,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）','採用NG','受注'
    ))                                  AS appo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '調整中','調整中（リスク/商談前）'
    ))                                  AS chosei,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '採用OK','採用OK（商談着座）'
    ))                                  AS saiyo_ok,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '採用NG') AS saiyo_ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '受注')   AS juchu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN ('NG','採用NG')) AS ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '対象外') AS taishogai,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）',
      '採用NG','受注','NG','対象外','現アナ','現在アナログ','ポータルサイト'
    ))                                  AS kanryo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '新規','未コール'
    ))                                  AS mi_call,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '留守')   AS rusu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みA') AS mikomi_a,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みB') AS mikomi_b,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みC') AS mikomi_c,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '新規','未コール','留守','見込みA','見込みB','見込みC'
    ))                                  AS mikanryo,
    COALESCE(SUM(l.deal_amount), 0)     AS total_revenue,
    COALESCE(SUM(COALESCE(l.initial_fee,0) + COALESCE(l.monthly_fee,0)), 0) AS cashflow_revenue
  FROM leads l
  WHERE l.tenant_id = p_tenant_id
    AND (p_from IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE >= p_from)
    AND (p_to   IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE <= p_to)
  GROUP BY COALESCE(l.ad_name, '広告名未設定')
  ORDER BY leads DESC;
$$;

-- 月次集計RPC
CREATE OR REPLACE FUNCTION get_monthly_analytics(
  p_tenant_id UUID,
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  month       TEXT,
  leads       BIGINT,
  appo        BIGINT,
  chosei      BIGINT,
  saiyo_ok    BIGINT,
  saiyo_ng    BIGINT,
  juchu       BIGINT,
  ng          BIGINT,
  taishogai   BIGINT,
  kanryo      BIGINT,
  mi_call     BIGINT,
  rusu        BIGINT,
  mikomi_a    BIGINT,
  mikomi_b    BIGINT,
  mikomi_c    BIGINT,
  mikanryo    BIGINT,
  total_revenue    BIGINT,
  cashflow_revenue BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT
    to_char(COALESCE(l.inquiry_at, l.list_created_at), 'YYYY-MM') AS month,
    COUNT(*) AS leads,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）','採用NG','受注'
    )) AS appo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '調整中','調整中（リスク/商談前）'
    )) AS chosei,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '採用OK','採用OK（商談着座）'
    )) AS saiyo_ok,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '採用NG') AS saiyo_ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '受注')   AS juchu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN ('NG','採用NG')) AS ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '対象外') AS taishogai,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）',
      '採用NG','受注','NG','対象外','現アナ','現在アナログ','ポータルサイト'
    )) AS kanryo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN ('新規','未コール')) AS mi_call,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '留守')   AS rusu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みA') AS mikomi_a,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みB') AS mikomi_b,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みC') AS mikomi_c,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '新規','未コール','留守','見込みA','見込みB','見込みC'
    )) AS mikanryo,
    COALESCE(SUM(l.deal_amount), 0) AS total_revenue,
    COALESCE(SUM(COALESCE(l.initial_fee,0) + COALESCE(l.monthly_fee,0)), 0) AS cashflow_revenue
  FROM leads l
  WHERE l.tenant_id = p_tenant_id
    AND COALESCE(l.inquiry_at, l.list_created_at) IS NOT NULL
    AND (p_from IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE >= p_from)
    AND (p_to   IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE <= p_to)
    AND EXTRACT(YEAR FROM COALESCE(l.inquiry_at, l.list_created_at)) >= 2020
    AND COALESCE(l.inquiry_at, l.list_created_at) <= NOW()
  GROUP BY month
  ORDER BY month ASC;
$$;
```

### 2-2. page.tsx をRPC経由に変更

```typescript
// Before: 全件取得してクライアント集計
// After: RPC経由でDB集計済みデータを取得

const [adRpcRes, monthlyRpcRes, rawLeadsRes] = await Promise.all([
  // 広告別集計（RPC）
  supabase.rpc('get_ad_analytics', {
    p_tenant_id: TENANT_ID,
    p_from: null,
    p_to: null,
  }),
  // 月次集計（RPC）
  supabase.rpc('get_monthly_analytics', {
    p_tenant_id: TENANT_ID,
    p_from: null,
    p_to: null,
  }),
  // クライアントフィルタ用に生データも取得（ad_name / status / inquiry_at のみ）
  supabase
    .from('leads')
    .select('id, ad_name, status, last_call_result, inquiry_at, list_created_at, deal_amount, initial_fee, monthly_fee, source_data')
    .eq('tenant_id', TENANT_ID),
])
```

---

## TASK 3: FM同期の開通（最重要）

**未完了タスク**: FMスクリプト「Push To Web CRM」の作成（FM→Web双方向同期の開通）

### 3-1. `/api/fm/webhook` エンドポイントの作成

`src/app/api/fm/webhook/route.ts` を新規作成してください。

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const TENANT_ID = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'

export async function POST(req: NextRequest) {
  // 認証: FMスクリプトからのリクエストをシークレットで検証
  const authHeader = req.headers.get('x-fm-secret')
  if (authHeader !== process.env.FM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createClient()

  // FMから受信するデータ構造:
  // {
  //   action: 'upsert' | 'delete',
  //   record: {
  //     fm_record_id: string,      // FMのレコードID
  //     customer_id: string,       // CS番号
  //     ad_name: string,
  //     inquiry_at: string,        // ISO8601
  //     list_created_at: string,   // ISO8601
  //     status: string,
  //     last_call_result: string,
  //     company_name: string,
  //     representative_name: string,
  //     phone_numbers: string[],
  //     prefecture: string,
  //     deal_amount: number | null,
  //     initial_fee: number | null,
  //     monthly_fee: number | null,
  //     call_count: number,
  //     ... その他FMフィールド
  //   }
  // }

  const { action, record } = body

  if (!record?.fm_record_id) {
    return NextResponse.json({ error: 'fm_record_id is required' }, { status: 400 })
  }

  if (action === 'delete') {
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .eq('fm_record_id', record.fm_record_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'deleted' })
  }

  // upsert（insert or update）
  const payload = {
    tenant_id:             TENANT_ID,
    fm_record_id:          record.fm_record_id,
    customer_id:           record.customer_id ?? null,
    ad_name:               record.ad_name ?? null,
    inquiry_at:            record.inquiry_at ?? null,
    list_created_at:       record.list_created_at ?? null,
    status:                record.status ?? '新規',
    last_call_result:      record.last_call_result ?? null,
    deal_amount:           record.deal_amount ?? null,
    initial_fee:           record.initial_fee ?? null,
    monthly_fee:           record.monthly_fee ?? null,
    source:                'fm_sync',
    source_data: {
      company_name:         record.company_name,
      representative_name:  record.representative_name,
      phone_numbers:        record.phone_numbers,
      prefecture:           record.prefecture,
      call_count:           record.call_count,
      fm_synced_at:         new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('leads')
    .upsert(payload, { onConflict: 'fm_record_id,tenant_id' })
    .select('id')
    .single()

  if (error) {
    console.error('FM webhook upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: 'upserted', id: data.id })
}
```

### 3-2. `.env.local` に追加

```
FM_WEBHOOK_SECRET=（任意の強力なランダム文字列、例: openssl rand -hex 32 で生成）
```

### 3-3. FMスクリプト仕様書の出力

`src/lib/filemaker/FM_SCRIPT_SPEC.md` を新規作成してください。
このファイルはFM側で「Push To Web CRM」スクリプトを書く人向けの仕様書です。

```markdown
# FileMaker → AI CRM OS 同期スクリプト仕様書

## エンドポイント
POST https://sooon-crm.vercel.app/api/fm/webhook

## 認証ヘッダー
x-fm-secret: [FM_WEBHOOK_SECRETの値]
Content-Type: application/json

## FMスクリプト「Push To Web CRM」の実装手順

### トリガー設定
- スクリプトトリガー: OnRecordCommit
- 対象レイアウト: リスト情報

### スクリプト本体（FileMaker Script Workspace）

```
# ── Push To Web CRM ──────────────────────────
# 変数セット: $url
Set Variable [ $url ; Value: "https://sooon-crm.vercel.app/api/fm/webhook" ]

# ── JSONペイロード構築 ──────────────────────
Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "action" ; "upsert" ; JSONString ] ;
    [ "record.fm_record_id"        ; GetField("レコードID") ; JSONString ] ;
    [ "record.customer_id"         ; GetField("顧客ID") ; JSONString ] ;
    [ "record.ad_name"             ; GetField("広告名") ; JSONString ] ;
    [ "record.inquiry_at"          ; GetAsTimestamp(GetField("問い合わせ日時")) ; JSONString ] ;
    [ "record.list_created_at"     ; GetAsTimestamp(GetField("リスト作成日時")) ; JSONString ] ;
    [ "record.status"              ; GetField("ステータス") ; JSONString ] ;
    [ "record.last_call_result"    ; GetField("最終架電結果") ; JSONString ] ;
    [ "record.company_name"        ; GetField("会社名") ; JSONString ] ;
    [ "record.representative_name" ; GetField("代表名") ; JSONString ] ;
    [ "record.prefecture"          ; GetField("都道府県") ; JSONString ] ;
    [ "record.deal_amount"         ; GetField("受注金額") ; JSONNumber ] ;
    [ "record.initial_fee"         ; GetField("初期費用") ; JSONNumber ] ;
    [ "record.monthly_fee"         ; GetField("月額費用") ; JSONNumber ] ;
    [ "record.call_count"          ; GetField("架電回数") ; JSONNumber ]
  )
]

# ── cURL でPOST ─────────────────────────────
Insert from URL [
  Select ; No dialog ;
  Target: $result ;
  URL: $url ;
  cURL options: "--request POST
    --header \"Content-Type: application/json\"
    --header \"x-fm-secret: [FM_WEBHOOK_SECRETの値]\"
    --data @$payload"
]

# ── エラーチェック ──────────────────────────
If [ JSONGetElement($result ; "ok") ≠ "true" ]
  Show Custom Dialog [ "同期エラー" ; JSONGetElement($result ; "error") ]
End If
```

## フィールドマッピング（FM名 → API送信名）
| FMフィールド名     | JSONキー              | 型       |
|-------------------|-----------------------|---------|
| レコードID         | record.fm_record_id   | string  |
| 顧客ID            | record.customer_id    | string  |
| 広告名            | record.ad_name        | string  |
| 問い合わせ日時     | record.inquiry_at     | ISO8601 |
| リスト作成日時     | record.list_created_at| ISO8601 |
| ステータス         | record.status         | string  |
| 最終架電結果       | record.last_call_result| string |
| 会社名            | record.company_name   | string  |
| 代表名            | record.representative_name | string |
| 都道府県          | record.prefecture     | string  |
| 受注金額          | record.deal_amount    | number  |
| 初期費用          | record.initial_fee    | number  |
| 月額費用          | record.monthly_fee    | number  |
| 架電回数          | record.call_count     | number  |
```

---

## TASK 4: ダッシュボード（/dashboard）の強化

現状のダッシュボードに以下のKPIウィジェットを追加してください。
`src/app/(dashboard)/dashboard/page.tsx` を修正します。

### 4-1. 今月 vs 先月 比較KPIカード

```typescript
// Supabaseから今月・先月データをRPCで取得
const thisMonth = format(new Date(), 'yyyy-MM')
const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM')

const [thisMonthData, lastMonthData] = await Promise.all([
  supabase.rpc('get_monthly_analytics', {
    p_tenant_id: TENANT_ID,
    p_from: startOfMonth(new Date()).toISOString().slice(0,10),
    p_to: endOfMonth(new Date()).toISOString().slice(0,10),
  }),
  supabase.rpc('get_monthly_analytics', {
    p_tenant_id: TENANT_ID,
    p_from: startOfMonth(subMonths(new Date(), 1)).toISOString().slice(0,10),
    p_to: endOfMonth(subMonths(new Date(), 1)).toISOString().slice(0,10),
  }),
])
```

KPIカードに「前月比」を表示:

```tsx
// 例: リード数
// 今月: 118  ▲ +29% 先月比
```

前月比が正の場合 `color: #10B981`、負の場合 `color: #EF4444`、0の場合 `color: #9CA3AF`。

### 4-2. 直近7日間の活動サマリー

```typescript
// callsテーブルから直近7日間の架電数を取得
const { data: recentCalls } = await supabase
  .from('calls')
  .select('call_date, call_result, agent_name')
  .eq('tenant_id', TENANT_ID)
  .gte('call_date', format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  .order('call_date', { ascending: false })
```

以下のミニカードを横並びで表示:
- 直近7日 架電数
- 直近7日 アポ獲得数
- 直近7日 アポ率
- 未完了リード数（status IN ('新規','未コール','留守','見込みA/B/C')）

### 4-3. 未完了リードアラートバナー

```tsx
// 未完了リードが存在する場合のみ表示
{mikanryoCount > 0 && (
  <div style={{
    background: '#FFF7ED', border: '1px solid #FED7AA',
    borderRadius: 8, padding: '10px 16px',
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
  }}>
    <span style={{ fontSize: 16 }}>⚠️</span>
    <div>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
        未完了リードが {mikanryoCount.toLocaleString()} 件あります
      </span>
      <span style={{ fontSize: 12, color: '#B45309', marginLeft: 8 }}>
        （留守: {rusuCount}件 / 見込みA/B/C: {mikomiCount}件 / 未コール: {miCallCount}件）
      </span>
    </div>
    <Link href="/leads?filter=mikanryo" style={{ marginLeft: 'auto', fontSize: 12, color: '#0D9488' }}>
      一覧を見る →
    </Link>
  </div>
)}
```

---

## TASK 5: パフォーマンス改善（Supabaseインデックス追加）

Supabaseダッシュボードで以下のSQLを実行してください。
アナリティクスのクエリが劇的に速くなります。

```sql
-- 月次集計用（最重要）
CREATE INDEX IF NOT EXISTS idx_leads_tenant_inquiry_at
  ON leads (tenant_id, inquiry_at)
  WHERE inquiry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_list_created_at
  ON leads (tenant_id, list_created_at)
  WHERE list_created_at IS NOT NULL;

-- 広告別集計用
CREATE INDEX IF NOT EXISTS idx_leads_tenant_ad_name
  ON leads (tenant_id, ad_name)
  WHERE ad_name IS NOT NULL;

-- ステータス別集計用
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status
  ON leads (tenant_id, status);

-- FM同期用
CREATE INDEX IF NOT EXISTS idx_leads_fm_record_id
  ON leads (tenant_id, fm_record_id)
  WHERE fm_record_id IS NOT NULL;
```

---

## TASK 6: エラー境界とローディング改善

### 6-1. `src/app/(dashboard)/analytics/error.tsx` を新規作成

```tsx
'use client'
import { useEffect } from 'react'

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Analytics error:', error)
  }, [error])

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12, background: '#F5F7FA',
    }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
        データの読み込みに失敗しました
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 300, textAlign: 'center' }}>
        {error.message}
      </div>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px', borderRadius: 6, border: 'none',
          background: '#0D9488', color: '#fff', cursor: 'pointer', fontSize: 13,
        }}
      >
        再読み込み
      </button>
    </div>
  )
}
```

### 6-2. Supabaseクエリのタイムアウト設定

`src/app/(dashboard)/analytics/page.tsx` のRPC呼び出しに `AbortSignal` を追加:

```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒タイムアウト

try {
  const [adRes, monthlyRes] = await Promise.all([
    supabase.rpc('get_ad_analytics', { p_tenant_id: TENANT_ID }),
    supabase.rpc('get_monthly_analytics', { p_tenant_id: TENANT_ID }),
  ])
  clearTimeout(timeoutId)
  // ...
} catch (err) {
  clearTimeout(timeoutId)
  throw err
}
```

---

## 実装順序（この順番を守ること）

1. **事前調査SQL実行** → 結果確認
2. **TASK 5: インデックス追加**（後続の全クエリに影響するため最初に）
3. **TASK 2-1: RPC関数追加**（Supabaseダッシュボードで実行）
4. **TASK 1: アナリティクスデータ精度修正**
5. **TASK 2-2: page.tsx をRPC経由に変更**
6. **TASK 3: FM同期エンドポイント + 仕様書**
7. **TASK 4: ダッシュボード強化**
8. **TASK 6: エラー境界**
9. `npm run build` で全エラーなしを確認
10. Vercelデプロイ

---

## 完成確認チェックリスト

### アナリティクス精度
- [ ] 2026-04の月次データが正常件数になっている
- [ ] `created_at` を集計に使っていない（コード内にコメントあり）
- [ ] 「広告名未設定を除外」チェックボックスが機能する
- [ ] KPIカードに集計基準の注記が表示される

### パフォーマンス
- [ ] `/analytics` の初期ロードが3秒以内
- [ ] Supabaseに5つのインデックスが作成されている
- [ ] RPC関数 `get_ad_analytics` と `get_monthly_analytics` が存在する

### FM同期
- [ ] `POST /api/fm/webhook` が `401` を返すことを確認（secretなし）
- [ ] `FM_WEBHOOK_SECRET` が `.env.local` に設定されている
- [ ] `FM_SCRIPT_SPEC.md` が生成されている
- [ ] Vercel環境変数に `FM_WEBHOOK_SECRET` を追加済み

### ダッシュボード
- [ ] 今月・先月の前月比KPIカードが表示される
- [ ] 未完了リードアラートバナーが正しい件数を表示する

### 品質
- [ ] `error.tsx` が存在する
- [ ] `npm run build` エラーなし
- [ ] Vercelデプロイ後もエラーなし
