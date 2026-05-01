# Claude Code 実行手順書（EXECUTION_PLAN.md）
# cc-company部署ごとのタスク振り分けとPhase別作業計画
# 2026年4月26日 統合決定版 v3

---

## 0. このドキュメントの使い方

Claude Codeを起動して、以下のコマンドで全体を進める：

```
REQUIREMENTS.md と EXECUTION_PLAN.md を読んで、Phase 0 から順番に実行してください。
各STEPの完了時に「✅ STEP X 完了」とだけ報告してください。
DBスキーマの破壊的変更が必要な場合は、必ず私に確認を取ってから進めてください。
```

cc-company を活用する場合は：

```
/company
秘書、REQUIREMENTS.md と EXECUTION_PLAN.md を読んで、Phase 0 を進めてください。
PMにスケジュール、データ基盤部にスキーマ作成、UI部にレイアウト、QA部にテスト、を振り分けてください。
```

---

## 1. cc-company 部署のタスク振り分け

### 1.1 各部署の責任範囲

| 部署 | 責任範囲 |
|-----|---------|
| **秘書** | 窓口・全タスクの最初の受付 |
| **CEO** | 戦略判断・大規模変更の承認 |
| **PM** | タスク振り分け・スケジューリング・進捗管理 |
| **データ基盤部** | Supabase / スキーマ / FM同期 / API Routes |
| **エージェント部** | Mastra / Workflow / RAG / Self-Improver |
| **UI部** | Next.js画面 / コンポーネント / frontend-design準拠 |
| **QA部** | テスト / セキュリティ / ECC scan |

### 1.2 タスクの委譲フロー

```
ユーザー指示 → 秘書 → PM分析 → 各部署 → 実装 → QA → デプロイ
```

### 1.3 重い作業 / 軽い作業の使い分け

| 作業内容 | 使うツール | 理由 |
|---------|----------|------|
| スキーマ設計・全体設計 | cc-company | 多人数・複数視点が必要 |
| 単純な実装（CRUD等） | claude-cursor-orchestration | Cursorに直接委譲 |
| 並列調査（複数docs比較等） | ccmux | メインセッションを汚染しない |

---

## 2. Phase 0: 環境構築（1週間）

### STEP 0.1: 既存ドキュメントの確認

**担当: 秘書 → PM**

1. プロジェクトルートに以下が揃っているか確認：
   - `REQUIREMENTS.md`, `CLAUDE.md`, `DB_SCHEMA.sql`
   - `METRICS_DEFINITION.md`, `FM_SYNC_DESIGN.md`
   - `AI_LEARNING_FOUNDATION.md`, `AD_MANAGER_SPEC.md`
   - `EXECUTION_PLAN.md`（本ファイル）
2. cc-company / everything-claude-code / claude-cursor-orchestration が `~/.claude/plugins/` に展開されているか
3. frontend-design スキルが `/mnt/skills/public/frontend-design/SKILL.md` に存在するか

### STEP 0.2: プロジェクト初期化

**担当: データ基盤部**

```bash
npx create-next-app@latest ai-crm-os \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd ai-crm-os
```

### STEP 0.3: 依存パッケージインストール

**担当: データ基盤部**

```bash
npm install \
  @supabase/supabase-js @supabase/ssr @clerk/nextjs \
  @mastra/core @mastra/libsql \
  ai @ai-sdk/anthropic @ai-sdk/google openai \
  zod date-fns recharts \
  @trigger.dev/sdk @trigger.dev/react \
  lucide-react

npm install -D supabase @types/node @testing-library/react vitest
```

### STEP 0.4: Mastra初期化

**担当: エージェント部**

```bash
npx mastra@latest init
# 質問への回答:
#   agents: YES
#   workflows: YES
#   RAG: YES
#   memory: YES
#   provider: Anthropic
```

### STEP 0.5: ディレクトリ構成作成

**担当: データ基盤部 + UI部**

REQUIREMENTS.md セクション15「STEP 5: ディレクトリ構成作成」を参照して
完全な構成を作成。

### STEP 0.6: fm-importフォルダ作成

**担当: データ基盤部**

```
fm-import/
├── README.md
├── screenshots/.gitkeep
├── xml-ddr/.gitkeep
└── field-mapping/.gitkeep
```

`README.md` の内容:

```markdown
# FM (FileMaker) Import Resources

## 配置場所
- screenshots/ — FMの画面スクリーンショット
- xml-ddr/ — FMの DDR XML（Database Design Report）
- field-mapping/ — フィールド名マッピング表（CSV / Excel）

## 注意
このフォルダ配下のファイルは、FMの実体構造を伝える「正本」として扱う。
コードからフィールド名を推測することは禁止。必ずここを参照する。
```

### STEP 0.7: Supabase プロジェクト作成

**担当: データ基盤部**

1. Supabase Dashboard で新規プロジェクト「ai-crm-os」作成
2. リージョン: Tokyo
3. SQL Editor で以下を実行:
   ```sql
   create extension if not exists "vector";
   create extension if not exists "pg_trgm";
   ```
4. `DB_SCHEMA.sql` の全内容を実行

### STEP 0.8: 環境変数設定

**担当: データ基盤部**

`.env.local` に REQUIREMENTS.md セクション15 STEP 7 の全環境変数を設定。

### STEP 0.9: ステータスマスタの初期投入

**担当: データ基盤部**

`scripts/seed-status-definitions.sql` を作成して実行：

```sql
INSERT INTO status_definitions (tenant_id, status_key, label, category, order_index, color, is_completed, is_won, is_system) VALUES
('<tenant_id>', '新規',     '新規',     'initial',    1,  '#94A3B8', false, false, true),
('<tenant_id>', '留守',     '留守',     'pending',    2,  '#8B5CF6', false, false, true),
('<tenant_id>', '保留',     '保留',     'pending',    3,  '#6366F1', false, false, true),
('<tenant_id>', '見込みC',  '見込みC',  'nurturing',  4,  '#60A5FA', false, false, true),
('<tenant_id>', '見込みB',  '見込みB',  'nurturing',  5,  '#3B82F6', false, false, true),
('<tenant_id>', '見込みA',  '見込みA',  'nurturing',  6,  '#2563EB', false, false, true),
('<tenant_id>', 'アポOK',   'アポOK',   'confirmed',  7,  '#15803D', false, false, true),
('<tenant_id>', '調整中',   '調整中（商談前）',  'confirmed', 8, '#854F0B', false, false, true),
('<tenant_id>', '採用OK',   '採用OK（着座）',    'won_path', 9, '#1D4ED8', true,  false, true),
('<tenant_id>', '採用NG',   '採用NG',   'lost',       10, '#DC2626', true,  false, true),
('<tenant_id>', '受注',     '受注',     'won',        11, '#0D9488', true,  true,  true),
('<tenant_id>', '失注',     '失注',     'lost',       12, '#A32D2D', true,  false, true),
('<tenant_id>', '対象外',   '対象外',   'excluded',   13, '#94A3B8', true,  false, true),
('<tenant_id>', 'NG',       'NG（即時拒否）',     'lost',  14, '#DC2626', true,  false, true),
('<tenant_id>', '過去データ未分類', '過去データ（未分類）', 'legacy', 15, '#CBD5E1', true, false, true);
```

### STEP 0.10: 指標マスタの初期投入

**担当: データ基盤部**

`scripts/seed-metric-definitions.sql` を作成。
詳細は `METRICS_DEFINITION.md` セクション2参照。

### STEP 0.11: 動作確認

**担当: QA部**

以下のチェックリスト全てクリア:
- [ ] `npm run dev` でエラーなく起動
- [ ] Supabase に全テーブルが作成されている
- [ ] `metric_definitions` / `status_definitions` にデフォルト値が入っている
- [ ] Mastra Studio (`:4111`) でエージェントが表示される
- [ ] `/dashboard/ai-status` にアクセスできる（空画面でOK）
- [ ] `fm-import/` フォルダが存在する
- [ ] `/settings/metrics` で指標が表示される
- [ ] `/settings/statuses` でステータスが表示される
- [ ] `npx ecc-agentshield scan` でクリーン

---

## 3. Phase 1: FM同期 + AI Status Dashboard（2-3週間）

### STEP 1.1: FileMaker Data API クライアント実装

**担当: データ基盤部**

ファイル: `src/lib/filemaker/client.ts`, `auth.ts`, `sync.ts`, `mappers.ts`

詳細は `FM_SYNC_DESIGN.md` セクション4参照。

### STEP 1.2: FM同期 Cron API実装

**担当: データ基盤部**

ファイル: `src/app/api/cron/sync-fm/route.ts`

`vercel.json` に Cron 設定を追加。

### STEP 1.3: FMマッピング画面

