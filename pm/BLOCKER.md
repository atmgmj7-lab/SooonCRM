# BLOCKER.md — 障害・ブロック管理

> 開発を進める上で「人手が必要」「情報が足りない」問題を記録する。
> 解決したら ✅ にして日付を記録すること。

最終更新: 2026-05-10

---

## 🚫 現在のブロッカー

### BL-1: Meta Webhook が Meta 側で未登録
- **内容**: `/api/webhooks/meta` のエンドポイントはコードとして完成しているが、
  Meta 開発者ポータルで Webhook URL を登録していないため、新規リードが届かない
- **影響**: 4/28以降のリードが Sooon-CRM に入っていない根本原因
- **解決手順**: RUNBOOK.md「手順2: Meta Webhook 登録」を参照
- **必要な情報**: Meta App の管理者アクセス権
- **担当**: なりきよさん（Meta 開発者ポータルへのログイン必要）

### BL-2: 4/28〜現在のリードがSooon-CRMに未登録
- **内容**: この期間のリードは Google Sheets → FM のルートで処理されており、
  Sooon-CRM には入っていない
- **影響**: リード一覧・分析画面が現状とズレている
- **解決手順**: RUNBOOK.md「手順1: CSV インポート」を参照
- **必要なもの**: スプレッドシートの CSV エクスポート（準備済みとのこと）
- **担当**: なりきよさん（CSV の用意は完了）

---

## ✅ 解決済みブロッカー

### BL-0: 広告リードがリード一覧に1件も表示されない（解決済み: 2026-05-10）
- **原因**: `/api/list-records` に `.not('company_name', 'is', null)` フィルターがあり、
  company_name が NULL の広告リードが全件除外されていた
- **解決**: webhook で company_name フォールバック設定 + フィルター条件を緩和

---

## ⚠️ 未確認・要確認事項

| # | 内容 | 確認方法 |
|---|------|---------|
| U-1 | Vercel の環境変数（FM_HOST 等）が本番に設定されているか | Vercel ダッシュボード → Settings → Environment Variables |
| U-2 | Meta Webhook Verify Token が Vercel に設定されているか | Vercel → `META_WEBHOOK_VERIFY_TOKEN` = `sooon_meta_verify_2026` |
| U-3 | supabase migration が本番 DB に適用されているか | `npx supabase db push` を実行して確認 |
