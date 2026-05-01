# 指標定義書（METRICS_DEFINITION.md）
# 全指標の計算式・SQL・修正手順
# 2026年4月26日 統合決定版 v3

---

## 1. 設計思想

### 1.1 動的指標管理の原則

すべての指標は `metric_definitions` マスタテーブルで管理する。
新指標の追加・削除・編集は、エンジニアの介入なしで以下の経路で可能：

1. `/settings/metrics` 画面（推奨）
2. SQL直接実行（マスタへのINSERT）
3. Mastra Studio（AI Self-Improverが自動提案）

### 1.2 計算式の3タイプ

`formula_type` カラムで指定：

| タイプ | 用途 | formula列の内容 |
|-------|------|---------------|
| `preset` | 事前定義された計算ロジック | preset_key（例: `'lead_to_apo_rate'`） |
| `sql` | カスタムSQL式 | SQL断片（例: `'count(*) filter (where status = ''アポOK'')'`） |
| `jsonb_path` | JSONBパスからの値取得 | JSONBパス（例: `'custom_data->>"score"'`） |

### 1.3 修正手順の保証

**指標を追加するとき:**
- マスタへINSERTのみ（既存データに影響なし）
- 確認不要

**指標を削除するとき:**
- `is_visible = false` でソフト削除を推奨
- ハード削除する場合は `is_system = false` を確認してから

**指標の計算式を変更するとき:**
- 過去データの集計結果が変わる可能性あり
- 影響範囲を確認してから実行（広告マネージャー画面の表示が変わる）

---

## 2. 標準指標一覧（初期投入データ）

### 2.1 カウント系

| metric_key | label | formula_type | formula | unit |
|-----------|-------|--------------|---------|------|
| lead_count | リード数 | preset | lead_count | 件 |
| apo_ok_count | アポOK | preset | status_count:アポOK | 件 |
| seat_ok_count | 採用OK（着座） | preset | status_count:採用OK | 件 |
| seat_ng_count | 採用NG | preset | status_count:採用NG | 件 |
| in_progress_count | 調整中（商談前） | preset | status_count:調整中 | 件 |
| won_count | 受注 | preset | status_count:受注 | 件 |
| excluded_count | 対象外 | preset | status_count:対象外 | 件 |
| completed_count | 完了 | preset | category_count:completed | 件 |
| not_called_count | 未コール | preset | not_called | 件 |
| absent_count | 留守 | preset | status_count:留守 | 件 |
| prospect_a_count | 見込みA | preset | status_count:見込みA | 件 |
| prospect_b_count | 見込みB | preset | status_count:見込みB | 件 |
| prospect_c_count | 見込みC | preset | status_count:見込みC | 件 |
| not_completed_count | 未完了 | preset | category_count:not_completed | 件 |
| call_count | コール総数 | preset | call_count | 件 |

### 2.2 レート系（すべて対リード基準で再定義）

**重要: 「対リスト〜率」ではなく「対リード〜率」が正。**

| metric_key | label | 計算式 | unit |
|-----------|-------|--------|------|
| lead_to_apo_rate | 対リードアポ率 | apo_ok_count ÷ lead_count | % |
| lead_to_seat_rate | 対リード採用率 | seat_ok_count ÷ lead_count | % |
| lead_to_won_rate | **対リード受注率** | won_count ÷ lead_count | % |
| apo_to_seat_rate | 対アポ採用率 | seat_ok_count ÷ apo_ok_count | % |
| seat_to_won_rate | 対採用受注率 | won_count ÷ seat_ok_count | % |
| lead_completion_rate | リード完了率 | completed_count ÷ lead_count | % |

### 2.3 金額系

| metric_key | label | 計算式 | unit |
|-----------|-------|--------|------|
| total_won_amount | 総受注額 | sum(deals.amount where stage='受注') | 円 |
| avg_won_amount | 受注単価平均 | total_won_amount ÷ won_count | 円 |
| customer_ltv_total | 顧客LTV合計 | sum(customers.total_deal_amount) | 円 |
| customer_ltv_avg | 顧客LTV平均 | customer_ltv_total ÷ active_customer_count | 円 |

### 2.4 広告コスト系

