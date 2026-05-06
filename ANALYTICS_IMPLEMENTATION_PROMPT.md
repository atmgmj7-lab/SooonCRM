# アナリティクス画面 実装プロンプト（Claude Code用）

> **目的**: スプレッドシートで行っている広告集計をそのままWebアプリに移植し、追加指標を含むアナリティクス画面を構築する。
> **対象URL**: https://sooon-crm.vercel.app
> **tenant_id**: `dde9bea6-a017-49e6-a1b6-88494e1e3b4d`

---

## 0. 作業前提・絶対ルール

- DB操作は **Supabase クライアント直接クエリ**（RPC未定義のものは `supabase.from().select()` で直接実行してよい）
- `tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'` を **全クエリに必ず付与**
- Server Componentでデータ取得し、Client Componentでインタラクション（フィルタ・タブ切替）を担当
- `src/app/(dashboard)/analytics/` 配下に配置
- サイドバー（`src/components/layout/sidebar.tsx`）に「アナリティクス」メニュー項目を追加
- カラーは既存デザインシステムに準拠: primary `#0D9488`、bg `#F5F7FA`、border `#E5E7EB`、dark sidebar `#111827`
- 無意味な色変えをしない（セクション見出しを恣意的に青・赤にするなど禁止）
- chart ライブラリは **recharts**（既存インストール済み）を使用
- `date-fns` で日付処理

---

## 1. サイドバー修正

**ファイル**: `src/components/layout/sidebar.tsx`

既存ナビゲーション配列に以下を追加する。「集計」(`/reports`) の**直後**に挿入すること。

```typescript
{
  href: '/analytics',
  label: 'アナリティクス',
  icon: BarChart2, // lucide-react
}
```

アイコンは `BarChart2` (lucide-react)。スタイルは既存 `nav-item` クラスと同一。

---

## 2. ルーティング・ファイル構成

```
src/app/(dashboard)/analytics/
├── page.tsx                    # Server Component: データ取得 + レイアウト
├── loading.tsx                 # Skeleton UI
└── _components/
    ├── AnalyticsClient.tsx     # Client Component: タブ・フィルタ制御
    ├── AdSummaryTable.tsx      # 広告別サマリーテーブル
    ├── MonthlyTrendChart.tsx   # 月次推移チャート（recharts）
    ├── FunnelMetrics.tsx       # ファネル指標セクション
    ├── CallEfficiencyPanel.tsx # 架電効率パネル
    └── KpiCardRow.tsx          # 最上部KPIカード行
```

---

## 3. データ取得クエリ（Supabase）

### 3.1 広告別集計クエリ

`page.tsx` の Server Component 内で実行する。

```typescript
// ① 広告別 リード数・アポ数・見込み数・受注数
const { data: adStats } = await supabase
  .from('leads')
  .select(`
    ad_name,
    status,
    last_call_result,
    inquiry_at,
    deals ( deal_amount )
  `)
  .eq('tenant_id', 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d')
  .not('ad_name', 'is', null)

// ② 月別リード数（時系列）
const { data: monthlyLeads } = await supabase
  .from('leads')
  .select('inquiry_at, status, last_call_result, ad_name')
  .eq('tenant_id', 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d')
  .gte('inquiry_at', '2025-01-01')
  .order('inquiry_at', { ascending: true })

// ③ 架電効率: 問い合わせ→初回架電時間
const { data: callEfficiency } = await supabase
  .from('calls')
  .select('lead_id, list_record_id, started_at, result, call_count')
  .eq('tenant_id', 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d')
  .not('started_at', 'is', null)

// ④ 受注データ
const { data: deals } = await supabase
  .from('deals')
  .select('lead_id, deal_amount, closed_at')
  .eq('tenant_id', 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d')
```

### 3.2 集計ロジック（Server Componentまたは utils 関数）

`src/app/(dashboard)/analytics/_lib/aggregations.ts` に切り出す:

```typescript
// ステータス判定
const APPO_STATUSES = ['アポOK', 'アポ獲得']
const MIKOMI_STATUSES = ['見込みA', '見込みB', '見込みC']
const KANRYO_STATUSES = ['完了']
const MIКАНRYO_STATUSES = ['未コール', '留守', '見込みA', '見込みB', '見込みC']

export function aggregateByAd(leads: Lead[], deals: Deal[]): AdSummaryRow[] {
  // ad_name でグループ化
  // リード数: COUNT(*)
  // アポ数: COUNT WHERE status IN APPO_STATUSES OR last_call_result IN APPO_STATUSES
  // アポ率: アポ数 / リード数
  // 見込み数: COUNT WHERE status IN MIKOMI_STATUSES
  // 完了数: COUNT WHERE status IN KANRYO_STATUSES
  // 完了率: 完了数 / リード数
  // 受注数: deals に紐づく件数
  // 受注率: 受注数 / リード数
  // 総受注額: deals.deal_amount の SUM
  // CPO: 広告費 / 受注数 ← 広告費は別途 webhook_leads や手動入力から（暫定: null表示）
}

export function aggregateByMonth(leads: Lead[]): MonthlyRow[] {
  // inquiry_at で YYYY-MM にグループ化
  // 各月: リード数, アポ数, アポ率, 完了数, 完了率, 見込み数
  // 未コール数, 留守数
}
```

---

## 4. 画面仕様

### 4.1 ページヘッダー

```
アナリティクス
広告→リード→受注 パフォーマンス分析

[期間フィルタ: 全期間 / 直近3ヶ月 / 直近6ヶ月 / カスタム]  [広告名フィルタ: ドロップダウン]  [エクスポート CSV]
```

### 4.2 最上部KPIカード（6枚）

スプレッドシートの「ネクサス合計」行に相当。

| KPI | 計算式 |
|-----|--------|
| 総リード数 | COUNT(leads) |
| 総アポ数 | COUNT(status IN APPO_STATUSES) |
| アポ率 | アポ数 / リード数 × 100 |
| 完了率 | 完了数 / リード数 × 100 |
| 総受注額 | SUM(deals.deal_amount) |
| ROAS | 総受注額 / 総広告費 × 100（広告費未入力時は「-」） |

カードデザイン: 既存 `.kpi` クラスと同一スタイル。背景 `#fff`、ボーダー `#E5E7EB`、数値は `DM Mono` フォント。

### 4.3 タブ構成

```
[広告別サマリー] [月次推移] [架電効率] [ファネル分析]
```

#### タブ1: 広告別サマリーテーブル

スプレッドシートの各広告ブロック（行方向）をそのまま表形式に。

**テーブルカラム（左→右）**:

| # | カラム名 | 説明 |
|---|---------|------|
| 1 | 広告名 | ad_name |
| 2 | リード数 | COUNT |
| 3 | アポ数 | status=アポOK等 |
| 4 | アポ率 | アポ数/リード数 |
| 5 | 見込み数 | status=見込みA/B/C |
| 6 | 完了数 | status=完了 |
| 7 | 完了率 | 完了数/リード数 |
| 8 | 未完了数 | 未コール+留守+見込みA/B/C |
| 9 | 受注数 | deals件数 |
| 10 | 受注率 | 受注数/リード数 |
| 11 | 総受注額 | SUM deals |
| 12 | 対リストアポ率 | アポ数/リード数（再掲） |
| 13 | 対完了アポ率 | アポ数/完了数 |
| 14 | 対リスト着座率 | 採用OK/リード数 |
| 15 | 対アポ着座率 | 採用OK/アポ数 |

テーブルスタイル: 既存 `.ltbl` クラスを流用。ヘッダー `#1E293B` 背景、データ行 zebra。率・金額列は `DM Mono` フォント。合計行は太字 `#F0FDF4` 背景。

#### タブ2: 月次推移チャート

**チャート1: 月別リード数（棒グラフ）**
- x軸: YYYY年MM月
- y軸: リード数
- 色: `#0D9488`

**チャート2: 月別アポ率推移（折れ線グラフ）**
- x軸: YYYY年MM月  
- y軸: アポ率(%)
- 色: `#10B981`

**チャート3: 月別完了率推移（折れ線グラフ）**
- 色: `#6366F1`

3つのチャートを縦に並べる（各 `height: 200px`）。

**月次サマリーテーブル（チャートの下）**:
スプレッドシートのrow3〜row24相当を再現。

