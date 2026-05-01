# AI CRM OS — 要件定義書 兼 実行指示書（統合決定版）
# このファイルをプロジェクトルートに配置してClaude Codeに読み込ませること
# 2026年4月26日 統合決定版 v3

---

## 本ドキュメントの使い方

このファイルをプロジェクトルートに `REQUIREMENTS.md` として配置する。
Claude Code を起動して以下を指示する:

```
REQUIREMENTS.mdを読んで、セクション15「実行手順」の通りに上から順番に全て実行してください。
DB スキーマに関わる重大な変更が発生する場合は、必ず私に確認を取ってから進めてください。
エラーが出たら止まらず報告しながら続けてください。
```

**関連ドキュメント（同階層に配置）:**
- `CLAUDE.md` — Claude Code ルール（必読）
- `DB_SCHEMA.sql` — 確定スキーマ
- `METRICS_DEFINITION.md` — 全指標の計算式
- `FM_SYNC_DESIGN.md` — FileMaker同期設計
- `AI_LEARNING_FOUNDATION.md` — AI学習基盤
- `AD_MANAGER_SPEC.md` — 広告マネージャー画面仕様
- `EXECUTION_PLAN.md` — Claude Code 実行手順

---

## 1. プロダクト概要

### 1.1 ビジョン
営業組織の1次情報（架電データ・受注結果・広告パフォーマンス）をAIが自律学習し、
トップ営業マンの動きを分析・再現して、人間は話すだけという状態を作るCRM。

### 1.2 フェーズ戦略

| フェーズ | 主軸 | 期間目安 |
|---------|------|---------|
| **Phase 0** | 環境構築・スキーマ確定・FM片方向同期 | 1週間 |
| **Phase 1** | FM→Supabase 同期で1次情報蓄積開始、AIステータスダッシュボード稼働 | 2-3週間 |
| **Phase 2** | AIエージェント本格稼働、広告マネージャー実装、Self-Improver起動 | 1ヶ月 |
| **Phase 3** | CRM→FM 逆方向同期の段階的有効化、音声録音・文字起こし統合 | 2ヶ月 |
| **Phase 4** | SaaS販売モード（CRMエディタ）開発開始 | 将来 |

### 1.3 モジュール設計

```
┌─────────────────────────────────────────────┐
│        AI CRM OS コアプラットフォーム         │
│  ┌──────────┐  ┌──────────┐  ┌────────┐    │
│  │ データ基盤 │  │ AI Agent │  │ 認証   │    │
│  │ Supabase │  │ Mastra   │  │ Clerk  │    │
│  └──────────┘  └──────────┘  └────────┘    │
├─────────────────────────────────────────────┤
│  UIモジュール（切り替え可能）                 │
│  ┌────────────────────┐  ┌──────────────┐   │
│  │ FM分析モジュール     │  │ CRMエディタ  │   │
│  │ (Phase 1主軸)       │  │ (将来・保留) │   │
│  └────────────────────┘  └──────────────┘   │
├─────────────────────────────────────────────┤
│  AI学習基盤（3層保存 + RAG）                  │
│  ┌────────────┐ ┌────────────┐ ┌────────┐   │
│  │ 構造化層    │ │ 非構造化層  │ │ベクトル │   │
│  │ Postgres   │ │ R2+Postgres│ │pgvector│   │
│  └────────────┘ └────────────┘ └────────┘   │
└─────────────────────────────────────────────┘
```

### 1.4 CRMエディタ（保留）
現フェーズでは保留。`src/modules/crm-editor/` ディレクトリは作成のみ行い、
中身は `.gitkeep` のみ配置する。Phase 4で実装予定。

---

## 2. 技術スタック

| レイヤー | 技術 | バージョン | 採用根拠 |
|---------|------|-----------|---------|
| フレームワーク | Next.js | 16.2 | Turbopack安定版、AGENTS.md標準搭載、proxy.ts対応 |
| エージェント基盤 | Mastra | 1.x | TypeScript製、MCP双方向、Observability内蔵 |
| ホスティング | Vercel | - | Next.js最適、Cron Jobs、Edge Functions |
| 認証 | Clerk | - | Organizations機能でマルチテナント |
| バックグラウンド | Trigger.dev | v3 | Vercel Cronの10秒制限を超える長時間処理 |
| 構造化DB | Supabase (PostgreSQL) | - | RLS、Realtime、型生成 |
| ベクトルDB | Supabase pgvector | - | 同一DB内でJOIN可能、RLS適用、追加コスト$0 |
| 音声ストレージ | Cloudflare R2 | - | エグレス無料、S3互換 |
| AI監視 | Langfuse | - | OpenTelemetry経由でMastra連携、セルフホスト可 |
| エージェント監視 | Mastra Studio | - | トレース・メトリクス・ログ一元管理 |

### AIモデル（用途別）

| 用途 | モデル | 理由 |
|------|--------|------|
| リードスコアリング（大量） | Gemini 2.0 Flash | 最安・高速 |
| コール要約・KPI分析 | Gemini 2.0 Flash | 定型タスク向き |
| スクリプト生成・コーチング | Claude Sonnet 4 | 高精度な日本語生成 |
| パターン発見・自己改善 | Claude Sonnet 4 | 複雑な推論 |
| ベクトル化 | OpenAI text-embedding-3-small | 最安・1536次元 |
| 文字起こし（Phase 3） | OpenAI Whisper large-v3 | 日本語精度最高 |

