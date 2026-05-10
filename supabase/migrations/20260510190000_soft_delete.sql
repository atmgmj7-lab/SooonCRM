-- ============================================================
-- list_records / calls ソフトデリート対応
-- FM削除時はハードデリートせず deleted_at をセットする
-- deleted_at IS NULL が「有効なレコード」
-- ============================================================

ALTER TABLE list_records
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN list_records.deleted_at IS 'ソフトデリート: FMで削除されたレコードをNULLからタイムスタンプにセット';
COMMENT ON COLUMN calls.deleted_at IS 'ソフトデリート: FMで削除されたコール履歴をNULLからタイムスタンプにセット';
