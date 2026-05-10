# FileMaker Webhook — `/api/webhooks/filemaker`（コール履歴・500 調査）

> Claude Code が参照できるよう、このドキュメントに FM 側の実装コンテキストを集約している。

## 問題

- エンドポイント: `POST /api/webhooks/filemaker`
- 応答: HTTP 500
- メッセージ: `record "new" has no field "called_at"`

## 根本原因（コードベース側の説明）

- マイグレーション `20260507000000_schema_cleanup.sql` で `calls` から `called_at` が **DROP** される。
- 本番 Postgres 上には、トリガー等で `NEW.called_at` を参照する **古い関数定義が残っている**想定であり、列が無い状態でトリガが発火すると上記 PostgreSQL / PL/pgSQL のエラーになる。
- アプリ側の `mapFMCallToSupabase` はもともと `called_at` を送っていなかったが、DB 側が列を参照するなら列を復帰し、API で埋める。

## FM から送られる JSON（例）

Headers:

- `Content-Type: application/json`
- `x-fm-secret`: 環境変数 `FM_WEBHOOK_SECRET` と一致させる

Body（フラットな `fm_fields.*` キー形式の場合あり）:

```json
{
  "fm_record_id": "12345",
  "record_type": "call",
  "update_source": "FM",
  "fm_fields.顧客ID": "CS0140436",
  "fm_fields.対応履歴ID": "...",
  "fm_fields.コール結果": "...",
  "fm_fields.コール開始日": "2026/05/10",
  "fm_fields.コール開始時刻": "18:44:00",
  "fm_fields.コール終了時刻": "18:50:00",
  "fm_fields.コール開始曜日": "日",
  "fm_fields.コール時間_分": "6",
  "fm_fields.コール時間_秒": "0",
  "fm_fields.クラリスID": "...",
  "fm_fields.担当者名": "...",
  "fm_fields.代表hit": "...",
  "fm_fields.CL": "...",
  "fm_fields.リストレベル": "...",
  "fm_fields.対応カテゴリ": "...",
  "fm_fields.担当レベル": "...",
  "fm_fields.アポ情報詳細": "...",
  "fm_fields.非表示": "...",
  "fm_fields.都道府県": "福岡県",
  "fm_fields.MEO": "...",
  "fm_fields.リスト譲渡日": "2025/06/22",
  "fm_fields.リスト": "..."
}
```

ネスト形式 `{ "fm_fields": { "顧客ID": "..." } }` も許容する。

## 仕様上の対応

1. **マイグレーション**: `calls.called_at` を `timestamptz` で再追加（存在すればスキップ）。
2. **API**: `コール開始日` + `コール開始時刻` を **Asia/Tokyo** として解釈し `called_at` に ISO 8601（オフセット付き）で保存。
3. **Body 正規化**: `fm_fields.*` フラットキーを `fm_fields` オブジェクト相当にまとめてから既存マッパへ渡す。
4. **未マッピング項目**: `calls.custom_data` の `fm_webhook_extras` に退避（既存 `custom_data` とマージ）。

## 関連ファイル

- `src/app/api/webhooks/filemaker/route.ts`
- `src/lib/filemaker/mappers.ts`
- `src/lib/filemaker/webhookNormalize.ts`
- `supabase/migrations/*_calls_called_at_restore.sql`
