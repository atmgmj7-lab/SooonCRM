-- deals テーブル（商談・受注の1次レコード）
-- T001 / Aegis V3.1: 既存テーブルへの変更なし（本ファイルは追加のみ）

create or replace function public.trg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  list_record_id uuid references public.list_records (id),
  lead_id uuid references public.leads (id),
  deal_status text not null default 'pending',
  deal_amount numeric,
  contracted_at timestamptz,
  custom_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.deals
  add column if not exists list_record_id uuid references public.list_records (id),
  add column if not exists lead_id uuid references public.leads (id),
  add column if not exists deal_status text not null default 'pending',
  add column if not exists deal_amount numeric,
  add column if not exists contracted_at timestamptz,
  add column if not exists custom_data jsonb default '{}'::jsonb,
  add column if not exists deleted_at timestamptz;

create index if not exists idx_deals_tenant_id on public.deals (tenant_id);
create index if not exists idx_deals_list_record_id on public.deals (list_record_id);
create index if not exists idx_deals_lead_id on public.deals (lead_id);
create index if not exists idx_deals_deal_status on public.deals (deal_status);
create index if not exists idx_deals_contracted_at on public.deals (contracted_at);

alter table public.deals enable row level security;

drop policy if exists "deals_select_tenant_jwt" on public.deals;
create policy "deals_select_tenant_jwt" on public.deals
  for select
  using (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

drop policy if exists "deals_insert_tenant_jwt" on public.deals;
create policy "deals_insert_tenant_jwt" on public.deals
  for insert
  with check (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

drop policy if exists "deals_update_tenant_jwt" on public.deals;
create policy "deals_update_tenant_jwt" on public.deals
  for update
  using (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  with check (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.trg_set_updated_at();