Mastraモデルルーターで全モデル切り替え可能。将来のモデル更新もコード変更不要。

---

## 3. データモデル設計（核心）

### 3.1 設計思想

「営業のプロとDBのプロとして完璧」を実現するため、以下の構造を採用する。

**4層エンティティ:**

```
customers (顧客マスタ・1人=1レコード)
   ├── leads (問い合わせ・1顧客に複数)
   │      ├── calls (架電・1リードに複数)
   │      └── deals (受注・1リードに最大1)
   └── customer_ltv (顧客単位の集計ビュー)
```

**重要な性質:**
1. **顧客は同一性キー `phone + customer_id` で一意** — 同じ顧客が違う広告で再流入しても1顧客
2. **ステータスは leads（問い合わせ）単位** — 広告Aで来たリードと広告Bで来たリードで別ステータス
3. **コール結果はリードのステータスに昇格** — 各リードの最新コール結果がそのリードの現在ステータス
4. **受注金額はリード単位で記録** — 顧客LTVは集計ビューで取得
5. **広告ROIは重複リードも全部カウント** — 広告費は実際にかかっているため
6. **指標は動的に追加削除可能** — `metric_definitions` マスタ駆動

### 3.2 データ拡張性の担保（最重要）

「今後新しい広告媒体やKPI（LTV、紹介数、CPI、CPV等）が増減することを前提」とするため、以下を採用：

1. **JSONB活用**: 変動しやすいフィールドは `custom_data jsonb` に格納
2. **メタデータ駆動**: `metric_definitions` マスタテーブルで指標の計算式・表示順を管理
3. **ステータスマスタ**: `status_definitions` で状態名・色・遷移可否を動的管理
4. **広告クリエイティブはJSONBで段階拡張**: ad_name は必須、creative_id/画像は順次拡張

これにより、エンジニアでなくてもMastra Studio・管理画面から指標追加可能。

### 3.3 確定スキーマ概要

詳細は `DB_SCHEMA.sql` を参照。ここでは概要のみ。

```sql
-- ===== コアエンティティ =====
tenants               -- マルチテナント
tenant_members        -- ユーザー
customers             -- 顧客マスタ（CS0140436等のCSコード継承）
leads                 -- 問い合わせ（広告流入セッション・ステータス保持）
calls                 -- 架電履歴（FMコール履歴と完全対応）
deals                 -- 受注（リード単位）

-- ===== 広告系 =====
ad_campaigns          -- 広告キャンペーン（Meta/Google 等）
ad_creatives          -- 広告クリエイティブ（クリエイティブ別追跡）
ad_spend_daily        -- 広告費日次（CPC/CPM/CPA算出元）

-- ===== AI/学習系 =====
call_transcripts      -- 文字起こし（Phase 3）
call_embeddings       -- ベクトル化（pgvector・RAG用）
agent_instructions    -- AI判断ログ（Human in the Loop）
agent_metrics         -- エージェント精度推移
agent_patterns        -- Self-Improverが発見したパターン

-- ===== マスタ・設定 =====
metric_definitions    -- 指標マスタ（動的追加可能）
status_definitions    -- ステータスマスタ（動的追加可能）
field_mappings        -- FMフィールドマッピング
tenant_schemas        -- カスタムフィールド定義（将来CRMエディタ用）

-- ===== FM同期系 =====
fm_sync_log           -- FM同期ログ（差分・エラー記録）
fm_sync_queue         -- 双方向化時のキュー（Phase 3対応）
```

---

## 4. ステータス定義（動的マスタ）

### 4.1 ステータス遷移フロー

リード（問い合わせ）のステータスは、`status_definitions` マスタで動的管理される。
初期値として以下を投入する。

```
[新規流入]
  └─ 新規 → 留守 / 保留 → 見込みC → 見込みB → 見込みA → アポOK
                                                          ↓
                                                       採用OK（着座）
                                                          ↓
                                                       受注 / 失注
  分岐: 対象外 / NG（即時終了）
  完了状態: 採用OK / 採用NG / 受注 / 失注 / 対象外 / NG = 完了系
  未完了状態: 新規 / 留守 / 保留 / 見込みABC / アポOK / 調整中 = 未完了系
```

### 4.2 status_definitions マスタ初期投入データ

| status_key | label | category | order_index | color | is_completed |
|-----------|-------|----------|-------------|-------|--------------|
| 新規 | 新規 | initial | 1 | #94A3B8 | false |
| 留守 | 留守 | pending | 2 | #8B5CF6 | false |
| 保留 | 保留 | pending | 3 | #6366F1 | false |
| 見込みC | 見込みC | nurturing | 4 | #60A5FA | false |
| 見込みB | 見込みB | nurturing | 5 | #3B82F6 | false |
| 見込みA | 見込みA | nurturing | 6 | #2563EB | false |
| アポOK | アポOK | confirmed | 7 | #15803D | false |
| 調整中 | 調整中（商談前） | confirmed | 8 | #854F0B | false |
| 採用OK | 採用OK（着座） | won_path | 9 | #1D4ED8 | true |
| 採用NG | 採用NG | lost | 10 | #DC2626 | true |
| 受注 | 受注 | won | 11 | #0D9488 | true |
| 失注 | 失注 | lost | 12 | #A32D2D | true |
| 対象外 | 対象外 | excluded | 13 | #94A3B8 | true |
| NG | NG（即時拒否） | lost | 14 | #DC2626 | true |
| 過去データ未分類 | 過去データ（未分類） | legacy | 15 | #CBD5E1 | true |

