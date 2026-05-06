-- アナリティクス高速化: インデックス + RPC関数（2026-05-05）
-- TASK 5 + TASK 2-1
-- Supabaseダッシュボード SQL Editor で実行してください

-- ============================================================
-- TASK 5: インデックス追加
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_tenant_inquiry_at
  ON leads (tenant_id, inquiry_at)
  WHERE inquiry_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_list_created_at
  ON leads (tenant_id, list_created_at)
  WHERE list_created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_ad_name
  ON leads (tenant_id, ad_name)
  WHERE ad_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status
  ON leads (tenant_id, status);

-- ============================================================
-- TASK 2-1: 広告別集計 RPC
-- ============================================================

CREATE OR REPLACE FUNCTION get_ad_analytics(
  p_tenant_id UUID,
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  ad_name           TEXT,
  leads             BIGINT,
  appo              BIGINT,
  chosei            BIGINT,
  saiyo_ok          BIGINT,
  saiyo_ng          BIGINT,
  juchu             BIGINT,
  ng                BIGINT,
  taishogai         BIGINT,
  kanryo            BIGINT,
  mi_call           BIGINT,
  rusu              BIGINT,
  mikomi_a          BIGINT,
  mikomi_b          BIGINT,
  mikomi_c          BIGINT,
  mikanryo          BIGINT,
  total_revenue     BIGINT,
  cashflow_revenue  BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT
    COALESCE(l.ad_name, '広告名未設定') AS ad_name,
    COUNT(*)                            AS leads,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）','採用NG','受注'
    ))                                  AS appo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '調整中','調整中（リスク/商談前）'
    ))                                  AS chosei,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '採用OK','採用OK（商談着座）'
    ))                                  AS saiyo_ok,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '採用NG') AS saiyo_ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '受注')   AS juchu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN ('NG','採用NG')) AS ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '対象外') AS taishogai,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）',
      '採用NG','受注','NG','対象外','現アナ','現在アナログ','ポータルサイト'
    ))                                  AS kanryo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN ('新規','未コール')) AS mi_call,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '留守')   AS rusu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みA') AS mikomi_a,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みB') AS mikomi_b,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みC') AS mikomi_c,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '新規','未コール','留守','見込みA','見込みB','見込みC'
    ))                                  AS mikanryo,
    COALESCE(SUM(l.deal_amount), 0)     AS total_revenue,
    COALESCE(SUM(
      COALESCE(l.initial_fee::NUMERIC, 0) + COALESCE(l.monthly_fee::NUMERIC, 0)
    ), 0)::BIGINT                       AS cashflow_revenue
  FROM leads l
  WHERE l.tenant_id = p_tenant_id
    AND l.ad_name IS NOT NULL
    AND (p_from IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE >= p_from)
    AND (p_to   IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE <= p_to)
  GROUP BY COALESCE(l.ad_name, '広告名未設定')
  ORDER BY leads DESC;
$$;

GRANT EXECUTE ON FUNCTION get_ad_analytics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ad_analytics(UUID, DATE, DATE) TO service_role;

-- ============================================================
-- TASK 2-1: 月次集計 RPC
-- ============================================================

CREATE OR REPLACE FUNCTION get_monthly_analytics(
  p_tenant_id UUID,
  p_from DATE DEFAULT NULL,
  p_to   DATE DEFAULT NULL
)
RETURNS TABLE (
  month       TEXT,
  leads       BIGINT,
  appo        BIGINT,
  chosei      BIGINT,
  saiyo_ok    BIGINT,
  saiyo_ng    BIGINT,
  juchu       BIGINT,
  ng          BIGINT,
  taishogai   BIGINT,
  kanryo      BIGINT,
  mi_call     BIGINT,
  rusu        BIGINT,
  mikomi_a    BIGINT,
  mikomi_b    BIGINT,
  mikomi_c    BIGINT,
  mikanryo    BIGINT,
  total_revenue    BIGINT,
  cashflow_revenue BIGINT
) LANGUAGE SQL STABLE AS $$
  SELECT
    to_char(COALESCE(l.inquiry_at, l.list_created_at), 'YYYY-MM') AS month,
    COUNT(*) AS leads,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）','採用NG','受注'
    )) AS appo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '調整中','調整中（リスク/商談前）'
    )) AS chosei,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '採用OK','採用OK（商談着座）'
    )) AS saiyo_ok,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '採用NG') AS saiyo_ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '受注')   AS juchu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN ('NG','採用NG')) AS ng,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '対象外') AS taishogai,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）',
      '採用NG','受注','NG','対象外','現アナ','現在アナログ','ポータルサイト'
    )) AS kanryo,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN ('新規','未コール')) AS mi_call,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '留守')   AS rusu,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みA') AS mikomi_a,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みB') AS mikomi_b,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) = '見込みC') AS mikomi_c,
    COUNT(*) FILTER (WHERE COALESCE(l.status, l.last_call_result) IN (
      '新規','未コール','留守','見込みA','見込みB','見込みC'
    )) AS mikanryo,
    COALESCE(SUM(l.deal_amount), 0) AS total_revenue,
    COALESCE(SUM(
      COALESCE(l.initial_fee::NUMERIC, 0) + COALESCE(l.monthly_fee::NUMERIC, 0)
    ), 0)::BIGINT                   AS cashflow_revenue
  FROM leads l
  WHERE l.tenant_id = p_tenant_id
    AND l.ad_name IS NOT NULL
    AND COALESCE(l.inquiry_at, l.list_created_at) IS NOT NULL
    AND EXTRACT(YEAR FROM COALESCE(l.inquiry_at, l.list_created_at)) >= 2020
    AND COALESCE(l.inquiry_at, l.list_created_at) <= NOW()
    AND (p_from IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE >= p_from)
    AND (p_to   IS NULL OR COALESCE(l.inquiry_at, l.list_created_at)::DATE <= p_to)
  GROUP BY month
  ORDER BY month ASC;
$$;

GRANT EXECUTE ON FUNCTION get_monthly_analytics(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_analytics(UUID, DATE, DATE) TO service_role;
