-- 広告コホート分析RPC
-- /api/ads/roi から get_ad_cohort_metrics(p_tenant_id) として呼び出される
-- cohort-view.tsx の CohortRow 型に合わせた戻り値

CREATE OR REPLACE FUNCTION public.get_ad_cohort_metrics(
  p_tenant_id uuid
)
RETURNS TABLE (
  cohort_month  text,
  platform      text,
  spend         numeric,
  leads_count   bigint,
  apo_count     bigint,
  won_count     bigint,
  won_amount    numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH lead_cohorts AS (
    SELECT
      to_char(l.inquiry_at, 'YYYY-MM') AS cohort_month,
      COALESCE(
        ac.platform,
        CASE
          WHEN l.source = 'meta_ads'   THEN 'Meta'
          WHEN l.source = 'google_ads' THEN 'Google'
          ELSE l.source
        END
      ) AS platform,
      l.id    AS lead_id,
      l.juchu,
      l.status
    FROM leads l
    LEFT JOIN ad_campaigns ac
      ON ac.id = l.ad_campaign_id AND ac.tenant_id = l.tenant_id
    WHERE l.tenant_id = p_tenant_id
      AND l.inquiry_at IS NOT NULL
      AND l.ad_campaign_id IS NOT NULL
  ),
  monthly_spend AS (
    SELECT
      to_char(sd.spend_date, 'YYYY-MM')       AS spend_month,
      COALESCE(ac.platform, 'unknown')         AS platform,
      SUM(sd.spend_amount)                     AS total_spend
    FROM ad_spend_daily sd
    JOIN ad_campaigns ac
      ON ac.id = sd.campaign_id AND ac.tenant_id = sd.tenant_id
    WHERE sd.tenant_id = p_tenant_id
    GROUP BY spend_month, platform
  )
  SELECT
    lc.cohort_month,
    lc.platform,
    COALESCE(ms.total_spend, 0)                                              AS spend,
    COUNT(DISTINCT lc.lead_id)                                               AS leads_count,
    COUNT(DISTINCT lc.lead_id) FILTER (WHERE lc.status IN (
      'アポOK', '調整中', '調整中（リスク/商談前）',
      '採用OK', '採用OK（商談着座）', '採用NG', '受注'
    ))                                                                        AS apo_count,
    COUNT(DISTINCT lc.lead_id) FILTER (WHERE lc.juchu = TRUE)               AS won_count,
    COALESCE(SUM(d.amount) FILTER (WHERE lc.juchu = TRUE), 0)               AS won_amount
  FROM lead_cohorts lc
  LEFT JOIN deals d
    ON d.lead_id = lc.lead_id AND d.tenant_id = p_tenant_id
  LEFT JOIN monthly_spend ms
    ON ms.spend_month = lc.cohort_month AND ms.platform = lc.platform
  GROUP BY lc.cohort_month, lc.platform, ms.total_spend
  ORDER BY lc.cohort_month ASC, lc.platform ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_ad_cohort_metrics(uuid)
  TO authenticated, service_role;