### 4.3 ステータス昇格ルール

リードのステータス（leads.status）は、最新コール結果（calls.result）から自動昇格する。

```sql
-- トリガー: calls INSERT時に leads.status を更新
-- ルール: 最新の calls.started_at の calls.result を leads.status にコピー
-- 例外: leads.status_locked_at がある場合（手動でロック）は昇格しない
```

詳細は `DB_SCHEMA.sql` のトリガー定義を参照。

---

## 5. 指標定義（動的マスタ）

### 5.1 設計

`metric_definitions` マスタで指標を動的管理する。エンジニアでなくても追加可能。

```sql
create table metric_definitions (
  id uuid primary key,
  tenant_id uuid not null,
  metric_key text not null,           -- "lead_to_apo_rate" など
  label text not null,                -- "対リードアポ率"
  category text not null,             -- count / rate / amount / cost
  formula_type text not null,         -- 'sql' / 'jsonb_path' / 'preset'
  formula text not null,              -- SQL式（preset_keyの場合は事前定義キー）
  unit text,                          -- '%' / '円' / '件'
  display_order int,                  -- 表示順
  is_visible boolean default true,    -- 表示/非表示
  is_system boolean default false,    -- システム標準（削除不可）
  created_at timestamptz,
  updated_at timestamptz
);
```

### 5.2 標準指標の初期投入

詳細は `METRICS_DEFINITION.md` 参照。ここでは項目のみ列挙：

**カウント系:**
- リード数 / アポOK / 採用OK / 採用NG / 調整中 / 受注 / 対象外 / 完了 / 未コール / 留守 / 見込みA・B・C / 未完了

**レート系（すべて対リード基準に修正）:**
- 対リードアポ率 = アポOK ÷ リード数
- 対リード採用率 = 採用OK ÷ リード数
- 対リード受注率 = 受注 ÷ リード数（※「対リスト〜率」から修正）
- 対アポ採用率 = 採用OK ÷ アポOK
- 対採用受注率 = 受注 ÷ 採用OK
- リード完了率 = 完了系合計 ÷ リード数

**金額系:**
- 総受注額（リード単位合計）
- 顧客LTV（顧客単位合計・LTVビュー経由）
- 受注単価平均

**広告コスト系（媒体別×クリエイティブ別×期間別で算出可能）:**
- CPC = 広告費 ÷ クリック数
- CPM = 広告費 ÷ インプレッション × 1000
- CPA = 広告費 ÷ アポ獲得数
- CPO = 広告費 ÷ 受注数
- CPI = 広告費 ÷ アプリインストール数（適用時のみ）
- CPV = 広告費 ÷ 動画再生数（適用時のみ）
- CPE = 広告費 ÷ エンゲージメント数（適用時のみ）
- ROAS = 受注金額 ÷ 広告費
- ROI = (受注金額 - 全コスト) ÷ 全コスト
- CAC = 全コスト（広告費+人件費等）÷ 新規受注顧客数

**コホート分析系（広告ROI追跡の核心）:**
- 当月受注 / 1ヶ月後累計受注 / 2ヶ月後累計受注 / 3ヶ月後累計受注
- 当月着座 / 1ヶ月後累計着座 / ...
- 当月アポ / 1ヶ月後累計アポ / ...
- 集計軸: リード取得日基準で月別コホート

### 5.3 動的カラムトグルUI

ダッシュボード・広告マネージャー画面で「View / Columns」ボタンを設置。
クリックするとポップオーバーUIで `metric_definitions` を一覧表示し、
チェックボックスで表示/非表示を動的切り替え可能。

設定はユーザー単位で保存（`user_preferences.visible_metrics`）。

---

## 6. 広告ROI・コホート追跡（営業の核心要件）

### 6.1 同一顧客の重複リード扱い

**結論: 全部カウントする（同一顧客フィルタOFFがデフォルト）**

理由: 広告費は実際に各広告にかかっているため、各広告のROI評価には全リードを計上すべき。
ただし、純粋な新規顧客評価をしたい場合のために「同一顧客フィルタON/OFF」トグルを提供する。

### 6.2 コホート分析の定義

**「当月リード×Nヶ月後の累計受注/着座/アポ」を時系列で追跡する。**

例:
- 2025年9月にMeta Lead Genで取得したリード96件
  - 当月時点: 受注7件、着座16件、アポ20件
  - 1ヶ月後（10月末時点）: 受注8件、着座17件、アポ22件
  - 2ヶ月後（11月末時点）: 受注9件、着座18件、アポ23件
  - 3ヶ月後（12月末時点）: 受注9件、着座18件、アポ23件

これにより「当月だけでは判断できない、リードのライフサイクル全体での広告ROI」を評価できる。

### 6.3 実装方針

`leads.created_at` と `leads.status_history`（jsonb配列・各ステータスの遷移日時）から、
`get_ad_cohort_metrics(campaign_id, cohort_month, lookahead_months)` RPC関数で集計する。

