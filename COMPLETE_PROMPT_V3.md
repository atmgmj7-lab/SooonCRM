# AI CRM OS — 完全版実装プロンプト v3

> **前提**: ビルドクリーン済み / leads 2,822件取得済み / list_created_at・fm_record_id追加済み
> **tenant_id**: `dde9bea6-a017-49e6-a1b6-88494e1e3b4d`
> **実行順序**: STEP 0→1→2→3→4→5→6の順。各STEPの結果を必ず出力してから次へ進むこと。

---

## STEP 0: 事前調査（全て実行・結果を出力）

```sql
-- ① callsテーブルの全カラム確認（newcomer_flag・agent_nameの存在確認）
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'calls'
ORDER BY ordinal_position;

-- ② leadsのstatusに実際に存在する値（ステータス文字列の完全確認）
SELECT COALESCE(status, 'NULL') AS status, COUNT(*) AS cnt
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
GROUP BY status ORDER BY cnt DESC;

-- ③ last_call_resultに存在する値
SELECT COALESCE(last_call_result, 'NULL') AS result, COUNT(*) AS cnt
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
GROUP BY last_call_result ORDER BY cnt DESC;

-- ④ 空白リードの件数
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE inquiry_at IS NULL AND (ad_name IS NULL OR ad_name = '')) AS completely_empty,
  COUNT(*) FILTER (WHERE ad_name IS NULL OR ad_name = '') AS no_ad_name
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';

-- ⑤ inquiry_atの月別分布
SELECT to_char(inquiry_at, 'YYYY-MM') AS month, COUNT(*) AS cnt
FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND inquiry_at IS NOT NULL
GROUP BY month ORDER BY month;

-- ⑥ callsのcall_resultに存在する値
SELECT COALESCE(call_result, 'NULL') AS result, COUNT(*) AS cnt
FROM calls
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
GROUP BY call_result ORDER BY cnt DESC;

-- ⑦ list_recordsテーブルの存在確認
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'list_records';

-- ⑧ tenant_membersテーブルの確認
SELECT id, name, role FROM tenant_members
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';
```

---

## STEP 1: Supabase SQLの実行（ダッシュボードで実行）

### 1-1. callsテーブルにnewcomer_flagカラムを追加

STEP 0-①でnewcomer_flagカラムが存在しない場合のみ実行:

```sql
-- callsにnewcomer_flagとagent_idを追加
ALTER TABLE calls ADD COLUMN IF NOT EXISTS newcomer_flag TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES tenant_members(id);

-- list_recordsにもnewcomer_flagカラムを確認・追加
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS newcomer_flag TEXT;
```

### 1-2. ステータス定数の確認とDB修正

STEP 0-②③⑥の結果で判明した実際のステータス文字列を元に、
以下の標準化SQLを実行してください（実際の値に合わせて調整すること）:

```sql
-- callsのcall_resultをleadsのstatusに一括反映（最新架電結果優先）
WITH latest_calls AS (
  SELECT DISTINCT ON (lead_id)
    lead_id,
    call_result,
    agent_name,
    call_date
  FROM calls
  WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
    AND lead_id IS NOT NULL
    AND call_result IS NOT NULL
    AND call_result != ''
  ORDER BY lead_id, call_date DESC, created_at DESC
)
UPDATE leads l
SET
  status = lc.call_result,
  last_call_result = lc.call_result,
  updated_at = NOW()
FROM latest_calls lc
WHERE l.id = lc.lead_id
  AND l.tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';

-- 更新件数確認
SELECT COUNT(*) AS updated FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND status != '新規' AND status IS NOT NULL;
```

### 1-3. callsトリガーを作成（以後の架電結果を自動反映）

