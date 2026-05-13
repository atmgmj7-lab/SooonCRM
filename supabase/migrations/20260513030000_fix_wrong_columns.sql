-- 20260513010000 で誤った名前で追加したカラムを削除
-- 正しいカラム名はすでに存在している（supabase.ts の型定義が正）:
--   meo_status (JSONB) ← meo (TEXT) は不要
--   list_handover_date ← list_transfer_date は不要
--   list_screening ← list_quality は不要
--   company_email ← email_address は不要
-- industry / homepage_url / list_source は既存か正しい名前なので保持

ALTER TABLE list_records
  DROP COLUMN IF EXISTS meo,
  DROP COLUMN IF EXISTS list_transfer_date,
  DROP COLUMN IF EXISTS list_quality,
  DROP COLUMN IF EXISTS email_address;

-- field_mappings: 旧 unique constraint を削除（tenant_id,source_type,source_field の組み合わせ）
-- 同一 FM フィールドを複数テーブルにマッピングできるように新制約 uq_field_mappings_tenant_source_table に一本化済み
ALTER TABLE field_mappings
  DROP CONSTRAINT IF EXISTS field_mappings_tenant_id_source_type_source_field_key;