詳細は `AD_MANAGER_SPEC.md` 参照。

---

## 7. AIエージェント設計

### 7.1 エージェント一覧

| エージェント | 役割 | モデル | トリガー |
|------------|------|--------|---------|
| Lead Scorer | 温度感・優先度判定 | Gemini Flash | リード登録時 |
| Call Time Optimizer | 最適架電時間提示 | Gemini Flash | 毎朝8:00 Cron |
| Response Advisor | スクリプト・対応方針 | Claude Sonnet | 架電画面表示時 |
| Deal Predictor | 受注確率予測 | Claude Sonnet | ステータス変更時 |
| Ad ROI Analyzer | 広告別ROI分析・コホート分析 | Gemini Flash | 週次月曜9:00 |
| Self-Improver | 成功パターン抽出・新ルール提案 | Claude Sonnet | データ1000件到達時 |

### 7.2 デフォルト分析指標（運用中に調整可能）

**Lead Scorer:**
- 問い合わせ内容のキーワード（「すぐ」「今月中」= hot）
- 同業種の過去アポ率
- 問い合わせ時間帯（営業時間内 = 温度高め）
- フォーム回答の具体性（予算・時期の記載有無）
- 同一顧客の過去リード履歴（過去に受注実績あり = hot）

**Call Time Optimizer:**
- 過去コールの時間帯別接続率
- 過去コールの時間帯別アポ率
- 曜日別パターン
- 業種別の傾向

**Deal Predictor:**
- リード取得から商談までの日数
- 架電回数
- 通話時間の推移（増加傾向 = 好兆候）
- 担当者の過去受注パターンとの類似度

**Ad ROI Analyzer:**
- 広告別×クリエイティブ別リード数
- 広告別アポ率・着座率・受注率
- 広告別CPA（アポ単価）/ CPO（受注単価）/ CAC
- コホート別Nヶ月後受注追跡
- クリエイティブ別の温度感分布

### 7.3 Human in the Loop

- 自動実行: Lead Scorer（即時性が必要）
- 承認必要: リスト配分変更、スクリプト更新、新エージェント追加
- 全判断を `agent_instructions` テーブルに記録

### 7.4 自律学習ループ

```
1次情報蓄積（calls + leads + deals）
   → Self-Improverが成功パターン抽出
   → 「この条件でアポ率3倍」を発見
   → SVに提案通知
   → 承認
   → エージェントルール自動追加（agent_patterns に保存）
   → さらにデータ蓄積（ループ）
```

### 7.5 3層保存基盤（AI学習のため）

すべての営業活動は同時に3層へ保存される。詳細は `AI_LEARNING_FOUNDATION.md` 参照。

```
[現実の営業活動]
  ↓ Vercel Edge Functions + Mastra Workflow（リアルタイム処理パイプライン）
  ↓ 全イベントを3方向に分岐

①構造化層 (Supabase PostgreSQL)
  - calls（架電ログ・結果・時刻・担当者ID）
  - leads（リスト状態・スコア・廃棄フラグ）
  - agent_metrics（成績）

②非構造化層 (Cloudflare R2 + Supabase)
  - 音声ファイル（mp3）→ R2に保存・URL参照
  - 文字起こしテキスト（Whisper → DB保存）
  - 操作ログJSON

③ベクトル層 (pgvector on Supabase)
  - コール内容の意味embedding保存
  - 成功パターンベクトル・類似検索の基盤
  - スクリプト意味DB

  ↓ RAG検索エンジン (Mastra + pgvector)
  「このリードに似た過去の成功コールを検索して」→ 3層を横断して最適な文脈を返す

  ↓
[3つのAIエージェント群]
- 学習・分析エージェント（成功パターンを自動抽出・重要項目を自己発見）
- 指示出しエージェント（アポインターへ具体的アクション提示）
- 自己改善エージェント（データが増えるほど精度が上がる仕組み）

  ↓
[アポインター画面 / SV管理画面]
「今日14:00-15:00にAリストへ架電。このスクリプトで。3件は掘り起こし対象」
```

---

## 8. AIステータスダッシュボード（Phase 0で実装）

エンジニアでなくても以下が一目で分かるダッシュボード画面を作成する。
パス: `/dashboard/ai-status`

### 8.1 表示項目

**データ蓄積状況パネル:**
- 総リード数（今月/累計）
- 総コール数（今月/累計）
- 受注数・受注額（今月/累計）
- データ蓄積率バー（「AI精度向上まであとXX件」）

**AIエージェント状態パネル:**
- 各エージェントのON/OFF状態
- 各エージェントの精度（承認率 = approved / total）
- 最終実行日時
- 直近の指示一覧（承認待ち・承認済み・却下）

**学習進捗パネル:**
- 精度推移グラフ（agent_metricsテーブルから描画）
- 「AIが発見したパターン」のリスト（agent_patternsから）
- 「次に精度が上がるために必要なデータ」の表示

**広告ROIパネル:**
- 広告別アポ率・受注率のランキング
- コホート別Nヶ月後受注の傾向
- 「この広告は受注に繋がっていない」のアラート

