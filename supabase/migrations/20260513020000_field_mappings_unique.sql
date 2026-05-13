-- field_mappings: upsert 用 unique constraint 追加
-- onConflict: tenant_id, source_field, target_table

ALTER TABLE field_mappings
  DROP CONSTRAINT IF EXISTS uq_field_mappings_tenant_source_table;

ALTER TABLE field_mappings
  ADD CONSTRAINT uq_field_mappings_tenant_source_table
  UNIQUE (tenant_id, source_field, target_table);
