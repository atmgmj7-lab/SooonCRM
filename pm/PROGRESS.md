# PROGRESS.md — タスク進捗管理

> セッション開始時は必ずこのファイルを確認する。
> 完了したタスクは ✅、進行中は 🔄、未着手は ⬜、ブロック中は 🚫 で管理。

最終更新: 2026-05-13

---

## 次回やること（優先順）

1. ⬜ migration `20260513040000_distinct_column_values_rpc.sql` を本番DBに適用（`npx supabase db push`）
2. ⬜ 全マイグレーション（20260513xxx）を本番DBに適用
3. ⬜ Meta Webhook を Meta 開発者ポータルで登録（RUNBOOK.md 手順参照）
4. ⬜ Vercel デプロイ（今セッション変更分を本番反映）
5. ⬜ `/admin/sync` の広告名バックフィルボタンを実行してリードの ad_name を補完
6. ⬜ ListMainDetail.tsx に新カラム（industry, meo_status, homepage_url 等）を追加

## 2026-05-13 実装済み（チェックボックスフィルター・重複リード削除）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| Z-1 | Supabase RPC `get_distinct_column_values` | ✅ | migration 20260513040000: leads/list_records 両対応、ホワイトリスト保護 |
| Z-2 | `/api/leads/distinct-values` API | ✅ | GET?column=ad_name/prefecture/status |
| Z-3 | `/api/list-records/distinct-values` API | ✅ | GET?column=ad_name/prefecture/source |
| Z-4 | `src/components/shared/ColumnFilter.tsx` | ✅ | チェックボックス式フィルター、全選択/解除、バッジ表示 |
| Z-5 | leads API マルチバリューフィルター | ✅ | `ad_names`, `prefectures`, `statuses` → `.in()` |
| Z-6 | list-records API マルチバリューフィルター | ✅ | `ad_names`, `prefectures`, `sources` → `.in()` |
| Z-7 | リード管理ページ ColumnFilter 統合 | ✅ | 広告名・都道府県・対応をチェックボックス選択に変更 |
| Z-8 | リスト一覧ページ ColumnFilter 統合 | ✅ | 広告名・都道府県・ソースのチェックボックスフィルター追加 |
| Z-9 | 重複リード削除 API | ✅ | `/api/admin/dedup-leads`: dry_run対応、meta_lead_id基準 |
| Z-10 | 同期画面 DedupCard | ✅ | 2段階確認（件数確認→削除実行）UI |

---

## 2026-05-13 実装済み（フィールドマッピング・ADNAME連動・同期UI強化）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| Y-1 | field_mappings 重複制約エラー修正 | ✅ | migration 20260513030000: 旧constraint削除、新constraint `(tenant_id, source_field, target_table)` 追加 |
| Y-2 | field_mappings 拡張 | ✅ | migration 20260513000000: label_ja, enabled カラム追加 |
| Y-3 | list_records 誤カラム修正 | ✅ | migration 20260513030000: 誤名カラム削除（meo→meo_status は既存） |
| Y-4 | deals テーブル migration 修正 | ✅ | migration 20260512000000: IF NOT EXISTS 追加で再適用可能に |
| Y-5 | FM全フィールド定数化 | ✅ | `src/lib/constants/fm-fields.ts`: リスト情報46フィールド＋コール履歴21フィールド定義 |
| Y-6 | フィールドマッピング API | ✅ | `/api/admin/field-mappings`: GET/POST (upsert対応) |
| Y-7 | フィールドマッピング UI | ✅ | `/admin/field-mapping`: 全FMフィールド表示、サンプル値、Supabaseプレビュー列、ホバー連動 |
| Y-8 | リレーション管理ページ追加 | ✅ | `/admin/relations`: スケルトンページ |
| Y-9 | サイドバー「管理」アコーディオン | ✅ | フィールドマッピング / リレーション管理 / 手動同期の3子メニュー |
| Y-10 | リード広告名フォールバック | ✅ | `list/[id]/page.tsx`: leads.ad_name null時にlist_records.ad_nameで補完 |
| Y-11 | AdInquirySummary コンポーネント | ✅ | リスト詳細右パネルに広告別問い合わせサマリー（件数・ステータス内訳・最終問い合わせ日） |
| Y-12 | ListAttrHeader に広告名バッジ | ✅ | 青いpillバッジでADNAMEを表示 |
| Y-13 | Meta リード取得カード | ✅ | `/admin/sync` に期間指定付きMetaリード取得ボタン追加 |
| Y-14 | 広告名バックフィル API + UI | ✅ | `/api/admin/backfill-ad-name` + sync画面にボタン追加 |
| Y-15 | migration 20260513010000/020000 | ✅ | field_mappings unique制約追加、list_records追加カラム（industry等） |

---

## 2026-05-11 実装済み（第2回）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| X-1 | inbox: getFieldData ネスト修正 | ✅ | Meta Webhookペイロードの entry[0].changes[0].value.field_data を参照 |
| X-2 | inbox: CSS borderBottom競合修正 | ✅ | tabStyle を longhand のみに統一 |
| X-3 | webhook/meta: inquiry_date 追加 | ✅ | leads INSERT に inquiry_date: inquiryDate を追加 |
| X-4 | pull-meta-leads: inquiry_date 追加 | ✅ | leads INSERT に inquiry_date を追加 |
| X-5 | sync-calls API 作成 | ✅ | /api/admin/sync-calls (POST) |
| X-6 | 手動同期UI ページ作成 | ✅ | /admin/sync — リスト・コール履歴の差分同期ボタン |
| X-7 | サイドバーに手動同期リンク追加 | ✅ | RefreshCw アイコン /admin/sync |

