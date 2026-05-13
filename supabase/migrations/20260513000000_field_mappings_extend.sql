-- field_mappings: label_ja / enabled カラム追加
-- 既存スキーマ（source_field, target_field, target_table 等）は維持

ALTER TABLE field_mappings
  ADD COLUMN IF NOT EXISTS label_ja TEXT,
  ADD COLUMN IF NOT EXISTS enabled  BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_field_mappings_tenant_table
  ON field_mappings(tenant_id, target_table);
