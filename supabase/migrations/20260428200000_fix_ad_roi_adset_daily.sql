-- ad_sets テーブルへの権限付与（permission denied 解消）
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_sets TO authenticated;
GRANT ALL ON public.ad_sets TO service_role;

-- TikTok・LINE データ削除（依存関係の順に削除）
DELETE FROM public.ad_spend_daily
  WHERE campaign_id IN (
    SELECT id FROM public.ad_campaigns WHERE platform IN ('tiktok', 'line')
  );

DELETE FROM public.ad_sets
  WHERE campaign_id IN (
    SELECT id FROM public.ad_campaigns WHERE platform IN ('tiktok', 'line')
  );

DELETE FROM public.ad_creatives
  WHERE campaign_id IN (
    SELECT id FROM public.ad_campaigns WHERE platform IN ('tiktok', 'line')
  );

DELETE FROM public.ad_campaigns WHERE platform IN ('tiktok', 'line');

-- get_ad_roi_adset_daily を SECURITY DEFINER 付きで再作成（RLS bypass）
CREATE OR REPLACE FUNCTION public.get_ad_roi_adset_daily(
  p_tenant_id uuid DEFAULT public.get_current_tenant_id(),
  p_period_start date DEFAULT (current_date - interval '30 days')::date,
  p_period_end date DEFAULT current_date,
  p_distinct_customers boolean DEFAULT false
)
RETURNS TABLE (
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.spend_date,
    c.platform,
    c.external_id AS campaign_id,
    c.name AS campaign_name,
    c.id AS campaign_db_id,
    s.external_id AS ad_set_id,
    s.name AS ad_set_name,
    s.id AS ad_set_db_id,
    d.spend_amount::bigint AS spend,
    d.impressions::bigint AS impressions,
    d.clicks::bigint AS clicks,
    (
      SELECT count(*)::bigint FROM public.leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.ad_campaign_id = c.id
        AND l.inquiry_at::date = d.spend_date
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        AND (NOT p_distinct_customers OR NOT EXISTS (
          SELECT 1 FROM public.leads l2
          WHERE l2.tenant_id = l.tenant_id AND l2.customer_id = l.customer_id
            AND l2.inquiry_at::date < d.spend_date
        ))
    ) AS leads_count,
    (
      SELECT count(*)::bigint FROM public.leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.ad_campaign_id = c.id
        AND l.inquiry_at::date = d.spend_date
        AND l.status = 'アポOK'
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        AND (NOT p_distinct_customers OR NOT EXISTS (
          SELECT 1 FROM public.leads l2
          WHERE l2.tenant_id = l.tenant_id AND l2.customer_id = l.customer_id
            AND l2.inquiry_at::date < d.spend_date
        ))
    ) AS apo_count,
    (
      SELECT count(*)::bigint FROM public.deals dl
      INNER JOIN public.leads l ON l.id = dl.lead_id
      WHERE dl.tenant_id = p_tenant_id AND l.tenant_id = p_tenant_id
        AND l.ad_campaign_id = c.id
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        AND dl.stage = '受注' AND dl.closed_at IS NOT NULL
        AND dl.closed_at::date = d.spend_date
    ) AS won_count,
    (
      SELECT coalesce(sum(dl.amount), 0)::bigint FROM public.deals dl
      INNER JOIN public.leads l ON l.id = dl.lead_id
      WHERE dl.tenant_id = p_tenant_id AND l.tenant_id = p_tenant_id
        AND l.ad_campaign_id = c.id
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        AND dl.stage = '受注' AND dl.closed_at IS NOT NULL
        AND dl.closed_at::date = d.spend_date
    ) AS won_amount,
    CASE WHEN d.spend_amount > 0 THEN (
      (SELECT coalesce(sum(dl.amount), 0) FROM public.deals dl
       INNER JOIN public.leads l ON l.id = dl.lead_id
       WHERE dl.tenant_id = p_tenant_id AND l.tenant_id = p_tenant_id
         AND l.ad_campaign_id = c.id
         AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
         AND dl.stage = '受注' AND dl.closed_at IS NOT NULL AND dl.closed_at::date = d.spend_date
      )::double precision / d.spend_amount::double precision) * 100
    ELSE 0::double precision END AS roas,
    CASE WHEN (
      SELECT count(*) FROM public.deals dl INNER JOIN public.leads l ON l.id = dl.lead_id
      WHERE dl.tenant_id = p_tenant_id AND l.ad_campaign_id = c.id
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        AND dl.stage = '受注' AND dl.closed_at IS NOT NULL AND dl.closed_at::date = d.spend_date
    ) > 0
    THEN d.spend_amount::double precision / (
      SELECT count(*)::double precision FROM public.deals dl INNER JOIN public.leads l ON l.id = dl.lead_id
      WHERE dl.tenant_id = p_tenant_id AND l.ad_campaign_id = c.id
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
        AND dl.stage = '受注' AND dl.closed_at IS NOT NULL AND dl.closed_at::date = d.spend_date
    )
    ELSE 0::double precision END AS cpo,
    CASE WHEN (
      SELECT count(*) FROM public.leads l
      WHERE l.tenant_id = p_tenant_id AND l.ad_campaign_id = c.id
        AND l.inquiry_at::date = d.spend_date AND l.status = 'アポOK'
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
    ) > 0
    THEN d.spend_amount::double precision / (
      SELECT count(*)::double precision FROM public.leads l
      WHERE l.tenant_id = p_tenant_id AND l.ad_campaign_id = c.id
        AND l.inquiry_at::date = d.spend_date AND l.status = 'アポOK'
        AND coalesce(nullif(trim(l.source_data->>'adset_id'), ''), '') = s.external_id
    )
    ELSE 0::double precision END AS cpa,
    CASE WHEN d.clicks > 0 THEN d.spend_amount::double precision / d.clicks::double precision
    ELSE 0::double precision END AS cpc,
    CASE WHEN d.impressions > 0 THEN (d.spend_amount::double precision / d.impressions::double precision) * 1000
    ELSE 0::double precision END AS cpm
  FROM public.ad_spend_daily d
  INNER JOIN public.ad_campaigns c ON c.id = d.campaign_id AND c.tenant_id = d.tenant_id
  INNER JOIN public.ad_sets s ON s.id = d.ad_set_id AND s.tenant_id = d.tenant_id
  WHERE d.tenant_id = p_tenant_id
    AND d.creative_id IS NULL
    AND d.ad_set_id IS NOT NULL
    AND d.spend_date BETWEEN p_period_start AND p_period_end
    AND c.platform NOT IN ('tiktok', 'line')
  ORDER BY d.spend_date DESC, c.platform, c.name, s.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_ad_roi_adset_daily(uuid, date, date, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ad_roi_adset_daily(uuid, date, date, boolean) TO authenticated;
