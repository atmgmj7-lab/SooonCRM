-- FM同期スキーマ追加
-- STEP 1-1: list_records に FM連携カラム追加

ALTER TABLE list_records ADD COLUMN IF NOT EXISTS fm_record_id text;
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS fm_modification_id text;
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS customer_id text;

CREATE INDEX IF NOT EXISTS idx_list_records_fm_record ON list_records(fm_record_id);
CREATE INDEX IF NOT EXISTS idx_list_records_customer_id ON list_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_list_records_phone ON list_records USING GIN(phone_numbers);

-- STEP 1-2: callsテーブルを FM_IMPLEMENTATION.md 定義に置き換え

DROP TABLE IF EXISTS calls CASCADE;

CREATE TABLE calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  list_record_id uuid NOT NULL REFERENCES list_records(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES tenant_members(id),

  -- FMコール履歴フィールド完全再現
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  call_start_time text,
  call_end_date date,
  call_end_time text,
  call_number int NOT NULL DEFAULT 1,
  agent_name text,
  call_result text,
  call_category text,
  reissue_pending text,
  list_name text,
  rep_level text,
  rep_level2 text,
  ci text,
  appo_detail text,
  call_duration_minutes float,

  -- AI CRM OS独自
  direction text NOT NULL DEFAULT 'outbound',
  audio_r2_key text,
  custom_data jsonb NOT NULL DEFAULT '{}',

  -- FM連携用
  fm_record_id text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calls_list_record ON calls(list_record_id);
CREATE INDEX idx_calls_tenant ON calls(tenant_id);
CREATE INDEX idx_calls_date ON calls(call_date DESC);
CREATE INDEX idx_calls_result ON calls(call_result);
CREATE INDEX idx_calls_fm_record ON calls(fm_record_id);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON calls
  USING (tenant_id = (SELECT tenant_id FROM tenant_members WHERE clerk_user_id = auth.uid()::text LIMIT 1));

-- STEP 1-3: trg_update_last_call トリガー

CREATE OR REPLACE FUNCTION update_last_call_info()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE list_records SET
    last_call_date        = NEW.call_date,
    last_call_start_time  = NEW.call_start_time,
    last_call_end_time    = NEW.call_end_time,
    last_call_agent       = NEW.agent_name,
    last_call_result      = NEW.call_result,
    last_call_category    = NEW.call_category,
    last_call_count       = (SELECT COUNT(*) FROM calls WHERE list_record_id = NEW.list_record_id),
    last_call_list_name   = NEW.list_name,
    last_call_rep_level   = NEW.rep_level,
    last_call_rep_level2  = NEW.rep_level2,
    last_call_appo_detail = NEW.appo_detail,
    updated_at            = now()
  WHERE id = NEW.list_record_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_last_call
  AFTER INSERT OR UPDATE ON calls
  FOR EACH ROW EXECUTE FUNCTION update_last_call_info();

-- STEP 1-4: webhook_leads 電話番号照合用

ALTER TABLE webhook_leads ADD COLUMN IF NOT EXISTS phone_normalized text;
CREATE INDEX IF NOT EXISTS idx_webhook_leads_phone ON webhook_leads(phone_normalized);

-- STEP 5 (sync_logs): sync_logsテーブル

CREATE TABLE IF NOT EXISTS sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  type text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  records_synced int DEFAULT 0,
  errors int DEFAULT 0,
  meta jsonb DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs(type, synced_at DESC);