```sql
CREATE OR REPLACE FUNCTION sync_lead_status_from_call()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_lead_id UUID;
BEGIN
  -- lead_idで直接特定
  IF NEW.lead_id IS NOT NULL THEN
    target_lead_id := NEW.lead_id;
  ELSIF NEW.list_record_id IS NOT NULL THEN
    -- list_record_idからleadを特定
    SELECT id INTO target_lead_id
    FROM leads
    WHERE list_record_id = NEW.list_record_id
      AND tenant_id = NEW.tenant_id
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF target_lead_id IS NULL OR NEW.call_result IS NULL OR NEW.call_result = '' THEN
    RETURN NEW;
  END IF;

  UPDATE leads
  SET
    status = NEW.call_result,
    last_call_result = NEW.call_result,
    updated_at = NOW()
  WHERE id = target_lead_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_status ON calls;
CREATE TRIGGER trg_sync_lead_status
AFTER INSERT OR UPDATE OF call_result ON calls
FOR EACH ROW EXECUTE FUNCTION sync_lead_status_from_call();
```

### 1-4. 空白リードの削除

STEP 0-④で件数を確認してから実行:

```sql
-- 削除前に件数確認
SELECT COUNT(*) FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND inquiry_at IS NULL
  AND (ad_name IS NULL OR ad_name = '')
  AND (source_data = '{}' OR source_data IS NULL OR source_data = 'null'::jsonb);

-- 確認後に削除
DELETE FROM leads
WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND inquiry_at IS NULL
  AND (ad_name IS NULL OR ad_name = '')
  AND (source_data = '{}' OR source_data IS NULL OR source_data = 'null'::jsonb);
```

---

## STEP 2: アナリティクス画面の修正

### 2-1. ステータス定数を実際のDB値に完全合わせ

`src/app/(dashboard)/analytics/_lib/aggregations.ts` の定数をSTEP 0-②③⑥の実際の値に合わせて修正してください。

```typescript
// STEP 0の結果で確認した実際のDB値を全て含めること
// 以下は例 — 実際の値に必ず置き換える
export const APPO_STATUSES = [
  // STEP 0-②で確認した実際のアポ系ステータス値を全て列挙
  'アポOK', '調整中', '調整中（リスク/商談前）',
  '採用OK', '採用OK（商談着座）', '採用NG', '受注',
  // STEP 0-⑥のcall_resultにある値も追加
]

export const KANRYO_STATUSES = [
  // 完了 = 結果が確定したもの全て（STEP 0の結果で確認した値）
  'アポOK', '調整中', '調整中（リスク/商談前）',
  '採用OK', '採用OK（商談着座）', '採用NG', '受注',
  'NG', '対象外', '現アナ', '現在アナログ', 'ポータルサイト',
]

export const MIKANRYO_STATUSES = [
  // 未完了 = まだ結果が出ていないもの（STEP 0の結果で確認した値）
  '新規', '未コール', '留守', '見込みA', '見込みB', '見込みC',
]

// アポOK内訳（フロントのテーブルで展開表示するため個別に定義）
export const APPO_CHOSEI   = ['調整中', '調整中（リスク/商談前）']  // アポOK内訳: 調整中
export const APPO_SAIYO_OK = ['採用OK', '採用OK（商談着座）']         // アポOK内訳: 採用OK
export const APPO_SAIYO_NG = ['採用NG']                               // アポOK内訳: 採用NG
export const APPO_JUCHU    = ['受注']                                  // アポOK内訳: 受注（採用OKを含む）
```

### 2-2. 「着座数」カラムを AdSummaryTable から完全削除

`src/app/(dashboard)/analytics/_components/AdSummaryTable.tsx` の COLUMNS 配列から `chakuza`（着座数）の行を削除してください。また `_lib/types.ts` の `AdSummaryRow` からも `chakuza` フィールドを削除し、`aggregations.ts` からも計算を削除してください。

### 2-3. アポOK内訳の表示方式を変更

`AdSummaryTable.tsx` でアポOK数のセルをクリックすると内訳が展開されるアコーディオン形式に変更してください。

