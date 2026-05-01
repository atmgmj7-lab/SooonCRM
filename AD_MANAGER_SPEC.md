# 広告マネージャー画面 詳細仕様書（AD_MANAGER_SPEC.md）
# 媒体×クリエイティブ×コホート追跡UI
# 2026年4月26日 統合決定版 v3

---

## 1. 画面構成

### 1.1 ルーティング

```
/ads                          ← 広告マネージャー（メイン）
/ads/campaigns                ← キャンペーン詳細
/ads/campaigns/[id]           ← 個別キャンペーン
/ads/creatives                ← クリエイティブ一覧
/ads/creatives/[id]           ← 個別クリエイティブ詳細
```

### 1.2 メイン画面のセクション構成

```
┌──────────────────────────────────────────────────────────────┐
│ ヘッダー（ページタイトル + 期間フィルタ + 動的カラムトグル）       │
├──────────────────────────────────────────────────────────────┤
│ KPIサマリーカード（4枚）                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│ │ 広告費   │ │ リード   │ │ ROAS    │ │ CPO     │                │
│ │ ¥3.2M   │ │ 294      │ │ 135.6%  │ │ ¥85,000│                │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                │
├──────────────────────────────────────────────────────────────┤
│ メインテーブル（媒体×キャンペーン×クリエイティブ別）              │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 媒体 / KP名 / クリエイティブ / 広告費 / リード / ROAS │    │
│ │ Meta / Lead Gen / 金額表示_ポップ_… / ¥1.2M / 96 / 142% │  │
│ │ Google / 検索 / キーワードA / ¥800K / 75 / 128%         │  │
│ │ ...                                                    │    │
│ └──────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│ コホート分析パネル（リード取得月×経過月別 累計受注追跡）          │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ 9月コホート: 96リード → M0:7  M1:8  M2:9  M3:9  受注    │    │
│ │ 10月コホート: 110リード → M0:5  M1:7  M2:8  -          │    │
│ │ ...                                                    │    │
│ └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. ヘッダー領域

### 2.1 期間フィルタ

```tsx
<div className="flex items-center gap-2">
  <Tabs value={period} onChange={setPeriod}>
    <Tab value="today">今日</Tab>
    <Tab value="last_7d">直近7日</Tab>
    <Tab value="last_30d">直近30日</Tab>
    <Tab value="this_month">今月</Tab>
    <Tab value="last_month">先月</Tab>
    <Tab value="custom">カスタム</Tab>
  </Tabs>
  {period === 'custom' && (
    <DateRangePicker value={dateRange} onChange={setDateRange} />
  )}
</div>
```

### 2.2 同一顧客フィルタトグル

```tsx
<ToggleGroup value={customerMode} onChange={setCustomerMode}>
  <ToggleItem value="all">全リードカウント（広告費基準）</ToggleItem>
  <ToggleItem value="distinct">同一顧客除外（純粋新規）</ToggleItem>
</ToggleGroup>
```

デフォルトは `all`（広告費は両方にかかっているため）。

### 2.3 動的カラムトグル

```tsx
<Popover>
  <PopoverTrigger>
    <Button variant="ghost" size="sm">
      <Columns3Icon size={14} /> 指標 ({visibleMetrics.length})
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <MetricToggleList />
  </PopoverContent>
</Popover>
```

詳細は `METRICS_DEFINITION.md` 参照。

### 2.4 媒体フィルタ

```tsx
<MultiSelect value={selectedPlatforms} onChange={setSelectedPlatforms}>
  <Option value="meta">Meta（FB/IG）</Option>
  <Option value="google">Google Ads</Option>
  <Option value="other">その他</Option>
</MultiSelect>
```

---

## 3. KPIサマリーカード

### 3.1 表示する4指標（ユーザーがカスタマイズ可能）

デフォルト:
1. 広告費総額（ad_spend_total）
2. 獲得リード数（lead_count）
3. ROAS
4. CPO（受注単価）

カードコンポーネント:

```tsx
<Card className="border border-gray-200 rounded-lg p-4">
  <div className="text-xs text-gray-500">広告費</div>
  <div className="text-2xl font-semibold tabular-nums mt-1">¥3,250,000</div>
  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
    <TrendIcon direction="up" />
    <span className="text-green-600">+12.4%</span> vs 前期
  </div>
