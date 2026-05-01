---
created: "2026-04-26"
task: "Phase 0 スキーマ作成"
status: open
priority: high
assignee: データ基盤部
---

# Phase 0 スキーマ作成タスク

## 概要
Supabase に `DB_SCHEMA.sql` の全テーブルを作成し、マスタデータを初期投入する。

## 前提確認
- [ ] `DB_SCHEMA.sql` がプロジェクトルートに存在するか確認
- [ ] Supabase プロジェクトが作成済みか確認
- [ ] pgvector 拡張が有効化されているか確認

## 実行手順

### STEP 1: Supabase プロジェクト作成
1. Supabase Dashboard で新規プロジェクト「ai-crm-os」作成
2. リージョン: Tokyo
3. SQL Editorで拡張を有効化:
   ```sql
   create extension if not exists "vector";
   create extension if not exists "pg_trgm";
   ```

### STEP 2: DB_SCHEMA.sql 実行
`DB_SCHEMA.sql` の全内容を Supabase SQL Editor で実行。

対象テーブル群（概要）:
- コア: tenants, tenant_members, customers, leads, calls, deals
- 広告: ad_campaigns, ad_creatives, ad_spend_daily
- AI: call_transcripts, call_embeddings, agent_instructions, agent_metrics, agent_patterns
- マスタ: metric_definitions, status_definitions, field_mappings, tenant_schemas
- FM同期: fm_sync_log, fm_sync_queue

設計原則:
- 全テーブルに `tenant_id uuid not null` 必須
- カスタム項目は `custom_data jsonb` に格納
- FM同期は `fm_record_id` で重複防止
- `fm_sync_queue.enabled = false`（Phase 1はキュー停止）

### STEP 3: ステータスマスタ初期投入
`scripts/seed-status-definitions.sql` を作成・実行（15件）。
詳細は `REQUIREMENTS.md` セクション4.2 参照。

### STEP 4: 指標マスタ初期投入
`scripts/seed-metric-definitions.sql` を作成・実行。
詳細は `METRICS_DEFINITION.md` セクション2 参照。

カテゴリ: カウント系 / レート系 / 金額系 / 広告コスト系（CPC/CPM/CPA/CPO/ROAS/ROI/CAC） / コホート分析系

### STEP 5: 環境変数設定
`.env.local` に設定:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### STEP 6: 型生成
```bash
npx supabase gen types typescript --linked > src/types/supabase.ts
```
注意: `src/types/supabase.ts` は自動生成。手動編集禁止。

## 完了条件
- [ ] Supabase に全テーブルが作成されている（20テーブル以上）
- [ ] `metric_definitions` にデフォルト指標が入っている
- [ ] `status_definitions` に15件のステータスが入っている
- [ ] `src/types/supabase.ts` が生成されている
- [ ] RLSポリシーが全テーブルに適用されている

## 注意事項
- 破壊的変更（カラム削除・型変更・リネーム・テーブル削除）は必ずユーザーに確認
- FMフィールド名は `fm-import/field-mapping/` を参照（推測禁止）
- Phase 1のFM同期は片方向のみ（`fm_sync_queue.enabled = false` を維持）