| 年月 | リスト数 | アポOK | 調整中 | 採用OK | 採用NG | 受注 | 対象外 | 完了 | 未コール | 留守 | 見込みA | 見込みB | 見込みC | 未完了 | アポ率 | 完了率 |
|------|---------|--------|--------|--------|--------|------|--------|------|---------|------|---------|---------|---------|--------|--------|--------|

#### タブ3: 架電効率

**パネル1: 問い合わせ→初回架電 時間分布**（棒グラフ）
- X軸: 0-1時間 / 1-3時間 / 3-6時間 / 6-24時間 / 1日以上
- Y軸: 件数
- ※ calls.started_at - leads.inquiry_at で計算（callsにlead_idがある新規データのみ）
- 過去データ（lead_id未紐づけ）はこのパネルから除外し「※新規Webhook流入データのみ」と注記

**パネル2: 架電回数別アポ率**（折れ線）
- X軸: 1回, 2回, 3回, 4回, 5回+
- Y軸: アポ率(%)
- callsのcall_count別にアポ率を集計

**パネル3: 時間帯別接続率**（棒グラフ）
- X軸: 9時, 10時, 11時, ... 19時
- Y軸: 接続率(%)（結果がNG/留守以外の率）
- calls.started_at の時間帯で集計

#### タブ4: ファネル分析

**ファネルウォーターフォール（横棒グラフ）**:
```
リード流入   ████████████████████  1,210件
アポ獲得     ████████              286件 (23.6%)
見込み       ████                  79件  (6.5%)
受注         ██                    38件  (3.1%)
```

**広告別ファネル比較テーブル**:
- 行: 広告名
- 列: リード数 / アポ率 / 見込み率 / 受注率
- アポ率が高い順にソート

---

## 5. フィルタ実装

`AnalyticsClient.tsx` に state を持たせる:

```typescript
const [dateRange, setDateRange] = useState<'all' | '3m' | '6m' | 'custom'>('all')
const [selectedAd, setSelectedAd] = useState<string>('all')
const [activeTab, setActiveTab] = useState<'summary' | 'monthly' | 'efficiency' | 'funnel'>('summary')
```

- 期間フィルタ: `inquiry_at` で絞り込み
- 広告フィルタ: `ad_name` で絞り込み
- フィルタ変更時は Server Action または client-side再集計（データ量が少ないためclient-side再集計でOK）

---

## 6. CSVエクスポート

「エクスポート CSV」ボタンクリック時:

```typescript
function exportCsv(rows: AdSummaryRow[]) {
  const headers = ['広告名', 'リード数', 'アポ数', 'アポ率', '見込み数', '完了数', '完了率', '受注数', '受注率', '総受注額']
  const csv = [headers, ...rows.map(r => [
    r.adName, r.leads, r.appo, r.appoRate, r.mikomi, r.kanryo, r.kanryoRate, r.deals, r.dealRate, r.revenue
  ])].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }) // BOM付きUTF-8
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `analytics_${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
}
```

---

## 7. Skeleton / Loading UI

`loading.tsx`:
```tsx
export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      {/* KPIカード行 */}
      <div className="grid grid-cols-6 gap-3">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="h-24 rounded-lg skeleton" />
        ))}
      </div>
      {/* テーブル */}
      <div className="h-96 rounded-lg skeleton" />
    </div>
  )
}
```

`skeleton` クラスは既存グローバルCSSに定義済み（shimmerアニメーション）。

---

## 8. エラーハンドリング

- Supabaseクエリ失敗時: `<ErrorBoundary>` でキャッチし「データの取得に失敗しました」を表示
- データ0件時: 空テーブル + 「データがありません」メッセージ（テーブルそのものは描画する）
- 数値がNullの場合: ハイフン「-」表示

---

## 9. パフォーマンス考慮

- `page.tsx` でSupabaseクエリを `Promise.all` で並列実行
- 集計ロジックはServer Componentで実施し、Client Componentにはすでに集計済みのデータを渡す
- rechartsのチャートは `dynamic import` + `ssr: false` で遅延ロード

```typescript
// page.tsx
const [adStatsRes, monthlyRes, callsRes, dealsRes] = await Promise.all([
  supabase.from('leads').select(...),
  supabase.from('leads').select(...),
  supabase.from('calls').select(...),
  supabase.from('deals').select(...),
])
```

---

## 10. 型定義

`src/app/(dashboard)/analytics/_lib/types.ts`:

```typescript
export type AdSummaryRow = {
  adName: string
  leads: number
  appo: number
  appoRate: number        // 0-100
  mikomi: number
  kanryo: number
  kanryoRate: number
  mikanryo: number
  deals: number
  dealRate: number
  revenue: number
  // 詳細率
  appoRateVsKanryo: number
  chakuzaRateVsList: number
  chakuzaRateVsAppo: number
}