</Card>
```

### 3.2 比較期間

直近期間 vs 同じ長さの前期間を比較表示。
- 直近30日 → 前30日
- 今月 → 先月

---

## 4. メインテーブル（媒体×キャンペーン×クリエイティブ）

### 4.1 階層構造

3階層で展開可能：
1. 媒体（Meta / Google）
2. キャンペーン（Meta - Lead Gen / Meta - Conversion）
3. クリエイティブ（金額表示_ポップ_イラスト20250622 / etc）

### 4.2 デフォルト表示カラム

```
| 階層名 | 広告費 | インプ | クリック | リード | アポ | 着座 | 受注 | ROAS | CPA | CPO |
```

ユーザーが動的カラムトグルで以下を追加可能：
- CPC / CPM / CTR
- ROI / CAC
- 対リードアポ率 / 対リード受注率
- M0/M1/M2/M3 累計受注（コホート列）

### 4.3 レンダリング例

```tsx
<table className="w-full text-sm">
  <thead className="border-b border-gray-200 bg-gray-50">
    <tr>
      <th className="text-left p-3">階層 / 名前</th>
      {visibleMetrics.map(m => (
        <th key={m.key} className="text-right p-3">{m.label}</th>
      ))}
    </tr>
  </thead>
  <tbody>
    {hierarchicalRows.map(row => (
      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
        <td className="p-3">
          <div style={{ paddingLeft: row.level * 16 }} className="flex items-center gap-2">
            {row.hasChildren && (
              <button onClick={() => toggleRow(row.id)}>
                <ChevronRightIcon className={row.expanded ? 'rotate-90' : ''} />
              </button>
            )}
            {row.level === 0 && <PlatformIcon platform={row.platform} />}
            <span className={row.level === 0 ? 'font-semibold' : ''}>{row.name}</span>
          </div>
        </td>
        {visibleMetrics.map(m => (
          <td key={m.key} className="p-3 text-right tabular-nums">
            {formatMetric(row.metrics[m.key], m)}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
</table>
```

### 4.4 並び替え・絞り込み

- カラムヘッダークリック → そのカラムでソート
- 行右クリック → コンテキストメニュー（リード一覧を表示 / クリエイティブ詳細など）

---

## 5. コホート分析パネル

### 5.1 表示内容

「リード取得月別×経過月別の累計受注追跡」をマトリクスで表示。

```
┌─────────────────────────────────────────────────────────────────┐
│ コホート分析 (リード取得月別)                  [メトリクス: 受注 ▼] │
├─────────────────────────────────────────────────────────────────┤
│ 月       | リード | M0    | M1    | M2    | M3    | 最終     │
├─────────────────────────────────────────────────────────────────┤
│ 2025-09  | 96    | 7     | 8     | 9     | 9     | 9.4%      │
│ 2025-10  | 110   | 5     | 7     | 8     | -     | 7.3%      │
│ 2025-11  | 124   | 8     | 9     | -     | -     | 7.3%      │
│ 2025-12  | 89    | 4     | -     | -     | -     | 4.5%      │
│ 2026-01  | 102   | 6     | -     | -     | -     | 5.9%      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 メトリクス切替

ドロップダウンで以下を切替：
- 受注数（won_count）
- 受注額（won_amount）
- アポ数（apo_count）
- 着座数（seat_count）

### 5.3 セルのカラーリング

ヒートマップ的に：
- 数値が高いほど濃い緑
- 数値が低いほど薄い色（グレー）

```tsx
<td style={{
  backgroundColor: getHeatmapColor(value, columnMax),
  color: value > columnMax * 0.7 ? 'white' : 'black',
}} className="p-2 text-center tabular-nums">
  {value}
</td>
```

### 5.4 グラフ表示（オプション）

折れ線グラフモードで「コホート別の受注推移」を視覚化：

```
受注数
  ↑
  │     2025-09コホート ●─────●──────●────●
  │   2025-10コホート ●─────●──────●─?
  │ 2025-11コホート ●─────●─?
  │
  └────────────────────────→ 経過月
       M0       M1      M2     M3
```

Recharts の `LineChart` で実装。

### 5.5 データ取得

`get_ad_cohort_metrics()` RPC を使用（DB_SCHEMA.sql 14.3 参照）。

```typescript
// src/lib/hooks/useAdCohorts.ts
export function useAdCohorts(campaignId?: string, lookaheadMonths = 3) {
  return useQuery({
    queryKey: ['ad-cohorts', campaignId, lookaheadMonths],
    queryFn: async () => {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.rpc('get_ad_cohort_metrics', {
        p_campaign_id: campaignId,
        p_lookahead_months: lookaheadMonths,
      });
      return data;
    },
  });
}
```

---

## 6. 個別キャンペーン画面

### 6.1 URL

`/ads/campaigns/[id]`

### 6.2 表示内容

```
┌──────────────────────────────────────────────────────┐
│ Meta / Lead Gen キャンペーン                         │
│ 状態: ● Active   開始日: 2025-09-01                  │
├──────────────────────────────────────────────────────┤
│ KPIサマリー（広告費 / リード / アポ / 受注 / ROAS）    │
├──────────────────────────────────────────────────────┤
│ クリエイティブ別パフォーマンス                          │
│ ┌────────────────────────────────────────────┐    │
│ │ サムネイル / 名前 / 広告費 / リード / ROAS   │    │
│ └────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│ このキャンペーンから来たリード一覧                       │
│ ┌────────────────────────────────────────────┐    │
│ │ 顧客名 / 流入日 / 現在ステータス / 受注額    │    │
│ └────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│ コホート分析（このキャンペーン限定）                     │
└──────────────────────────────────────────────────────┘
```

---

## 7. 個別クリエイティブ画面

### 7.1 URL

`/ads/creatives/[id]`

### 7.2 表示内容

- クリエイティブのサムネイル
- メタデータ（headline, body, CTA, image_url）
- KPIサマリー
- このクリエイティブから来たリード一覧
- このクリエイティブから来たコール一覧（音声プレビュー可能）
- AI分析: 「このクリエイティブの強み・弱み」（Self-Improverの結果）

---

## 8. AI推奨パネル

画面右側のサイドパネルに「AI Ad ROI Analyzer」の判定を表示。

```tsx
<AIInsightPanel>
  <Insight type="alert" priority="high">
    <Icon /> 警告: 「Meta - Lead Gen - クリエイティブX」
    の CPA が前週比 +35% に悪化しています
  </Insight>
  <Insight type="recommendation" priority="medium">
    <Icon /> 推奨: 「Google - キーワードA」
    のROASが過去最高水準です。予算増額の検討を提案します
  </Insight>
  <Insight type="info" priority="low">
    <Icon /> 発見: コホート2025-09の3ヶ月後受注率が
    前コホート比 +1.2pt 改善しています
  </Insight>
</AIInsightPanel>
```

---

## 9. 数値フォーマット規則

すべての数値表示は `tabular-nums` クラス必須。

```typescript
// src/lib/format.ts
export function formatMetric(value: number | null, metric: MetricDef): string {
  if (value === null || value === undefined) return '-';

  switch (metric.unit) {
    case '%':
      return `${value.toFixed(1)}%`;
    case '円':
      return `¥${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
    case '件':
    case '人':
      return value.toLocaleString('ja-JP');
    default:
      return value.toString();
  }
}
```

---

## 10. デザインシステム適用

### 10.1 カラー使用ルール

- 良い数値（プラス成長・受注） → `var(--color-success)` `#0F6E56`
- 悪い数値（マイナス成長・失注） → `var(--color-danger)` `#A32D2D`
- 中立的な数値 → `var(--color-gray-900)` `#0F172A`
- 補助情報 → `var(--color-gray-600)` `#475569`

### 10.2 スペーシング

- カード間 24px
- カード内padding 16px
- テーブルセルpadding 12px

### 10.3 ヘッダーfontサイズ

- ページタイトル 22px / 600
- セクションタイトル 18px / 600
- カードラベル 12px / 500
- カード数値 22px / 700
- テーブルヘッダー 12px / 500
- テーブルセル 13px / 400

---

## 11. データ取得のパフォーマンス対策

### 11.1 キャッシュ戦略

- `get_ad_roi()` の結果は 5分キャッシュ（React Query）
- `get_ad_cohort_metrics()` は 1時間キャッシュ
- 期間フィルタ変更時は強制再取得

### 11.2 マテリアライズドビュー（オプション）

集計が遅い場合は以下のマテリアライズドビューを作成：

```sql
CREATE MATERIALIZED VIEW mv_ad_daily_summary AS
SELECT
  tenant_id,
  campaign_id,
  creative_id,
  date_trunc('day', spend_date) AS day,
  SUM(spend_amount) AS spend,
  SUM(impressions) AS impressions,
  SUM(clicks) AS clicks
FROM ad_spend_daily
GROUP BY tenant_id, campaign_id, creative_id, date_trunc('day', spend_date);

CREATE INDEX ON mv_ad_daily_summary (tenant_id, day DESC);

-- 日次cronで refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ad_daily_summary;
```

---

## 12. 関連ドキュメント

- `REQUIREMENTS.md` — 全体要件
- `DB_SCHEMA.sql` — get_ad_roi / get_ad_cohort_metrics RPC定義
- `METRICS_DEFINITION.md` — 全指標の計算式
- `AI_LEARNING_FOUNDATION.md` — Ad ROI Analyzer 詳細

---

_End of AD_MANAGER_SPEC.md_
