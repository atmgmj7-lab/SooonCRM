-- leads テーブルへ FM同期・日付補完用カラムを追加（2026-05-05）
-- TASK 1-1: list_created_at (月次集計の inquiry_at 補完用)
-- TASK 3-1: fm_record_id (FM Webhook upsert のユニークキー)

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS list_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS fm_record_id    text;

-- fm_record_id の一意インデックス（FM Webhook の upsert に必須）
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_fm_record_id_tenant
  ON leads (tenant_id, fm_record_id)
  WHERE fm_record_id IS NOT NULL;

-- list_created_at のインデックス（月次集計クエリ用）
CREATE INDEX IF NOT EXISTS idx_leads_list_created_at
  ON leads (tenant_id, list_created_at)
  WHERE list_created_at IS NOT NULL;
