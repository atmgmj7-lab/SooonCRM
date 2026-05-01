-- 広告セット単位・日次の広告費集計用

create table if not exists public.ad_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  external_id text not null,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_id)
);

create index if not exists idx_ad_sets_tenant_campaign
  on public.ad_sets(tenant_id, campaign_id);

alter table public.ad_sets enable row level security;

drop policy if exists "tenant_isolation" on public.ad_sets;
create policy "tenant_isolation" on public.ad_sets
  for all using (tenant_id = public.get_current_tenant_id());

drop trigger if exists ad_sets_set_updated_at on public.ad_sets;
create trigger ad_sets_set_updated_at
  before update on public.ad_sets
  for each row execute function public.trg_set_updated_at();

-- ad_spend_daily: 広告セットFK
alter table public.ad_spend_daily
  add column if not exists ad_set_id uuid references public.ad_sets(id) on delete cascade;

create index if not exists idx_spend_adset_date
  on public.ad_spend_daily(tenant_id, ad_set_id, spend_date desc)
  where ad_set_id is not null;

-- 一意制約: 同一日・キャンペーン・(クリエ or 広告セット) の重複を禁止（NULLは同一とみなす）
alter table public.ad_spend_daily
  drop constraint if exists ad_spend_daily_tenant_id_campaign_id_creative_id_spend_date_key;

alter table public.ad_spend_daily
  add constraint ad_spend_daily_grain_unique
  unique nulls not distinct (tenant_id, campaign_id, creative_id, ad_set_id, spend_date);

-- 広告マネージャー: 広告セット × 日 の行（リード帰属は source_data.adset_id 一致時のみ）
create or replace function public.get_ad_roi_adset_daily(
  p_tenant_id uuid default public.get_current_tenant_id(),
  p_period_start date default (current_date - interval '30 days')::date,
  p_period_end date default current_date,
  p_distinct_customers boolean default false
)
returns table (
  spend_date date,
  platform text,
  campaign_id text,
  campaign_name text,
  campaign_db_id uuid,
  ad_set_id text,
  ad_set_name text,
  ad_set_db_id uuid,
  spend bigint,
  impressions bigint,
  clicks bigint,
  leads_count bigint,
  apo_count bigint,
  won_count bigint,
  won_amount bigint,
  roas double precision,
  cpo double precision,
  cpa double precision,
  cpc double precision,
  cpm double precision
)
language sql
stable
as $$
  select
    d.spend_date,
    c.platform,
    c.external_id as campaign_id,
    c.name as campaign_name,
    c.id as campaign_db_id,
    s.external_id as ad_set_id,
    s.name as ad_set_name,
    s.id as ad_set_db_id,
    d.spend_amount::bigint as spend,
    d.impressions::bigint as impressions,
    d.clicks::bigint as clicks,
    (
      select count(*)::bigint
      from public.leads l
      where l.tenant_id = p_tenant_id
        and l.ad_campaign_id = c.id
        and l.inquiry_at::date = d.spend_date
        and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        and (
          not p_distinct_customers
          or not exists (
            select 1 from public.leads l2
            where l2.tenant_id = l.tenant_id
              and l2.customer_id = l.customer_id
              and l2.inquiry_at::date < d.spend_date
          )
        )
    ) as leads_count,
    (
      select count(*)::bigint
      from public.leads l
      where l.tenant_id = p_tenant_id
        and l.ad_campaign_id = c.id
        and l.inquiry_at::date = d.spend_date
        and l.status = 'アポOK'
        and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        and (
          not p_distinct_customers
          or not exists (
            select 1 from public.leads l2
            where l2.tenant_id = l.tenant_id
              and l2.customer_id = l.customer_id
              and l2.inquiry_at::date < d.spend_date
          )
        )
    ) as apo_count,
    (
      select count(*)::bigint
      from public.deals dl
      inner join public.leads l on l.id = dl.lead_id
      where dl.tenant_id = p_tenant_id
        and l.tenant_id = p_tenant_id
        and l.ad_campaign_id = c.id
        and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        and dl.stage = '受注'
        and dl.closed_at is not null
        and dl.closed_at::date = d.spend_date
    ) as won_count,
    (
      select coalesce(sum(dl.amount), 0)::bigint
      from public.deals dl
      inner join public.leads l on l.id = dl.lead_id
      where dl.tenant_id = p_tenant_id
        and l.tenant_id = p_tenant_id
        and l.ad_campaign_id = c.id
        and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        and dl.stage = '受注'
        and dl.closed_at is not null
        and dl.closed_at::date = d.spend_date
    ) as won_amount,
    case
      when d.spend_amount > 0 then (
        (select coalesce(sum(dl.amount), 0) from public.deals dl
          inner join public.leads l on l.id = dl.lead_id
          where dl.tenant_id = p_tenant_id
            and l.tenant_id = p_tenant_id
            and l.ad_campaign_id = c.id
            and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
            and dl.stage = '受注'
            and dl.closed_at is not null
            and dl.closed_at::date = d.spend_date
        )::double precision / d.spend_amount::double precision) * 100
      else 0::double precision
    end as roas,
    case
      when (
        select count(*) from public.deals dl
        inner join public.leads l on l.id = dl.lead_id
        where dl.tenant_id = p_tenant_id
          and l.ad_campaign_id = c.id
          and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
          and dl.stage = '受注'
          and dl.closed_at is not null
          and dl.closed_at::date = d.spend_date
      ) > 0
      then d.spend_amount::double precision / (
        select count(*)::double precision from public.deals dl
        inner join public.leads l on l.id = dl.lead_id
        where dl.tenant_id = p_tenant_id
          and l.ad_campaign_id = c.id
          and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
          and dl.stage = '受注'
          and dl.closed_at is not null
          and dl.closed_at::date = d.spend_date
      )
      else 0::double precision
    end as cpo,
    case
      when (
        select count(*) from public.leads l
        where l.tenant_id = p_tenant_id
          and l.ad_campaign_id = c.id
          and l.inquiry_at::date = d.spend_date
          and l.status = 'アポOK'
          and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
      ) > 0
      then d.spend_amount::double precision / (
        select count(*)::double precision from public.leads l
        where l.tenant_id = p_tenant_id
          and l.ad_campaign_id = c.id
          and l.inquiry_at::date = d.spend_date
          and l.status = 'アポOK'
          and coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
      )
      else 0::double precision
    end as cpa,
    case
      when d.clicks > 0 then d.spend_amount::double precision / d.clicks::double precision
      else 0::double precision
    end as cpc,
    case
      when d.impressions > 0 then (d.spend_amount::double precision / d.impressions::double precision) * 1000
      else 0::double precision
    end as cpm
  from public.ad_spend_daily d
  inner join public.ad_campaigns c
    on c.id = d.campaign_id and c.tenant_id = d.tenant_id
  inner join public.ad_sets s
    on s.id = d.ad_set_id and s.tenant_id = d.tenant_id
  where d.tenant_id = p_tenant_id
    and d.creative_id is null
    and d.ad_set_id is not null
    and d.spend_date between p_period_start and p_period_end
  order by d.spend_date desc, c.platform, c.name, s.name;
$$;

grant execute on function public.get_ad_roi_adset_daily(uuid, date, date, boolean) to service_role;
grant execute on function public.get_ad_roi_adset_daily(uuid, date, date, boolean) to authenticated;
