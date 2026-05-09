# PROGRESS.md — タスク進捗管理

> セッション開始時は必ずこのファイルを確認する。
> 完了したタスクは ✅、進行中は 🔄、未着手は ⬜、ブロック中は 🚫 で管理。

最終更新: 2026-05-10

---

## 今日やること（優先順）

1. ✅ スプレッドシートCSVのインポート手順実行（RUNBOOK.md参照）
2. ⬜ Meta Webhook を Meta 開発者ポータルで登録（RUNBOOK.md 手順参照）
3. ⬜ 新規リードが Sooon-CRM に自動で入ることを確認

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