**担当: UI部 + データ基盤部**

ファイル: `src/app/(dashboard)/settings/fm-mapping/page.tsx`

- field_mappings テーブルを CRUD する管理画面
- frontend-design スキル準拠

### STEP 1.4: FM同期ログ画面

**担当: UI部**

ファイル: `src/app/(dashboard)/settings/fm-sync-log/page.tsx`

- 直近24時間の同期履歴
- 成功/失敗の件数
- エラー詳細
- 手動同期トリガーボタン

### STEP 1.5: AIステータスダッシュボード実装

**担当: UI部 + エージェント部**

ファイル: `src/app/(dashboard)/dashboard/ai-status/page.tsx`

REQUIREMENTS.md セクション8参照。

主要コンポーネント:
- データ蓄積状況パネル（`<DataAccumulationPanel />`）
- AIエージェント状態パネル（`<AgentStatusPanel />`）
- 学習進捗パネル（`<LearningProgressPanel />`）
- 広告ROIパネル（`<AdRoiPanel />`）

### STEP 1.6: 顧客一覧・リード一覧画面

**担当: UI部**

- `src/app/(dashboard)/customers/page.tsx`
- `src/app/(dashboard)/leads/page.tsx`

frontend-design スキル参照。リスト型UIで、フィルタ・ソート可能。

### STEP 1.7: リード詳細画面（タイムライン型）

**担当: UI部**

ファイル: `src/app/(dashboard)/leads/[id]/page.tsx`

REQUIREMENTS.md セクション9.2 参照。
LinearのIssue画面のようなクリーンな縦タイムライン。

### STEP 1.8: 顧客詳細画面（LTVビュー）

**担当: UI部**

ファイル: `src/app/(dashboard)/customers/[id]/page.tsx`

REQUIREMENTS.md セクション9.4 参照。
1顧客に紐づく全リード・全コール・全受注を統合表示。

### STEP 1.9: 動作確認

**担当: QA部**

- [ ] FMから差分同期が動く（少量データで検証）
- [ ] 顧客一覧 / リード一覧が表示される
- [ ] リード詳細で過去の問い合わせ履歴が見える
- [ ] AIステータスダッシュボードが空でも崩れない
- [ ] ECCスキャン クリーン

---

## 4. Phase 2: AIエージェント本格稼働 + 広告マネージャー（1ヶ月）

### STEP 2.1: Lead Scorerエージェント実装

**担当: エージェント部**

ファイル: `src/mastra/agents/lead-scorer.ts`

`AI_LEARNING_FOUNDATION.md` セクション4.2参照。

### STEP 2.2: Call Time Optimizerエージェント実装

**担当: エージェント部**

ファイル: `src/mastra/agents/call-time-optimizer.ts`

時間帯別の接続率・アポ率データから最適架電時間を提示。

### STEP 2.3: Response Advisorエージェント実装（RAG連携）

**担当: エージェント部**

ファイル: `src/mastra/agents/response-advisor.ts`

`AI_LEARNING_FOUNDATION.md` セクション3.2参照。
過去の類似コールから最適スクリプトを生成。

### STEP 2.4: 広告マネージャー画面実装

**担当: UI部 + データ基盤部**

ファイル: `src/app/(dashboard)/ads/page.tsx`

`AD_MANAGER_SPEC.md` 参照。

主要コンポーネント:
- `<KpiSummaryCards />`
- `<HierarchicalAdTable />`（媒体×キャンペーン×クリエイティブ）
- `<CohortAnalysisPanel />`
- `<AdInsightSidebar />`
- `<ColumnToggle />`（動的指標切替）
- `<DistinctCustomerToggle />`（同一顧客フィルタ）

### STEP 2.5: 広告データ取り込みパイプライン

**担当: データ基盤部**

- Meta Ads API 連携 → ad_campaigns / ad_creatives / ad_spend_daily に書き込み
- Google Ads API 連携
- 日次cronで広告費・インプ・クリックを取得

### STEP 2.6: Self-Improverエージェント実装

**担当: エージェント部**

ファイル: `src/mastra/agents/self-improver.ts`

`AI_LEARNING_FOUNDATION.md` セクション4.1参照。
データ1000件到達時に自動実行 → agent_patterns に登録。

### STEP 2.7: AI指示一覧画面

**担当: UI部**

ファイル: `src/app/(dashboard)/ai/instructions/page.tsx`