```tsx
// アポOKセルの表示
const AppoCell = ({ row }: { row: AdSummaryRow }) => {
  const [open, setOpen] = useState(false)
  return (
    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            fontFamily: 'DM Mono', fontWeight: 700, color: '#15803D',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
          }}
          title="クリックで内訳を表示"
        >
          {row.appo} {open ? '▲' : '▼'}
        </button>
        {open && (
          <div style={{
            marginTop: 4, padding: '6px 8px',
            background: '#F0FDF4', borderRadius: 6,
            fontSize: 11, textAlign: 'left', whiteSpace: 'nowrap',
          }}>
            <div style={{ color: '#6B7280' }}>└ 調整中: <b style={{ color: '#0D9488' }}>{row.chosei}</b></div>
            <div style={{ color: '#6B7280' }}>└ 採用OK: <b style={{ color: '#1D4ED8' }}>{row.saiyoOk}</b></div>
            <div style={{ color: '#6B7280' }}>└ 採用NG: <b style={{ color: '#DC2626' }}>{row.saiyoNg}</b></div>
            <div style={{ color: '#6B7280' }}>└ 受注:   <b style={{ color: '#0D9488' }}>{row.juchu}</b></div>
          </div>
        )}
      </div>
    </td>
  )
}
```

### 2-4. タブ構成を最終版に変更

`AnalyticsClient.tsx` のタブ定義を以下に変更（アナリティクス再設計プロンプトと統合）:

```typescript
const TABS = [
  { key: 'ad_summary',    label: '広告サマリー',   icon: '📊',
    desc: '広告別・月次の集計（leadsテーブル基準）' },
  { key: 'lead_summary',  label: 'リードサマリー', icon: '📈',
    desc: 'コホート分析 M0〜M3（leads × calls）' },
  { key: 'call_analysis', label: 'コール分析',     icon: '📞',
    desc: '月次コール数・担当者別・時間帯別（callsテーブル基準）' },
  { key: 'funnel',        label: 'ファクター分析', icon: '🔍',
    desc: '広告別ボトルネック特定' },
]
```

---

## STEP 3: リスト情報詳細画面の全面修正

### 3-1. 削除する項目（不要と確認済み）

`src/app/(dashboard)/list/[id]/page.tsx` または該当コンポーネントから以下のセクションを削除してください:

- **MEO・精査セクション**全体（Google/Yahoo/食べログ/Retty/Hotpepperのチェックボックス、リスト精査チェックボックス）
- **定休日チェックボックス**（月〜祝）

### 3-2. 新人フラグの表示と編集

リスト情報の基本情報セクションに「新人フラグ」を追加してください。

```tsx
// 基本情報の顧客IDの隣に配置（FMと同じ位置）
<InfoField
  label="新人フラグ"
  value={record.newcomer_flag}
  editable
  onSave={async (val) => {
    await supabase
      .from('list_records')
      .update({ newcomer_flag: val, updated_at: new Date().toISOString() })
      .eq('id', record.id)
    // leads の source_data にも反映
    await supabase
      .from('leads')
      .update({ 'source_data': { ...lead.source_data, newcomer_flag: val } })
      .eq('list_record_id', record.id)
  }}
/>
```

または `leads` テーブルを使っている場合:

```typescript
// leadsテーブルのsource_data.newcomer_flagまたは専用カラムに保存
// newcomer_flagカラムがleadsにない場合はALTER TABLEで追加
ALTER TABLE leads ADD COLUMN IF NOT EXISTS newcomer_flag TEXT;

// 画面上は読み書き可能なテキスト入力として表示
// FMと同じく「担当者名（アカウント名）」が初期値
```

### 3-3. ステータスをプルダウン選択式に変更

リスト情報詳細のステータス表示を以下のプルダウンに変更してください。選択した瞬間に保存・リード一覧に反映されること。

