CREATE TABLE IF NOT EXISTS webhook_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  raw_data jsonb not null default '{}',
  mapped_data jsonb not null default '{}',
  source text not null default 'meta_ads',
  ad_name text,
  status text not null default 'pending',
  added_to_list_id uuid,
  added_at timestamptz,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
ALTER TABLE webhook_leads DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_webhook_leads_tenant_status ON webhook_leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_leads_received_at ON webhook_leads(received_at DESC);