### 8.2 技術実装
- Rechartsでグラフ描画
- Supabase Realtimeで数値をリアルタイム更新
- agent_metricsテーブルから精度推移を取得
- get_tenant_kpi RPCからKPIを取得
- get_ad_roi RPCから広告別ROIを取得
- get_ad_cohort_metrics RPCからコホート分析を取得

---

## 9. 主要画面仕様

### 9.1 サイドバー構造（左固定・ネスト構造）

```
[GrowthHub (logo)]
  ├─ ダッシュボード
  │    ├─ KPIトップ        /dashboard
  │    └─ AIステータス      /dashboard/ai-status
  ├─ 顧客
  │    ├─ 顧客一覧          /customers
  │    └─ 顧客詳細          /customers/[id]
  ├─ リード
  │    ├─ リード一覧         /leads
  │    └─ リード詳細         /leads/[id]
  ├─ コール
  │    └─ コール履歴         /calls
  ├─ 商談・受注
  │    └─ ディール          /deals
  ├─ 広告
  │    ├─ 広告マネージャー   /ads
  │    ├─ キャンペーン       /ads/campaigns
  │    └─ クリエイティブ     /ads/creatives
  ├─ AI
  │    ├─ エージェント       /ai/agents
  │    └─ 指示一覧          /ai/instructions
  └─ 設定
       ├─ 指標マスタ          /settings/metrics
       ├─ ステータスマスタ    /settings/statuses
       ├─ FMマッピング       /settings/fm-mapping
       ├─ FM同期ログ         /settings/fm-sync-log
       └─ ユーザー           /settings/users
```

### 9.2 リード詳細画面（タイムライン型）

LinearのIssue画面のような無駄な枠線のないクリーンな縦タイムライン。

**ヘッダー領域:**
- 顧客名 / 会社名 / 業種 / 都道府県
- 現在ステータスバッジ
- AIスコア（温度感: hot/warm/cold）
- 関連リード数（同一顧客の他リード件数）

**タイムライン本体（時系列降順）:**
- Touchpoint 1: 広告クリック（Meta等）
- Touchpoint 2: フォーム入力
- Touchpoint 3: インサイドセールス架電（FileMaker由来 calls）
  - 架電日時、担当、結果、通話時間、メモ、音声リンク（Phase 3）
- Touchpoint 4: 商談・見積
- Touchpoint 5: 受注/失注

**サイドパネル（右）:**
- 同一顧客の他リード一覧（過去広告A、現在広告B、未来広告C…）
- AI推奨アクション
- 関連スクリプト（RAG検索結果）

### 9.3 広告マネージャー画面

詳細は `AD_MANAGER_SPEC.md` 参照。

**主要機能:**
- 媒体（Meta/Google 等）×クリエイティブ別フィルタ
- 期間フィルタ（日次/週次/月次/カスタム）
- コホート分析モード（リード取得月別Nヶ月後追跡）
- 動的カラムトグル（CPC/CPM/CPA/CPO/CPI/CPV/CPE/ROAS/ROI/CAC）
- 同一顧客フィルタON/OFFトグル

### 9.4 顧客詳細画面（LTVビュー）

1顧客に紐づく全リード・全コール・全受注を統合表示。

- ヘッダー: 顧客基本情報 + LTV合計
- セクション1: 流入履歴タイムライン（広告A→B→C）
- セクション2: 全コール履歴
- セクション3: 全受注（リード単位）+ LTV算出
- セクション4: AI予測（次回流入時期 / 解約リスク）

---

## 10. デザインシステム（厳守）

### 10.1 デザイン原則

「極限のノイズレス」を徹底。過度なカードデザイン（影や太い枠線）は禁止し、
背景色による区切りやタイポグラフィのウェイト（太さ・コントラスト）のみで情報を整理する。
数字の縦のラインがブレないよう、必ず `tabular-nums` を使用。

### 10.2 フォント

```css
font-family: 'Hiragino Sans', 'ヒラギノ角ゴシック', 'Hiragino Kaku Gothic ProN',
             'ヒラギノ角ゴ ProN W3', sans-serif;
```

- フォントサイズスケール: 11 / 12 / 13 / 14 / 15 / 18 / 22px の7段階のみ
- フォントウェイト: 400 / 500 / 600 / 700 の4段階のみ
- 数字: 同フォントで `tabular-nums` 適用

### 10.3 カラーシステム（CSS変数）

```css
/* Primary（ネイビー基調） */
--color-navy:        #0D1B2A;   /* サイドバー背景・最重要テキスト */
--color-navy-mid:    #1A3A5C;   /* サイドバーホバー */
--color-blue:        #2563EB;   /* アクセント・リンク・プライマリボタン */
--color-blue-light:  #EFF6FF;

/* Semantic */
--color-success:     #0F6E56;
--color-success-bg:  #E1F5EE;
--color-warning:     #854F0B;
--color-warning-bg:  #FAEEDA;
--color-danger:      #A32D2D;
--color-danger-bg:   #FCEBEB;

/* Neutral */
--color-gray-50:     #F8FAFC;   /* ページ背景 */
--color-gray-100:    #F1F5F9;
--color-gray-200:    #E2E8F0;   /* ボーダー */
--color-gray-400:    #94A3B8;
--color-gray-600:    #475569;
--color-gray-900:    #0F172A;   /* メインテキスト */
--color-white:       #FFFFFF;
```