export type MonthlyRow = {
  month: string            // "2026-01"
  leads: number
  appo: number
  chosei: number           // 調整中
  saiyo: number            // 採用OK
  saiyoNg: number
  juchu: number            // 受注
  taishogai: number        // 対象外
  kanryo: number
  miCall: number
  rusu: number
  mikomiA: number
  mikomiB: number
  mikomiC: number
  mikanryo: number
  appoRate: number
  kanryoRate: number
}

export type CallEfficiencyRow = {
  callCount: number        // 1, 2, 3, 4, 5
  total: number
  appo: number
  appoRate: number
}
```

---

## 11. 完成確認チェックリスト

実装後、以下を全て確認すること:

- [ ] `/analytics` にアクセスしてページが表示される
- [ ] サイドバーに「アナリティクス」が表示され、クリックでページ遷移する
- [ ] KPIカード6枚が正しい数値で表示される（Supabaseの実データ）
- [ ] 広告別サマリーテーブルで全広告が行として表示される
- [ ] アポ率・完了率が小数点1桁の%で表示される（例: 23.6%）
- [ ] 月次推移チャートが2025年6月〜現在まで描画される
- [ ] 架電効率タブで「新規Webhook流入データのみ」注記が表示される
- [ ] フィルタ（期間・広告名）が機能する
- [ ] CSVエクスポートでBOM付きUTF-8のファイルがダウンロードされる
- [ ] データが0件の広告でもテーブル行は表示される（全0表示）
- [ ] `tenant_id` フィルタが全クエリに適用されている
- [ ] モバイル幅でテーブルが横スクロール可能である
- [ ] Vercel デプロイ後もエラーなく動作する

---

## 12. 実装順序（推奨）

1. **型定義** → `_lib/types.ts`, `_lib/aggregations.ts`
2. **page.tsx** → Supabaseクエリ + Promise.all + 集計関数呼び出し
3. **KpiCardRow.tsx** → 6枚のKPIカード
4. **AdSummaryTable.tsx** → 広告別テーブル（最重要）
5. **MonthlyTrendChart.tsx** → rechartsで月次チャート
6. **CallEfficiencyPanel.tsx** → 架電効率3パネル
7. **FunnelMetrics.tsx** → ファネル分析
8. **AnalyticsClient.tsx** → タブ・フィルタ統合
9. **loading.tsx** → Skeleton
10. **サイドバー修正** → `sidebar.tsx` に「アナリティクス」追加

---

## 13. 注意事項・既知の制約

### データの制約（コード内コメントで明記すること）

```typescript
/**
 * NOTE: calls と leads の lead_id 紐づけは新規Webhook流入（source='meta_ads'）から開始。
 * 過去データ（source='other', 2,817件）は last_call_result に架電結果が入っているが
 * lead_id 未紐づけのため、架電効率パネルは新規データのみを対象とする。
 * 
 * アポ判定: status または last_call_result が 'アポOK' / 'アポ獲得' のいずれか
 * 見込み判定: status が '見込みA' / '見込みB' / '見込みC' のいずれか
 */
```

### 広告費・CPO・ROAS について

現時点でSupabaseに広告費データが存在しない場合、CPO/ROASカラムは「-」表示とし、ツールチップで「広告費データが未連携です」と表示する。将来的な広告費テーブル連携を考慮してカラムは設けておく。

### ad_name が null のリード

`ad_name IS NULL` のリードは「広告名未設定」として1行にまとめてテーブルに含める。