| metric_key | label | 計算式 | unit |
|-----------|-------|--------|------|
| ad_spend_total | 広告費 | sum(ad_spend_daily.spend_amount) | 円 |
| impressions | インプレッション | sum(ad_spend_daily.impressions) | 件 |
| clicks | クリック数 | sum(ad_spend_daily.clicks) | 件 |
| reach | リーチ | sum(ad_spend_daily.reach) | 人 |
| ctr | CTR | clicks ÷ impressions | % |
| **cpc** | **CPC** (1クリック単価) | ad_spend_total ÷ clicks | 円 |
| **cpm** | **CPM** (1000表示単価) | ad_spend_total ÷ impressions × 1000 | 円 |
| **cpa** | **CPA** (1アポ獲得単価) | ad_spend_total ÷ apo_ok_count | 円 |
| **cpo** | **CPO** (1受注獲得単価) | ad_spend_total ÷ won_count | 円 |
| cpi | CPI (1インストール単価) | ad_spend_total ÷ installs | 円 |
| cpv | CPV (1再生単価) | ad_spend_total ÷ video_views | 円 |
| cpe | CPE (1エンゲージメント単価) | ad_spend_total ÷ engagements | 円 |
| **roas** | **ROAS** (広告費回収率) | total_won_amount ÷ ad_spend_total × 100 | % |
| **roi** | **ROI** (投資利益率) | (total_won_amount - total_cost) ÷ total_cost × 100 | % |
| **cac** | **CAC** (顧客獲得コスト) | total_cost ÷ new_customer_count | 円 |
| cost_per_lead | リード獲得単価 | ad_spend_total ÷ lead_count | 円 |

**total_cost** = ad_spend_total + 制作原価 + コンサル費 + 人件費（運用に応じて拡張可能）

### 2.5 コホート分析系（広告ROI追跡の核心）

| metric_key | label | 計算式 | unit |
|-----------|-------|--------|------|
| m0_won_count | 当月受注 | リード取得月内の受注数 | 件 |
| m1_won_count | 1ヶ月後累計受注 | リード取得月+1ヶ月時点の累計受注数 | 件 |
| m2_won_count | 2ヶ月後累計受注 | リード取得月+2ヶ月時点の累計受注数 | 件 |
| m3_won_count | 3ヶ月後累計受注 | リード取得月+3ヶ月時点の累計受注数 | 件 |
| m0_won_amount | 当月受注額 | 同上の受注金額累計 | 円 |
| m1_won_amount | 1ヶ月後累計受注額 | 同上 | 円 |
| m2_won_amount | 2ヶ月後累計受注額 | 同上 | 円 |
| m3_won_amount | 3ヶ月後累計受注額 | 同上 | 円 |
| m0_seat_count | 当月着座 | リード取得月内の採用OK数 | 件 |
| m1_seat_count | 1ヶ月後累計着座 | 同上 | 件 |
| m2_seat_count | 2ヶ月後累計着座 | 同上 | 件 |
| m3_seat_count | 3ヶ月後累計着座 | 同上 | 件 |

集計は `get_ad_cohort_metrics()` RPC関数で実行（DB_SCHEMA.sql 14.3 参照）。

---

## 3. プリセット計算ロジック実装

`src/lib/metrics/presets.ts` に以下を実装：