### 10.4 スペーシング（8の倍数）

4 / 8 / 12 / 16 / 24 / 32 / 48px のみ使用。中途半端な値（13, 18, 22px等）禁止。

### 10.5 角丸

- 4px: バッジ・タグ・インラインpill
- 8px: ボタン・インプット・小カード
- 12px: メインカード・パネル
- 16px: モーダル・ドロップダウン
- 9999px: 丸ボタン・アバター

### 10.6 モーション制限

- transition は `duration-150`（150ms）以下のみ
- 許可: `transition-colors`, `transition-opacity`, `animate-spin`, `animate-pulse`
- 禁止: 位置・サイズアニメーション全般、ページロード時のフェードイン

### 10.7 レイアウト構造

新モック（AI_CRM.html）の **構造のみ採用**（カラーは上記Hiraginoネイビー）。
- 左サイドバー固定（ネイビー背景）
- ヘッダー固定
- メインコンテンツ可変
- タブバーは画面上部
- カードは細枠（1px solid var(--color-gray-200)、角丸8-12px）
- テーブルは `tabular-nums` 必須

---

## 11. FileMaker同期設計

### 11.1 Phase 1（現フェーズ）: FM→Supabase 片方向

**安全に1次情報を貯めるため、まずは読み取り専用で同期する。**

- FM（既存システム）が書き込み権限を持つマスタ
- Supabaseは読み取りミラー
- CRM画面では編集UIは表示するが、保存時はキューにのみ積む（実FMには書き込まない）
- Phase 3で `fm_sync_queue` を有効化し、CRM→FMの逆方向同期を段階的に開始

### 11.2 同期方式

- FileMaker Data API → Next.js API Route → Supabase
- FMの「修正タイムスタンプ」をキーに差分のみ取得（デルタ同期）
- Vercel Cron（毎時）+ 手動トリガー `/api/cron/sync-fm` の2経路
- FMレコードIDは `fm_record_id` カラムで管理（重複同期防止）

### 11.3 マッピング

- FMの `コール履歴` レイアウト → `calls` テーブル
- FMの `リスト情報` レイアウト → `leads` テーブル + `customers` テーブル
- FMの顧客ID（CS0140436等）→ `customers.customer_code`（同一性キー）
- FMにあってSupabaseに対応カラムがない項目 → `custom_data jsonb` に格納
- フィールド名は `fm-import/field-mapping/` の記載を絶対の正とする

### 11.4 双方向化への準備（Phase 3で有効化）

- `fm_sync_queue` テーブルは Phase 1 から作成（中身は使わない）
- CRM側の編集アクションは内部でキュー登録ロジックを通すが、Phase 1 では `enabled=false` フラグで停止
- Phase 3 で `enabled=true` に切り替え、Trigger.dev ジョブでキューを処理

詳細は `FM_SYNC_DESIGN.md` 参照。

---

## 12. Claude Code 開発環境

### 12.1 構築方法（重要）

```
重い作業（設計・全体把握）
  → cc-companyの秘書室で会話
  → 必要な部署だけ呼ぶ
  → トークン: 多めでOK

軽い作業（実装・単純修正）
  → claude-cursor-orchestrationでCursorに直接委譲
  → Claude Codeはルーティングだけ
  → トークン: 最小限

調査・リサーチ系
  → ccmuxで別ペインに切り出す
  → メインセッションを汚染しない
  → トークン: 独立消費
```

### 12.2 プラグイン構成

| プラグイン | 用途 | 導入タイミング |
|-----------|------|-------------|
| cc-company | タスク管理・部署振り分け | Phase 0 |
| everything-claude-code (ECC) | コード品質・セキュリティ | Phase 0 |
| claude-cursor-orchestration | Cursor連携・UI実装委譲 | Phase 0 |
| ccmux | 並列調査・リサーチ | Phase 0 |
| frontend-design (skill) | UI実装時に必読 | Phase 0 |

### 12.3 cc-company 部署構成

```
/company
├── 秘書（窓口・全タスクの最初の受付）
├── CEO（戦略判断・大規模変更承認）
├── PM（タスク振り分け・スケジューリング）
├── データ基盤部 → Supabase・スキーマ・FM同期・API
├── エージェント部 → Mastra・Workflow・AI学習
├── UI部 → Next.js 16・分析画面・frontend-design準拠
└── QA部 → テスト・セキュリティ（ECC scan必須）
```

### 12.4 ECCルール（重要）

- PR前に必ず `npx ecc-agentshield scan` を実行
- スキーマ変更は必ずマイグレーション経由（ダッシュボード直接SQL禁止）
- 環境変数は `.env.local` のみ、コミット禁止
- 機密データ（API key, 顧客情報）はコード上にハードコード禁止
- 詳細は `https://claude-note.jp/2026/04/20/plugin-ecc/` を参照

### 12.5 frontend-design スキル

UI実装時は必ず `/mnt/skills/public/frontend-design/SKILL.md` を読み込んでから着手する。
Tailwind CSS、コンポーネント設計、アクセシビリティの規約が記載されている。

---

## 13. データ拡張性（重要・後で修正可能な構造の担保）

「修正が大規模になるので確認も絶対いれてほしい」というご要望に応えるため、
以下の3層で拡張性を担保する。

