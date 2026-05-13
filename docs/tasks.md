# tasks.md — タスク管理

> セッション開始時に必ずこのファイルを確認し、実装済み・未実装を把握してから作業を開始すること。
> 詳細な進捗は `pm/PROGRESS.md` を参照。

<!-- AUTO-GENERATED: 最終更新 2026-05-11 -->

## ✅ 実装済み

### Meta広告リード連携
- Meta Webhook エンドポイント（`/api/webhooks/meta`）
- Meta Graph API Pull（`/api/admin/pull-meta-leads`）
- 全フィールド取得（ad_name / adset_id / campaign_id / campaign_name / rep_title）
- inquiry_date を leads INSERT 時に設定（リード一覧の問合せ日修正）

### FM連携
- FM → Supabase 差分同期（list_records・calls）— `syncListRecords()` / `syncCalls()`
- FM → Supabase リアルタイム Webhook（`/api/webhooks/filemaker`）
- CRM → FM プッシュ（`upsertListRecordToFM()`）— 新規リード登録時
- 手動差分同期 API（`/api/admin/sync-from-fm`, `/api/admin/sync-calls`）
- 手動差分同期 UI（`/admin/sync`）

### 受信リード（Inbox）
- webhook_leads テーブルへの生データ保存
- フォーム回答フィールドの表示修正（ネスト構造対応）
- チェックボックス選択 → FM・list_records 登録
- 役職（rep_title）取得・表示

### リスト情報・コール履歴
- ソフトデリート対応（deleted_at カラム）
- list_records.rep_title カラム追加（migration作成済み・本番未適用）
- last_call_at / last_call_result 自動更新（DBトリガー）

### UI全般
- サイドバー：手動同期リンク追加
- リード一覧：問合せ日・広告名・経過日数表示
- 受信リード：タブ切替・CSS修正（borderBottom競合解消）

---

## 🔲 未実装・進行中

### 優先度 高（今週）
- [ ] migration 2本を本番DBに適用（`npx supabase db push`）
  - `20260510190000_soft_delete.sql`
  - `20260510210000_add_rep_title_to_list_records.sql`
- [ ] Meta Webhook を開発者ポータルで登録（RUNBOOK.md 手順2）

### 優先度 中
- [ ] deals テーブル作成（商談・受注データ）— `task_plan.md P1-2`
- [ ] アポ詳細入力 UI
- [ ] アナリティクス: ステータス文字列不一致の解消（C-1）

### 優先度 低（Phase 2以降）
- [ ] Meta広告費の日次自動取得（ad_costs テーブル）
- [ ] Obsidian MCP 設定（代表者戦略ログ）
- [ ] AIエージェント実装（Phase 5）

---

## 📝 メモ

- Vercel 本番URL: `https://sooon-37xqigt0i-narikiyos-projects.vercel.app`
- `npx supabase db push` で migration を本番DBに適用
- Meta Webhook verify token: `sooon_meta_verify_2026`