```typescript
export const METRIC_PRESETS = {
  // === カウント系 ===
  lead_count: (ctx) => `
    SELECT COUNT(*)::int FROM leads
    WHERE tenant_id = $1 AND inquiry_at::date BETWEEN $2 AND $3
  `,

  call_count: (ctx) => `
    SELECT COUNT(*)::int FROM calls
    WHERE tenant_id = $1 AND started_at::date BETWEEN $2 AND $3
  `,

  status_count: (ctx, statusKey) => `
    SELECT COUNT(*)::int FROM leads
    WHERE tenant_id = $1
      AND status = '${statusKey}'
      AND inquiry_at::date BETWEEN $2 AND $3
  `,

  category_count: (ctx, category) => `
    SELECT COUNT(*)::int FROM leads l
    JOIN status_definitions sd
      ON sd.tenant_id = l.tenant_id AND sd.status_key = l.status
    WHERE l.tenant_id = $1
      AND sd.category = '${category}'
      AND l.inquiry_at::date BETWEEN $2 AND $3
  `,

  not_called: (ctx) => `
    SELECT COUNT(*)::int FROM leads
    WHERE tenant_id = $1
      AND total_call_count = 0
      AND inquiry_at::date BETWEEN $2 AND $3
  `,

  // === レート系 ===
  lead_to_apo_rate: async (ctx) => {
    const lead = await runMetric(ctx, 'lead_count');
    const apo = await runMetric(ctx, 'status_count', 'アポOK');
    return lead > 0 ? (apo / lead) * 100 : 0;
  },

  lead_to_won_rate: async (ctx) => {
    const lead = await runMetric(ctx, 'lead_count');
    const won = await runMetric(ctx, 'status_count', '受注');
    return lead > 0 ? (won / lead) * 100 : 0;
  },

  // === 金額系 ===
  total_won_amount: (ctx) => `
    SELECT COALESCE(SUM(amount), 0)::bigint FROM deals
    WHERE tenant_id = $1
      AND stage = '受注'
      AND closed_at::date BETWEEN $2 AND $3
  `,

  // === 広告コスト系 ===
  ad_spend_total: (ctx) => `
    SELECT COALESCE(SUM(spend_amount), 0)::bigint FROM ad_spend_daily
    WHERE tenant_id = $1 AND spend_date BETWEEN $2 AND $3
  `,

  cpc: async (ctx) => {
    const spend = await runMetric(ctx, 'ad_spend_total');
    const clicks = await runMetric(ctx, 'clicks');
    return clicks > 0 ? spend / clicks : null;
  },

  cpa: async (ctx) => {
    const spend = await runMetric(ctx, 'ad_spend_total');
    const apo = await runMetric(ctx, 'status_count', 'アポOK');
    return apo > 0 ? spend / apo : null;
  },

  cpo: async (ctx) => {
    const spend = await runMetric(ctx, 'ad_spend_total');
    const won = await runMetric(ctx, 'status_count', '受注');
    return won > 0 ? spend / won : null;
  },

  roas: async (ctx) => {
    const spend = await runMetric(ctx, 'ad_spend_total');
    const won = await runMetric(ctx, 'total_won_amount');
    return spend > 0 ? (won / spend) * 100 : null;
  },

  roi: async (ctx) => {
    const cost = await runMetric(ctx, 'total_cost');
    const won = await runMetric(ctx, 'total_won_amount');
    return cost > 0 ? ((won - cost) / cost) * 100 : null;
  },

  cac: async (ctx) => {
    const cost = await runMetric(ctx, 'total_cost');
    const newCust = await runMetric(ctx, 'new_customer_count');
    return newCust > 0 ? cost / newCust : null;
  },
};
```

---

## 4. 動的カラムトグル UI

### 4.1 ポップオーバー仕様

ダッシュボード・広告マネージャー画面の右上に「View / Columns」ボタン。
クリックでポップオーバー表示：

```
┌─────────────────────────────┐
│  指標を選択                  │
├─────────────────────────────┤
│  ☑ リード数                  │
│  ☑ アポOK                    │
│  ☑ 採用OK（着座）            │
│  ☐ 採用NG                    │
│  ☑ 受注                      │
│  ─────────                   │
│  ☑ 対リードアポ率             │
│  ☑ 対リード受注率             │
│  ─────────                   │
│  ☑ ROAS                      │
│  ☑ CPA                       │
│  ☑ CPO                       │
│  ☐ CPC                       │
│  ☐ CPM                       │
│  [+ 新しい指標を追加]         │
└─────────────────────────────┘
```

### 4.2 保存先

`user_preferences.visible_metrics jsonb`:
```json
[
  "lead_count",
  "apo_ok_count",
  "seat_ok_count",
  "won_count",
  "lead_to_apo_rate",
  "lead_to_won_rate",
  "roas",
  "cpa",
  "cpo"
]
```

### 4.3 実装パターン

```tsx
// src/components/ads/column-toggle.tsx
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { useMetricDefinitions } from '@/lib/hooks/useMetricDefinitions';

export function ColumnToggle() {
  const { metrics } = useMetricDefinitions();
  const { visibleMetrics, toggleMetric } = useUserPreferences();

  return (
    <Popover>
      <PopoverTrigger className="btn btn-ghost">
        <Columns3Icon size={14} /> 指標
      </PopoverTrigger>
      <PopoverContent>
        {Object.entries(groupBy(metrics, 'category')).map(([cat, items]) => (
          <div key={cat}>
            <div className="text-xs text-gray-400">{cat}</div>
            {items.map(m => (
              <Checkbox
                key={m.metric_key}
                checked={visibleMetrics.includes(m.metric_key)}
                onChange={() => toggleMetric(m.metric_key)}
                label={m.label}
              />
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
```

---

## 5. 指標の追加手順

### 5.1 画面から追加（推奨）

1. `/settings/metrics` を開く
2. 「+ 新しい指標」をクリック
3. 以下を入力：
   - 指標キー（英数字スネークケース）
   - 表示名（日本語）
   - カテゴリ（count / rate / amount / cost / cohort）
   - 計算式タイプ（preset / sql / jsonb_path）
   - 計算式の内容
   - 単位（%, 円, 件など）
4. 「保存」で完了

### 5.2 SQLで追加