### 13.1 マスタテーブル駆動（コード変更不要で追加可能）

| マスタ | 内容 | 追加方法 |
|-------|------|---------|
| `metric_definitions` | 指標 | `/settings/metrics` 画面 or SQL |
| `status_definitions` | ステータス | `/settings/statuses` 画面 or SQL |
| `field_mappings` | FMマッピング | `/settings/fm-mapping` 画面 |
| `ad_campaigns` | 広告キャンペーン | 広告APIから自動取得 or 手動 |
| `ad_creatives` | クリエイティブ | 広告APIから自動取得 or 手動 |

### 13.2 JSONB拡張（既存テーブルに新項目追加）

| テーブル | JSONBカラム | 用途 |
|---------|------------|-----|
| `customers` | `custom_data` | 顧客の追加属性 |
| `leads` | `custom_data` / `source_data` | リードの追加属性・流入元詳細 |
| `calls` | `custom_data` | コールの追加メタデータ |
| `deals` | `custom_data` | 受注の追加属性 |
| `ad_creatives` | `metadata` | クリエイティブの画像URL等 |

### 13.3 マイグレーション保護ルール（厳守）

**新規カラム追加・新規テーブル作成は確認なしでOK:**
- 既存データに影響なし
- 例: `leads.new_column` を追加

**以下は必ず確認を取ること（破壊的変更）:**
- 既存カラムの削除
- 既存カラムの型変更
- 既存テーブルの削除
- リネーム（旧名カラムを使っているコードが壊れるため）
- インデックス削除
- RLSポリシーの大規模変更

Claude Codeは破壊的変更が必要だと判断したら、実行前に必ずユーザーに確認を取る。

---

## 14. 月額コスト（参考）

| サービス | 月額 |
|---------|------|
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Clerk | 無料 |
| Trigger.dev | 無料 |
| Langfuse | 無料 |
| Gemini Flash | ~$10 |
| Claude Sonnet | ~$40 |
| OpenAI Embeddings | ~$5 |
| Cloudflare R2 | ~$5 |
| **合計** | **約$105/月（約16,000円）** |

---

## 15. 実行手順（Claude Codeがこの通りに実行する）

### STEP 0: 事前確認（重要）

Claude Codeは作業を開始する前に、必ず以下を確認する：

1. プロジェクトルートに `REQUIREMENTS.md`, `CLAUDE.md`, `DB_SCHEMA.sql`, `METRICS_DEFINITION.md`,
   `FM_SYNC_DESIGN.md`, `AI_LEARNING_FOUNDATION.md`, `AD_MANAGER_SPEC.md`, `EXECUTION_PLAN.md` が存在するか
2. `fm-import/screenshots/`, `fm-import/xml-ddr/`, `fm-import/field-mapping/` フォルダが存在するか
3. cc-company / everything-claude-code / claude-cursor-orchestration が `~/.claude/plugins/` に展開されているか

存在しない場合は STEP 1 から実行する。

### STEP 1: プロジェクト作成

```bash
npx create-next-app@latest ai-crm-os \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd ai-crm-os
```

### STEP 2: パッケージインストール

```bash
npm install \
  @supabase/supabase-js @supabase/ssr @clerk/nextjs \
  @mastra/core @mastra/libsql \
  ai @ai-sdk/anthropic @ai-sdk/google openai \
  zod date-fns recharts \
  @trigger.dev/sdk @trigger.dev/react \
  lucide-react

npm install -D supabase @types/node
```

### STEP 3: Mastra初期化

```bash
npx mastra@latest init
# agents: YES, workflows: YES, RAG: YES, memory: YES, provider: Anthropic
```

### STEP 4: fm-importフォルダ作成

```
fm-import/
├── README.md（配置説明）
├── screenshots/.gitkeep
├── xml-ddr/.gitkeep
└── field-mapping/.gitkeep
```

### STEP 5: ディレクトリ構成作成

