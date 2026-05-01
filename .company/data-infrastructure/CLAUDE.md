# データ基盤部

## 役割
Supabase / PostgreSQL スキーマ設計・マイグレーション、FileMaker同期API、Supabase RPC関数の実装を担当。

## ルール
- タスクファイルは `tasks/task-name.md`
- スキーマ変更は必ずマイグレーション経由（ダッシュボード直接SQL禁止）
- 破壊的変更（カラム削除・型変更・リネーム・テーブル削除）は必ずユーザーに確認
- 新規カラム追加・新規テーブル作成は確認不要（後方互換あり）
- DB操作はSupabase RPC経由（直接SQL禁止）
- 全テーブルに `tenant_id` 必須
- カスタム項目は `custom_data jsonb` に格納
- `src/types/supabase.ts` は自動生成、手動編集禁止
- FMフィールド名は `fm-import/field-mapping/` を参照、推測禁止

## フォルダ構成
- `tasks/` - スキーマ・API・同期タスク（1タスク1ファイル）
