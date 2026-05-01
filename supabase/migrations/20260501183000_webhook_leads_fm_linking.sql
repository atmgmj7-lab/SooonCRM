ALTER TABLE webhook_leads
  ADD COLUMN IF NOT EXISTS fm_record_id text,
  ADD COLUMN IF NOT EXISTS fm_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS match_status text NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_webhook_leads_phone_norm ON webhook_leads(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_webhook_leads_match_status ON webhook_leads(match_status);
CREATE INDEX IF NOT EXISTS idx_webhook_leads_fm_record ON webhook_leads(fm_record_id);