```sql
INSERT INTO metric_definitions (
  tenant_id,
  metric_key,
  label,
  category,
  formula_type,
  formula,
  unit,
  display_order
) VALUES (
  '<your_tenant_id>',
  'avg_call_duration',
  '平均通話時間',
  'count',
  'sql',
  'SELECT AVG(duration_seconds) FROM calls WHERE tenant_id = $1 AND started_at::date BETWEEN $2 AND $3',
  '秒',
  100
);
```

### 5.3 AIによる自動提案（Self-Improver）

データ蓄積が一定数を超えると、Self-Improverが新指標を自動提案する。
例: 「業種別リード→受注の転換率」「曜日別アポ率」など。

提案は `agent_instructions` テーブルに `instruction_type='new_metric_proposal'` で記録。
SVが `/ai/instructions` 画面で承認すると `metric_definitions` に自動追加される。

---

## 6. 指標の修正手順（重要：影響範囲を確認）

### 6.1 軽微な変更（影響なし）

- `label` の変更（表示名のみ）
- `display_order` の変更
- `is_visible` の変更
- `unit` の変更（表示形式のみ）

→ 確認不要、即時反映

### 6.2 重大な変更（要確認）

- `formula` の変更（計算式）
- `formula_type` の変更
- `category` の変更（カテゴリの集計に影響）

→ Claude Codeは実行前にユーザーに確認を取る
→ 過去データへの影響範囲をログに残す

### 6.3 削除

- `is_system = true` の指標は削除不可（ソフト削除のみ）
- `is_system = false` の指標はハード削除可能（user_preferences から自動除外される）

---

## 7. メトリクス取得 API

### 7.1 単一指標取得

```typescript
// GET /api/metrics/:metric_key?from=2025-09-01&to=2025-09-30&campaign_id=xxx
{
  "metric_key": "lead_to_apo_rate",
  "label": "対リードアポ率",
  "value": 22.5,
  "unit": "%",
  "period": { "from": "2025-09-01", "to": "2025-09-30" }
}
```

### 7.2 複数指標一括取得

```typescript
// POST /api/metrics/batch
// body: { keys: ["lead_count", "apo_ok_count", "roas"], from, to, ... }
{
  "results": {
    "lead_count":      { "value": 294, "unit": "件" },
    "apo_ok_count":    { "value": 66,  "unit": "件" },
    "roas":            { "value": 135.6, "unit": "%" }
  }
}
```

### 7.3 コホート分析

```typescript
// POST /api/metrics/cohort
// body: { campaign_id, lookahead_months: 3 }
[
  {
    "cohort_month": "2025-09-01",
    "campaign_id": "...",
    "leads_count": 96,
    "m0": { "apo": 20, "seat": 16, "won": 7,  "amount": 980000 },
    "m1": { "apo": 22, "seat": 17, "won": 8,  "amount": 1100000 },
    "m2": { "apo": 23, "seat": 18, "won": 9,  "amount": 1250000 },
    "m3": { "apo": 23, "seat": 18, "won": 9,  "amount": 1250000 }
  }
]
```

---

## 8. 同一顧客フィルタの仕様

### 8.1 デフォルト動作

- **デフォルト: フィルタOFF（全部カウント）**
- 同じ顧客が複数広告から流入した場合、各広告のリード数として全部計上
- 理由: 広告費は実際にかかっているため、各広告のROI評価には全リード計上が正

### 8.2 フィルタON時の動作

- リード数 = `count(DISTINCT customer_id)`
- アポ・受注数も distinct で集計
- ROAS は変わらない（受注金額は重複しないため）
- CPA / CPO は変わる（分母が小さくなる）

### 8.3 UI

広告マネージャー画面右上にトグル：
```
[● 全リードカウント] [○ 同一顧客除外]
```

`get_ad_roi(p_distinct_customers boolean)` の引数で切り替え。

---

## 9. 修正履歴・ログ

### 9.1 マスタ変更ログ

`metric_definitions` の変更は監査ログに記録：

```sql
CREATE TABLE metric_change_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  metric_key text not null,
  changed_field text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references tenant_members(id),
  changed_at timestamptz not null default now()
);
```

### 9.2 計算結果のキャッシュ無効化

指標の計算式が変わった場合、キャッシュを無効化する：

```typescript
// src/lib/metrics/cache.ts
export async function invalidateMetricCache(metricKey: string) {
  // Redis or in-memory cache を無効化
  await cache.delete(`metric:${metricKey}:*`);
}
```

---

## 10. 関連ドキュメント

- `REQUIREMENTS.md` — 要件定義書（全体像）
- `DB_SCHEMA.sql` — テーブル定義（metric_definitions の物理定義）
- `AD_MANAGER_SPEC.md` — 広告マネージャーでの利用例

---

_End of METRICS_DEFINITION.md_