```typescript
const CALL_RESULT_OPTIONS = [
  // 完了系（架電結果が確定）
  { value: 'アポOK',     label: 'アポOK',     group: '完了',   color: '#15803D' },
  { value: '調整中',     label: '調整中',     group: '完了',   color: '#0D9488' },
  { value: '採用OK',     label: '採用OK',     group: '完了',   color: '#1D4ED8' },
  { value: '採用NG',     label: '採用NG',     group: '完了',   color: '#DC2626' },
  { value: '受注',       label: '受注',       group: '完了',   color: '#15803D' },
  { value: 'NG',         label: 'NG',         group: '完了',   color: '#EF4444' },
  { value: '対象外',     label: '対象外',     group: '完了',   color: '#9CA3AF' },
  { value: '現アナ',     label: '現アナ',     group: '完了',   color: '#9CA3AF' },
  { value: 'ポータルサイト', label: 'ポータルサイト', group: '完了', color: '#9CA3AF' },
  // 未完了系
  { value: '新規',       label: '新規',       group: '未完了', color: '#6B7280' },
  { value: '留守',       label: '留守',       group: '未完了', color: '#F59E0B' },
  { value: '見込みA',    label: '見込みA',    group: '未完了', color: '#8B5CF6' },
  { value: '見込みB',    label: '見込みB',    group: '未完了', color: '#8B5CF6' },
  { value: '見込みC',    label: '見込みC',    group: '未完了', color: '#8B5CF6' },
]
```

```tsx
// ステータス選択コンポーネント
'use client'
export function StatusSelect({
  value,
  leadId,
  onUpdate,
}: {
  value: string
  leadId: string
  onUpdate: (newStatus: string) => void
}) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('更新失敗')
      onUpdate(newStatus)
    } finally {
      setSaving(false)
    }
  }

  const current = CALL_RESULT_OPTIONS.find(o => o.value === value)

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        border: `2px solid ${current?.color ?? '#E5E7EB'}`,
        background: '#fff',
        color: current?.color ?? '#374151',
        fontWeight: 600,
        fontSize: 12,
        cursor: 'pointer',
        appearance: 'auto',
      }}
    >
      <optgroup label="完了">
        {CALL_RESULT_OPTIONS.filter(o => o.group === '完了').map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </optgroup>
      <optgroup label="未完了">
        {CALL_RESULT_OPTIONS.filter(o => o.group === '未完了').map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </optgroup>
    </select>
  )
}
```

### 3-4. ステータス更新APIエンドポイント