agent_instructions の一覧。SVが承認・却下できるUI。

### STEP 2.8: 動作確認

**担当: QA部**

- [ ] 新規リード登録時に Lead Scorerが自動実行される
- [ ] リード詳細画面で AI推奨スクリプトが表示される
- [ ] 広告マネージャーで媒体×クリエイティブ別ROIが見える
- [ ] コホート分析が表示される
- [ ] Self-Improverが週次で動く

---

## 5. Phase 3: CRM→FM 双方向化 + 音声録音（2ヶ月）

### STEP 3.1: CRM→FM 書き込みキュー有効化

**担当: データ基盤部**

`fm_sync_queue.enabled` を `true` に切替。
Trigger.dev ジョブで キュー処理を実装。

`FM_SYNC_DESIGN.md` セクション6参照。

### STEP 3.2: 競合解決ロジック実装

**担当: データ基盤部**

- 修正タイムスタンプの比較
- 競合検知時のアラート
- 解決ポリシー（fm_wins / supabase_wins / latest_wins / manual）

### STEP 3.3: 音声録音 → R2アップロード

**担当: データ基盤部**

ファイル: `src/lib/audio/record.ts`, `src/lib/storage/r2.ts`

- 架電画面に録音ボタン
- 録音停止時に R2 へアップロード
- calls.audio_r2_key に保存

### STEP 3.4: Whisper 文字起こしパイプライン

**担当: エージェント部**

ファイル: `src/trigger/transcribe-call.ts`

- Trigger.dev タスクで Whisper 呼び出し
- スピーカー分離
- call_transcripts へ保存

### STEP 3.5: ベクトル化パイプライン

**担当: エージェント部**

ファイル: `src/trigger/embed-call.ts`

`AI_LEARNING_FOUNDATION.md` セクション2.3参照。

### STEP 3.6: 動作確認

**担当: QA部**

- [ ] CRMで編集 → FMに反映される
- [ ] 録音 → 文字起こし → ベクトル化が走る
- [ ] RAG検索で類似コールが見つかる
- [ ] 競合検知が動く

---

## 6. 進捗管理ルール

### 6.1 PM部の役割

- 各STEPの担当者を決める
- 完了基準を明確化
- 詰まったら CEO にエスカレーション

### 6.2 報告フォーマット

```
[Phase X] STEP X.X: <タスク名>
担当: <部署>
状態: ⬜未着手 / 🔵進行中 / ✅完了 / 🔴ブロック
完了予定: YYYY-MM-DD
備考:
```

### 6.3 デイリースタンドアップ（推奨）

毎朝 cc-company の秘書に「昨日の進捗・今日の予定・ブロック事項」を報告する。

---

## 7. 失敗しないためのルール（再掲）

REQUIREMENTS.md セクション16 と CLAUDE.md の ECCルールを必ず守る。
特に重要：

1. **毎日デプロイする** — 3日溜めて一気にデプロイは禁止
2. **PR前にECCスキャン** — `npx ecc-agentshield scan` 必須
3. **破壊的DB変更は確認** — カラム削除・型変更・リネーム
4. **frontend-design/SKILL.mdを読んでからUI実装**
5. **数字表示は必ず `tabular-nums`**

---

## 8. トラブルシューティング

### 8.1 FM Data API 接続エラー

- FM Server の Data API が有効か確認
- レイアウト名が正しいか（fm-import/field-mapping/参照）
- Username / Password が正しいか

### 8.2 Supabase RLS エラー

- `get_current_tenant_id()` が正しい値を返すか確認
- Clerk JWT に `org_id` が含まれているか
- tenant_members に該当 user が登録されているか

### 8.3 Mastra Studio 起動失敗

```bash
npx mastra dev --port 4222
```

### 8.4 ECCスキャン警告

- 警告内容を読み、修正
- どうしても無視する必要がある場合は `// ecc-ignore: <理由>` コメント追加

---

## 9. 関連ドキュメント

- `REQUIREMENTS.md` — 要件定義書
- `CLAUDE.md` — Claude Code動作ルール
- `DB_SCHEMA.sql` — DB スキーマ
- `METRICS_DEFINITION.md` — 指標定義
- `FM_SYNC_DESIGN.md` — FM同期設計
- `AI_LEARNING_FOUNDATION.md` — AI学習基盤
- `AD_MANAGER_SPEC.md` — 広告マネージャー画面

---

_End of EXECUTION_PLAN.md_