```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                       # サイドバー+ヘッダー
│   │   ├── dashboard/
│   │   │   ├── page.tsx                      # KPIトップ
│   │   │   └── ai-status/page.tsx            # AIステータス
│   │   ├── customers/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── leads/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx                 # タイムライン詳細
│   │   ├── calls/page.tsx
│   │   ├── deals/page.tsx
│   │   ├── ads/
│   │   │   ├── page.tsx                      # 広告マネージャー
│   │   │   ├── campaigns/page.tsx
│   │   │   └── creatives/page.tsx
│   │   ├── ai/
│   │   │   ├── agents/page.tsx
│   │   │   └── instructions/page.tsx
│   │   └── settings/
│   │       ├── metrics/page.tsx
│   │       ├── statuses/page.tsx
│   │       ├── fm-mapping/page.tsx
│   │       ├── fm-sync-log/page.tsx
│   │       └── users/page.tsx
│   ├── onboarding/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/
│       ├── webhooks/clerk/route.ts
│       ├── leads/route.ts
│       ├── calls/route.ts
│       ├── deals/route.ts
│       ├── customers/route.ts
│       ├── metrics/route.ts
│       ├── statuses/route.ts
│       └── cron/
│           ├── sync-fm/route.ts              # FM→Supabase
│           ├── ad-roi/route.ts               # 週次広告ROI
│           └── agent-metrics/route.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── filemaker/
│   │   ├── client.ts                         # FM Data API
│   │   ├── sync.ts                           # 同期ロジック
│   │   └── mappers.ts                        # FM→Supabase変換
│   ├── metrics/
│   │   ├── calculator.ts                     # 動的指標計算
│   │   └── presets.ts                        # 標準指標
│   └── trigger.ts
├── modules/
│   ├── fm-layout/                            # FM分析モジュール（Phase 1主軸）
│   │   ├── components/
│   │   └── hooks/
│   └── crm-editor/                           # 保留（空フォルダ）
│       └── .gitkeep
├── mastra/
│   ├── index.ts
│   ├── agents/
│   │   ├── lead-scorer.ts
│   │   ├── call-time-optimizer.ts
│   │   ├── response-advisor.ts
│   │   ├── deal-predictor.ts
│   │   ├── ad-roi-analyzer.ts
│   │   └── self-improver.ts
│   └── workflows/
│       ├── transcript-processor.ts
│       └── pattern-discovery.ts
├── components/
│   ├── ui/                                   # 基本UI（frontend-design準拠）
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   └── header.tsx
│   ├── dashboard/
│   │   └── ai-status/
│   ├── leads/
│   │   ├── timeline.tsx                      # タイムライン詳細
│   │   └── status-badge.tsx
│   ├── calls/
│   ├── ads/
│   │   ├── manager-table.tsx                 # 広告マネージャーテーブル
│   │   ├── cohort-view.tsx                   # コホート分析
│   │   └── column-toggle.tsx                 # 動的カラム
│   └── settings/
│       ├── metric-editor.tsx
│       └── status-editor.tsx
└── types/
    └── supabase.ts                           # 自動生成（編集禁止）
```

### STEP 6: CLAUDE.md 配置

プロジェクトルートに `CLAUDE.md` を配置する。内容は別ドキュメント `CLAUDE.md` 参照。

### STEP 7: .env.local テンプレート作成

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# AI Models
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
OPENAI_API_KEY=

# Trigger.dev
TRIGGER_API_KEY=
TRIGGER_API_URL=

# Langfuse
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=https://cloud.langfuse.com

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=ai-crm-os-audio

# FileMaker Data API
FM_HOST=
FM_DATABASE=
FM_USERNAME=
FM_PASSWORD=
FM_LAYOUT_LIST=リスト情報
FM_LAYOUT_CALLS=コール履歴

# Cron
CRON_SECRET=
```

### STEP 8: Supabaseスキーマ作成

Supabaseダッシュボードで新規プロジェクト「ai-crm-os」を作成。
リージョン: Tokyo。pgvector拡張を有効化。
`DB_SCHEMA.sql` の内容を全て実行。

### STEP 9: マスタデータ初期投入

```bash
psql ... -f scripts/seed-status-definitions.sql
psql ... -f scripts/seed-metric-definitions.sql
```

### STEP 10: 動作確認

以下を全て確認:
- [ ] `npm run dev` でエラーなく起動
- [ ] Supabase に全テーブルが作成されている
- [ ] `metric_definitions` / `status_definitions` にデフォルト値が入っている
- [ ] Mastra Studio (`:4111`) でエージェントが表示される
- [ ] `/dashboard/ai-status` にアクセスできる
- [ ] `fm-import/` フォルダが存在する
- [ ] `/settings/metrics` で指標が表示・編集できる
- [ ] `/settings/statuses` でステータスが表示・編集できる

---

## 16. 失敗しないためのルール

1. **毎日デプロイする** — 3日溜めて一気にデプロイは絶対禁止
2. **Gitブランチを切る** — 機能ごとにbranch、main直pushしない
3. **PR前にECCスキャン** — `npx ecc-agentshield scan` 必須
4. **スキーマ変更はマイグレーション経由** — ダッシュボード直接SQL禁止
5. **Claude Codeへの指示は具体的に** — テーブル名・カラム名・パスを明示
6. **proxy.tsを使う** — middleware.tsは非推奨
7. **AIの指標は運用しながら調整** — 最初から完璧を求めない
8. **FMのフィールド名は推測禁止** — `fm-import/field-mapping/` を必ず参照
9. **破壊的DB変更は必ず確認** — カラム削除・型変更・リネームは事前承認
10. **frontend-design/SKILL.mdを必ず読んでからUI実装** — 規約遵守
11. **金額・件数表示は必ず `tabular-nums`** — 数字の縦ラインがブレない

---

## 17. 関連ドキュメント

このREQUIREMENTS.mdは概要書。詳細は以下を参照：

- **CLAUDE.md** — Claude Code 動作ルール（プロジェクトルート必読）
- **DB_SCHEMA.sql** — 確定SQLスキーマ
- **METRICS_DEFINITION.md** — 全指標の計算式・SQL・修正手順
- **FM_SYNC_DESIGN.md** — FileMaker同期設計詳細（Phase 1片方向 + Phase 3双方向化準備）
- **AI_LEARNING_FOUNDATION.md** — 3層保存・RAG・Self-Improverの設計詳細
- **AD_MANAGER_SPEC.md** — 広告マネージャー画面詳細仕様
- **EXECUTION_PLAN.md** — Claude Code 実行手順（cc-company部署ごとのタスク振り分け）

---

_End of Requirements & Execution Document v3 (統合決定版)_
