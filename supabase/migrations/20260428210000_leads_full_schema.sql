-- リード管理: leadsテーブルへの列追加 + インデックス + RPC

-- Meta自動入力列
alter table public.leads
  add column if not exists inquiry_date        date,
  add column if not exists ad_name             text,
  add column if not exists adset_id            text,
  add column if not exists company_name        text,
  add column if not exists rep_title           text,
  add column if not exists representative_name text,
  add column if not exists prefecture          text,
  add column if not exists phone_number        text,
  add column if not exists email_address       text,
  add column if not exists lead_detail         text,
  add column if not exists form_q1             text,
  add column if not exists form_q2             text,
  add column if not exists form_q3             text,
  -- 手動記入列
  add column if not exists last_call_result    text,
  add column if not exists call_count          integer default 0,
  add column if not exists recall_date         date,
  add column if not exists recall_time         text,
  add column if not exists jitsuyo_ok          boolean default false,
  add column if not exists ichiyou_ng          boolean default false,
  add column if not exists order_closed        boolean default false,
  add column if not exists initial_fee         integer,
  add column if not exists monthly_fee         integer,
  add column if not exists contract_months     integer,
  add column if not exists total_revenue       integer,
  -- リスト情報紐づけ
  add column if not exists list_record_id      uuid references public.customers(id) on delete set null,
  -- インポート管理
  add column if not exists imported_from_csv   boolean default false,
  add column if not exists csv_row_number      integer;

-- インデックス
create index if not exists idx_leads_adset_id       on public.leads(adset_id);
create index if not exists idx_leads_inquiry_date   on public.leads(inquiry_date);
create index if not exists idx_leads_list_record_id on public.leads(list_record_id);
create index if not exists idx_leads_tenant_adset   on public.leads(tenant_id, adset_id);

-- RPC: 広告セット別リード集計
create or replace function public.get_lead_stats_by_adset(
  target_tenant_id uuid,
  from_date date default (current_date - interval '30 days')::date,
  to_date   date default current_date
)
returns table (
  adset_id      text,
  total_leads   bigint,
  appo_ok_count bigint,
  order_count   bigint,
  total_revenue bigint,
  appo_rate     numeric,
  order_rate    numeric
)
language sql stable as
$$
  select
    l.adset_id,
    count(*) as total_leads,
    count(*) filter (where l.last_call_result = 'アポOK' or l.jitsuyo_ok = true) as appo_ok_count,
    count(*) filter (where l.order_closed = true) as order_count,
    coalesce(sum(l.total_revenue::integer) filter (where l.order_closed = true), 0) as total_revenue,
    round(
      count(*) filter (where l.last_call_result = 'アポOK' or l.jitsuyo_ok = true)
      * 100.0 / nullif(count(*), 0), 1
    ) as appo_rate,
    round(
      count(*) filter (where l.order_closed = true)
      * 100.0 / nullif(count(*), 0), 1
    ) as order_rate
  from public.leads l
  where l.tenant_id = target_tenant_id
    and l.inquiry_date::date between from_date and to_date
    and l.adset_id is not null
  group by l.adset_id
$$;

grant execute on function public.get_lead_stats_by_adset(uuid, date, date) to service_role;
grant execute on function public.get_lead_stats_by_adset(uuid, date, date) to authenticated;