`src/app/api/leads/[id]/status/route.ts` を新規作成:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const TENANT_ID = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { status } = await req.json()
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const supabase = createClient()

  const { error } = await supabase
    .from('leads')
    .update({ status, last_call_result: status, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('tenant_id', TENANT_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

### 3-5. コール履歴に「対応者」カラムを追加

コール履歴テーブルの表示カラムに `agent_name`（対応者）を追加してください。

```typescript
// コール履歴テーブルのカラム定義
const CALL_COLUMNS = [
  { key: 'call_date',             label: '架電日' },
  { key: 'call_start_time',       label: '開始' },
  { key: 'call_end_time',         label: '終了' },
  { key: 'agent_name',            label: '対応者',   highlight: true },  // ← 追加
  { key: 'newcomer_flag',         label: '新人フラグ' },                  // ← 追加
  { key: 'call_result',           label: '結果',     badge: true },
  { key: 'call_category',         label: 'カテゴリ' },
  { key: 'appo_detail',           label: 'アポ詳細' },
  { key: 'call_duration_minutes', label: '時間(分)', mono: true },
]
```

コール履歴の「結果」列も上記 `CALL_RESULT_OPTIONS` のプルダウンで編集可能にしてください。選択時に即座にSupabaseへ保存し、親のリード画面のステータスも更新してください。

### 3-6. 見切れ修正

```typescript
// src/app/(dashboard)/list/[id]/page.tsx のルートdivを修正
<div style={{
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  background: '#F5F7FA',
}}>
  {/* ヘッダー（固定） */}
  <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '10px 24px' }}>
    {/* 前へ/次へ ナビゲーション */}
    {/* 広告名 */}
    {/* 顧客ID・ステータス */}
  </div>

  {/* スクロール可能エリア */}
  <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, paddingTop: 16 }}>
      {/* 左: 基本情報 + コール履歴 */}
      <div>
        {/* 基本情報セクション */}
        {/* コール履歴ポータル */}
      </div>
      {/* 右: サイドバー（sticky） */}
      <div style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
        {/* お問い合わせ履歴 */}
        {/* メモ */}
      </div>
    </div>
  </div>
</div>
```

---

## STEP 4: FM絞り込み検索の実装

`src/components/list/SearchPanel.tsx` を新規作成してリスト情報一覧とリード管理の両方に組み込んでください。

```typescript
// 検索フィールド定義（FMの検索モードを完全再現）
const SEARCH_FIELDS = [
  { key: 'company_name',         label: '会社名',       type: 'text' },
  { key: 'representative_name',  label: '代表名',       type: 'text' },
  { key: 'ad_name',              label: '広告名',       type: 'text' },
  { key: 'status',               label: '架電結果',     type: 'select', options: CALL_RESULT_OPTIONS },
  { key: 'last_call_result',     label: '最終架電結果', type: 'select', options: CALL_RESULT_OPTIONS },
  { key: 'newcomer_flag',        label: '新人フラグ',   type: 'text' },
  { key: 'prefecture',           label: '都道府県',     type: 'text' },
  { key: 'industry',             label: '業種',         type: 'text' },
  { key: 'inquiry_at',           label: '問い合わせ日', type: 'daterange' },
  { key: 'last_call_date',       label: '最終架電日',   type: 'daterange' },
  { key: 'phone_numbers',        label: '電話番号',     type: 'text' },
]

// UI構成
// ┌──────────────────────────────────────────────────────┐
// │ 🔍 絞り込み検索  [1,240 件]                    ▼ 開く │
// ├──────────────────────────────────────────────────────┤
// │ [会社名 ▼] [含む ▼] [____________]  × ┃           │
// │ AND [架電結果 ▼] [= ▼] [アポOK ▼]    ┃           │
// │ AND [問い合わせ日 ▼] [2025-06-01] 〜 [2025-12-31] │
// │ [+ AND条件を追加]  [検索]  [リセット]              │
// └──────────────────────────────────────────────────────┘

// サーバーサイドフィルタ（URLパラメータ方式）
// /list?company=村上&status=アポOK&from=2025-06-01
```

Supabaseクエリ変換:

```typescript
// src/app/(dashboard)/list/page.tsx のServer Component
async function getListRecords(searchParams: URLSearchParams) {
  const supabase = createClient()
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('tenant_id', TENANT_ID)

  const company = searchParams.get('company')
  if (company) query = query.ilike('source_data->>company_name', `%${company}%`)

  const status = searchParams.get('status')
  if (status) query = query.eq('status', status)

  const newcomer = searchParams.get('newcomer')
  if (newcomer) query = query.ilike('newcomer_flag', `%${newcomer}%`)

  const from = searchParams.get('from')
  if (from) query = query.gte('inquiry_at', from)

  const to = searchParams.get('to')
  if (to) query = query.lte('inquiry_at', to + 'T23:59:59')

  const { data, count, error } = await query
    .order('inquiry_at', { ascending: false })
    .limit(10000)

  return { data: data ?? [], count: count ?? 0, error }
}
```

---

## STEP 5: 新規リード一覧サブタブ

`src/app/(dashboard)/leads/page.tsx` に「新規リード一覧」サブタブを追加してください。

```typescript
// タブ定義
const TABS = [
  { key: 'all',     label: '全リード' },
  { key: 'new',     label: '新規リード一覧', badgeColor: '#EF4444' },
  { key: 'done',    label: '対応済み' },
]

// 新規リード = status が '新規' のもの
// 表示カラム
const NEW_LEAD_COLUMNS = [
  { key: 'inquiry_at',        label: '問い合わせ日' },
  { key: 'ad_name',           label: '広告名' },
  { key: 'company_name',      label: '会社名',     from: 'source_data' },
  { key: 'representative_name', label: '代表名',   from: 'source_data' },
  { key: 'prefecture',        label: '都道府県',   from: 'source_data' },
  { key: 'phone_numbers',     label: '電話番号',   from: 'source_data' },
  { key: 'elapsed_days',      label: '経過日数',   computed: true },   // 赤表示（3日超）
  { key: 'newcomer_flag',     label: '新人フラグ' },
  { key: 'status_action',     label: '対応',       action: true },     // ステータス変更ドロップダウン
]

// 経過日数の計算・表示
const ElapsedDays = ({ inquiryAt }: { inquiryAt: string }) => {
  const days = Math.floor((Date.now() - new Date(inquiryAt).getTime()) / 86400000)
  return (
    <span style={{
      fontFamily: 'DM Mono', fontWeight: 700,
      color: days >= 3 ? '#EF4444' : days >= 1 ? '#F59E0B' : '#10B981',
    }}>
      {days}日
    </span>
  )
}
```

---

## STEP 6: FM双方向同期の完全実装

### 6-1. 新規リードのFM自動送信

`src/lib/filemaker/pushToFM.ts` を新規作成:

```typescript
/**
 * AI CRM OS → FileMaker への新規リード送信
 * Meta Webhookで受信したリードを自動的にFMにも登録する
 */
export async function pushNewLeadToFM(lead: {
  ad_name?: string | null
  inquiry_at?: string | null
  company_name?: string | null
  representative_name?: string | null
  prefecture?: string | null
  phone_numbers?: string[]
  newcomer_flag?: string | null
  title?: string | null
}) {
  const host     = process.env.FM_HOST
  const database = process.env.FM_DATABASE
  const username = process.env.FM_USERNAME
  const password = process.env.FM_PASSWORD

  if (!host || !database || !username || !password) {
    console.warn('FM環境変数が未設定のためスキップ')
    return { ok: false, error: 'FM環境変数未設定' }
  }

  const baseUrl = `https://${host}/fmi/data/vLatest/databases/${encodeURIComponent(database)}`

  // ① FMにログイン
  const loginRes = await fetch(`${baseUrl}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    },
    body: JSON.stringify({}),
  })

  if (!loginRes.ok) {
    const err = await loginRes.text()
    console.error('FM login failed:', err)
    return { ok: false, error: 'FM認証失敗' }
  }

  const loginData = await loginRes.json()
  const token = loginData.response?.token

  if (!token) return { ok: false, error: 'FM token取得失敗' }

  try {
    // ② FMの「リスト情報」レイアウトに新規レコード作成
    // フィールド名はfm-import/field-mapping/の記載に従うこと
    const createRes = await fetch(`${baseUrl}/layouts/リスト情報/records`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        fieldData: {
          'ADNAME':       lead.ad_name ?? '',
          'リスト作成日時': lead.inquiry_at
            ? new Date(lead.inquiry_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : '',
          '会社名':       lead.company_name ?? '',
          '代表名':       lead.representative_name ?? '',
          '都道府県':     lead.prefecture ?? '',
          '電話番号':     lead.phone_numbers?.[0] ?? '',
          '役職':         lead.title ?? '',
          '新人フラグ':   lead.newcomer_flag ?? '',
        },
      }),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      console.error('FM record create failed:', err)
      return { ok: false, error: 'FMレコード作成失敗' }
    }

    const createData = await createRes.json()
    const fm_record_id = String(createData.response?.recordId)

    return { ok: true, fm_record_id }
  } finally {
    // ③ FMからログアウト
    await fetch(`${baseUrl}/sessions/${token}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {})
  }
}
```

### 6-2. Meta Webhookエンドポイントを修正

`src/app/api/webhooks/meta/route.ts` の POST 処理に自動保存とFM送信を追加:

```typescript
// 既存の webhook_leads 保存処理の後に追加

// leadsに自動追加
const inquiryAt = raw.created_time
  ? new Date(Number(raw.created_time) * 1000).toISOString()
  : new Date().toISOString()

const { data: newLead, error: leadInsertError } = await supabase
  .from('leads')
  .insert({
    tenant_id:    TENANT_ID,
    ad_name:      raw.ad_name ?? wl.ad_name ?? null,
    inquiry_at:   inquiryAt,
    status:       '新規',
    source:       'meta_ads',
    source_data: {
      company_name:        raw.company_name ?? raw['会社名'] ?? null,
      representative_name: raw.full_name ?? raw['代表名'] ?? null,
      phone_numbers:       raw.phone_number ? [raw.phone_number] : [],
      prefecture:          raw.prefecture ?? raw['県名'] ?? null,
      title:               raw.title ?? raw['役職'] ?? null,
      webhook_raw:         raw,
    },
  })
  .select('id')
  .single()

if (leadInsertError) {
  console.error('leads insert error:', leadInsertError)
} else if (newLead) {
  // FM送信（非同期・失敗してもWebhook処理は続行）
  pushNewLeadToFM({
    ad_name:             raw.ad_name ?? wl.ad_name,
    inquiry_at:          inquiryAt,
    company_name:        raw.company_name ?? raw['会社名'],
    representative_name: raw.full_name ?? raw['代表名'],
    prefecture:          raw.prefecture ?? raw['県名'],
    phone_numbers:       raw.phone_number ? [raw.phone_number] : [],
    title:               raw.title ?? raw['役職'],
  })
  .then(result => {
    if (result.ok && result.fm_record_id) {
      // FMのrecordIdをleadsに保存
      supabase
        .from('leads')
        .update({ fm_record_id: result.fm_record_id })
        .eq('id', newLead.id)
        .catch(console.error)
    }
  })
  .catch(err => console.error('FM push failed (non-blocking):', err))
}
```

### 6-3. 環境変数の確認出力

実装後、以下のコマンドで環境変数の設定状況を出力してください:

```bash
node -e "
const vars = ['FM_HOST','FM_DATABASE','FM_USERNAME','FM_PASSWORD','META_VERIFY_TOKEN','FM_WEBHOOK_SECRET','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY']
vars.forEach(k => console.log(k + ':', process.env[k] ? '✅ SET' : '❌ MISSING'))
"
```

---

## STEP 7: ビルドと確認

```bash
npm run build
```

---

## 最終報告フォーマット（必須）

```
【STEP 0 調査結果】
- callsのカラム: newcomer_flagは 存在する/しない
- leadsのstatus実際の値: [列挙]
- callsのcall_result実際の値: [列挙]
- 空白リード件数: X件
- inquiry_at月別分布: [列挙]

【STEP 1 SQL実行結果】
- callsトリガー: 作成成功
- 既存calls→leadsステータス一括反映: X件更新
- 空白リード削除: X件削除

【STEP 2 アナリティクス修正】
- ステータス定数修正: 実際の値に合わせた定数一覧を記載
- 着座数カラム削除: 完了
- アポOK内訳アコーディオン: 実装完了
- タブ構成変更: 完了

【STEP 3 リスト情報詳細修正】
- 見切れ修正: 完了
- 削除した項目: MEO精査・定休日
- 新人フラグ: 表示・編集可能
- ステータスプルダウン: 実装完了
- コール履歴に対応者: 追加完了

【STEP 4 絞り込み検索】
- SearchPanel.tsx: 作成完了
- 適用ページ: /list, /leads

【STEP 5 新規リード一覧】
- サブタブ追加: 完了
- 経過日数: 赤表示動作確認

【STEP 6 FM同期】
- pushToFM.ts: 作成完了
- Meta Webhook→leads自動追加: 実装完了
- FM環境変数: FM_HOST=SET/MISSING, FM_DATABASE=SET/MISSING ...

【環境変数状況】
[各変数のSET/MISSING一覧]

【ビルド】
npm run build: SUCCESS / エラーあり（詳細）

【残課題】
```