---

## フェーズ5: Meta全データ取得 + 1次データ基盤設計（2026-05-11）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| N-1 | Meta webhook: ad_name取得修正 | ✅ | Graph APIに`ad_name,adset_id,campaign_id,campaign_name`追加 |
| N-2 | Meta webhook: 役職（rep_title）取得追加 | ✅ | field_dataの`job_title`から取得 |
| N-3 | pull-meta-leads: 同様の修正 | ✅ | 能動取得ルートも同期済み |
| N-4 | inbox UI: 役職カラム追加 | ✅ | テーブルに「役職」列、モーダルに「広告セット・役職」表示 |
| N-5 | migration: list_records.rep_title追加 | ✅ | `20260510210000_add_rep_title_to_list_records.sql` 作成（本番未適用） |
| N-6 | 1次データ基盤 設計・計画 | ✅ | `task_plan.md` に5フェーズ設計を記録 |
| N-7 | deals テーブル設計 | ✅ | task_plan.md P1-2 に設計案あり（未実装） |
| N-8 | Obsidian MCP方針決定 | ✅ | `obsidian-claude-code-mcp`導入予定（代表者戦略ログ専用） |

---

## フェーズ4: コール履歴・FM双方向同期（本日実装）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| V-1 | calls画面に全フィールド追加（Lvl削除） | ✅ | 代表Lv/代表hit/CL/担担Lv/リスト/履歴ID 追加 |
| V-2 | list_records/callsソフトデリート化 | ✅ | deleted_at カラム追加、sync・webhook・クエリ全対応 |
| V-3 | 新規リード→FM Push（重複チェック＋顧客ID fetch-back）| ✅ | upsertListRecordToFM()、fmGetRecordById()実装 |
| V-4 | supabase.ts 型定義（deleted_at）手動追加 | ✅ | webhook対応時にCursor Agentが追加済み |
| V-5 | Migration適用 | ⬜ | supabase/migrations/20260510190000_soft_delete.sql を本番DBに適用が必要 |

---

## フェーズ1: FM←→CRM 連携（本日完了済み）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| F-1 | 広告リード company_name フィルターバグ修正 | ✅ | webhookのfallback設定 + API側フィルター緩和 |
| F-2 | FM重複チェック付きプッシュ（電話番号で検索） | ✅ | fmFindByPhone() 実装 |
| F-3 | FM新規リード: 未登録→新規作成、既存→リンクのみ | ✅ | meta webhook + backfill-fm-push |
| F-4 | last_call_at カラム追加 + トリガー更新 | ✅ | migration 20260510010000 |
| F-5 | リード一覧に「最終架電日」カラム追加 | ✅ | list/page.tsx |
| F-6 | FM webhook が call_update を処理 | ✅ | filemaker/route.ts 拡張 |
| F-7 | get_ad_cohort_metrics RPC 作成 | ✅ | migration 20260510000000 |
| F-8 | 既存広告リードの company_name バックフィル | ✅ | migration 20260510020000（SQL実行済み） |
| F-9 | FM未同期リードの一括プッシュ API | ✅ | /api/admin/backfill-fm-push |
| F-10 | GitHub Actions cron を日次（JST 0時）に変更 | ✅ | sync-fm.yml |
| F-11 | Supabase CLI 設定・migration 管理開始 | ✅ | supabase init + link + repair |
| F-12 | admin/sync-from-fm API 実装 | ✅ | FM全件同期 + leads エントリ作成 |

---

## フェーズ2: Meta 自動取得（本日実装）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| M-1 | Meta Webhook エンドポイント（受信側）| ✅ | /api/webhooks/meta — コードは完成 |
| M-2 | Meta 開発者ポータル Webhook 登録 | ⬜ | RUNBOOK.md 手順参照（人手作業） |
| M-3 | Meta Graph API Pull（能動取得）実装 | ✅ | /api/admin/pull-meta-leads |
| M-4 | 4/28〜現在の欠損リード バックフィル | ⬜ | RUNBOOK.md 手順参照 |
| M-5 | Meta webhook 動作テスト（本番リード確認） | ⬜ | M-2 完了後に確認 |

---

## フェーズ3: アナリティクス改善（次フェーズ）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| C-1 | 調整中/採用OK/採用NG/受注が全件0問題の解消 | ⬜ | ステータス文字列不一致が原因の疑い |
| C-2 | 広告別×月次サブタブ統合 | ⬜ | |
| C-3 | リードサマリータブ（M0〜M3コホート）| ⬜ | |
| C-4 | コール分析タブ | ⬜ | |

---

## データ品質（保留）

| # | タスク | 状態 | 備考 |
|---|--------|------|------|
| D-1 | 空白リード（inquiry_at・ad_name両方NULL）削除 | ⬜ | 要件確認後に実行 |
| D-2 | 既存callsデータのleads.statusへ一括反映 | ⬜ | |
