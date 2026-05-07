-- ============================================================
-- スキーマクリーンアップ（list_records / leads / calls）
-- 2026-05-07
--
-- ⚠️ 本ファイルは原則として Supabase ダッシュボードの SQL Editor で
--    手動実行してください（レビュー後に本番へ適用）。
-- ⚠️ `supabase db push` / `supabase db reset` だけに頼る場合:
--    ファイル名のタイムスタンプが 20260509 系（chosei 追加など）より前なので、
--    空の DB に時系列で流すと「先に DROP（列なし）→ 後から列が ADD される」
--    挙動になり、意図したクリーンアップにならないことがあります。
--    その場合はファイル名を 20260510000000 以降に差し替えるか、
--    既に後続マイグレーション適用済みの DB に対してのみ手動実行してください。
--
-- （本チャットスレッドでは実行しないこと）
-- ============================================================

-- ---------------------------------------------------------------------------
-- 0. leads.juchu を先に用意（トリガー・バックフィルで参照）
-- ---------------------------------------------------------------------------
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS juchu BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE leads
SET juchu = TRUE
WHERE trim(coalesce(appo_detail_status, '')) = '受注';

-- ---------------------------------------------------------------------------
-- 1. list_records のアポ内訳列を参照するトリガーを除去・置換
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_list_appo_to_lead ON list_records;
DROP FUNCTION IF EXISTS sync_list_appo_to_latest_lead();

DROP TRIGGER IF EXISTS trg_appo_detail_to_list ON leads;
DROP FUNCTION IF EXISTS sync_appo_detail_to_list_record();

-- appo_detail_status に応じて同一 lead 行の juchu のみ同期（list_records の集約列は廃止）
CREATE OR REPLACE FUNCTION leads_set_juchu_from_appo_detail()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.appo_detail_status IS NOT DISTINCT FROM OLD.appo_detail_status THEN
    RETURN NEW;
  END IF;
  NEW.juchu := (trim(coalesce(NEW.appo_detail_status, '')) = '受注');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_appo_juchu ON leads;
CREATE TRIGGER trg_leads_appo_juchu
  BEFORE INSERT OR UPDATE OF appo_detail_status ON leads
  FOR EACH ROW
  EXECUTE FUNCTION leads_set_juchu_from_appo_detail();

-- ---------------------------------------------------------------------------
-- 2. calls → leads: last_call_result 更新をやめ status のみ（列削除に合わせる）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_lead_status_from_call()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_lead_id UUID;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    target_lead_id := NEW.lead_id;
  ELSIF NEW.list_record_id IS NOT NULL THEN
    SELECT id INTO target_lead_id
    FROM leads
    WHERE list_record_id = NEW.list_record_id
      AND tenant_id = NEW.tenant_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF target_lead_id IS NULL OR NEW.call_result IS NULL OR NEW.call_result = '' THEN
    RETURN NEW;
  END IF;

  UPDATE leads
  SET
    status = NEW.call_result,
    updated_at = NOW()
  WHERE id = target_lead_id;

  RETURN NEW;
END;
$$;

-- （参考）20260509000000 内の一括バックフィルはマイグレーション再適用されないため、
-- 必要なら手動で同様の UPDATE（last_call_result なし）を実行すること。

-- ---------------------------------------------------------------------------
-- 3. アナリティクス RPC: leads.last_call_result 参照を除去
-- ---------------------------------------------------------------------------
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
    COUNT(*) FILTER (WHERE l.status IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）','採用NG','受注'
    ))                                  AS appo,
    COUNT(*) FILTER (WHERE l.status IN (
      '調整中','調整中（リスク/商談前）'
    ))                                  AS chosei,
    COUNT(*) FILTER (WHERE l.status IN (
      '採用OK','採用OK（商談着座）'
    ))                                  AS saiyo_ok,
    COUNT(*) FILTER (WHERE l.status = '採用NG') AS saiyo_ng,
    COUNT(*) FILTER (WHERE l.juchu IS TRUE OR l.status = '受注') AS juchu,
    COUNT(*) FILTER (WHERE l.status IN ('NG','採用NG')) AS ng,
    COUNT(*) FILTER (WHERE l.status = '対象外') AS taishogai,
    COUNT(*) FILTER (WHERE l.status IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）',
      '採用NG','受注','NG','対象外','現アナ','現在アナログ','ポータルサイト'
    ))                                  AS kanryo,
    COUNT(*) FILTER (WHERE l.status IN ('新規','未コール')) AS mi_call,
    COUNT(*) FILTER (WHERE l.status = '留守')   AS rusu,
    COUNT(*) FILTER (WHERE l.status = '見込みA') AS mikomi_a,
    COUNT(*) FILTER (WHERE l.status = '見込みB') AS mikomi_b,
    COUNT(*) FILTER (WHERE l.status = '見込みC') AS mikomi_c,
    COUNT(*) FILTER (WHERE l.status IN (
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
    COUNT(*) FILTER (WHERE l.status IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）','採用NG','受注'
    )) AS appo,
    COUNT(*) FILTER (WHERE l.status IN (
      '調整中','調整中（リスク/商談前）'
    )) AS chosei,
    COUNT(*) FILTER (WHERE l.status IN (
      '採用OK','採用OK（商談着座）'
    )) AS saiyo_ok,
    COUNT(*) FILTER (WHERE l.status = '採用NG') AS saiyo_ng,
    COUNT(*) FILTER (WHERE l.juchu IS TRUE OR l.status = '受注') AS juchu,
    COUNT(*) FILTER (WHERE l.status IN ('NG','採用NG')) AS ng,
    COUNT(*) FILTER (WHERE l.status = '対象外') AS taishogai,
    COUNT(*) FILTER (WHERE l.status IN (
      'アポOK','調整中','調整中（リスク/商談前）','採用OK','採用OK（商談着座）',
      '採用NG','受注','NG','対象外','現アナ','現在アナログ','ポータルサイト'
    )) AS kanryo,
    COUNT(*) FILTER (WHERE l.status IN ('新規','未コール')) AS mi_call,
    COUNT(*) FILTER (WHERE l.status = '留守')   AS rusu,
    COUNT(*) FILTER (WHERE l.status = '見込みA') AS mikomi_a,
    COUNT(*) FILTER (WHERE l.status = '見込みB') AS mikomi_b,
    COUNT(*) FILTER (WHERE l.status = '見込みC') AS mikomi_c,
    COUNT(*) FILTER (WHERE l.status IN (
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

CREATE OR REPLACE FUNCTION public.get_lead_stats_by_adset(
  target_tenant_id uuid,
  from_date date default (current_date - interval '30 days')::date,
  to_date   date default current_date
)
RETURNS TABLE (
  adset_id      text,
  total_leads   bigint,
  appo_ok_count bigint,
  order_count   bigint,
  total_revenue bigint,
  appo_rate     numeric,
  order_rate    numeric
)
LANGUAGE sql STABLE AS $$
  SELECT
    l.adset_id,
    count(*) AS total_leads,
    count(*) FILTER (WHERE l.status = 'アポOK' OR l.jitsuyo_ok = true) AS appo_ok_count,
    count(*) FILTER (WHERE l.order_closed = true) AS order_count,
    coalesce(sum(l.total_revenue::integer) FILTER (WHERE l.order_closed = true), 0) AS total_revenue,
    round(
      count(*) FILTER (WHERE l.status = 'アポOK' OR l.jitsuyo_ok = true)
      * 100.0 / nullif(count(*), 0), 1
    ) AS appo_rate,
    round(
      count(*) FILTER (WHERE l.order_closed = true)
      * 100.0 / nullif(count(*), 0), 1
    ) AS order_rate
  FROM public.leads l
  WHERE l.tenant_id = target_tenant_id
    AND l.inquiry_date::date BETWEEN from_date AND to_date
    AND l.adset_id IS NOT NULL
  GROUP BY l.adset_id;
$$;

-- ---------------------------------------------------------------------------
-- 4. list_records 列削除
-- ---------------------------------------------------------------------------
ALTER TABLE list_records
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS temperature,
  DROP COLUMN IF EXISTS temperature_reason,
  DROP COLUMN IF EXISTS priority_score,
  DROP COLUMN IF EXISTS assigned_to,
  DROP COLUMN IF EXISTS lost_reason,
  DROP COLUMN IF EXISTS deal_amount,
  DROP COLUMN IF EXISTS deal_closed_at,
  DROP COLUMN IF EXISTS chosei,
  DROP COLUMN IF EXISTS saiyo_ok,
  DROP COLUMN IF EXISTS saiyo_ng,
  DROP COLUMN IF EXISTS juchu;

-- ---------------------------------------------------------------------------
-- 5. leads 列削除（last_call_result は RPC・トリガー修正後）
-- ---------------------------------------------------------------------------
ALTER TABLE leads
  DROP COLUMN IF EXISTS last_call_result,
  DROP COLUMN IF EXISTS inquiry_date_1,
  DROP COLUMN IF EXISTS inquiry_datetime_raw,
  DROP COLUMN IF EXISTS temperature,
  DROP COLUMN IF EXISTS temperature_reason,
  DROP COLUMN IF EXISTS priority_score,
  DROP COLUMN IF EXISTS completion_progress,
  DROP COLUMN IF EXISTS imported_from_csv,
  DROP COLUMN IF EXISTS csv_row_number,
  DROP COLUMN IF EXISTS has_deal,
  DROP COLUMN IF EXISTS total_call_count,
  DROP COLUMN IF EXISTS first_call_at,
  DROP COLUMN IF EXISTS last_call_at,
  DROP COLUMN IF EXISTS adjusting,
  DROP COLUMN IF EXISTS ichiyou_ng,
  DROP COLUMN IF EXISTS status_locked_at,
  DROP COLUMN IF EXISTS status_locked_by,
  DROP COLUMN IF EXISTS status_history;

-- juchu は手順 0 で追加済み。重複定義を避けるためここでは ADD しない。

-- ---------------------------------------------------------------------------
-- 6. calls 列削除
-- ---------------------------------------------------------------------------
ALTER TABLE calls
  DROP COLUMN IF EXISTS duration_seconds,
  DROP COLUMN IF EXISTS called_at,
  DROP COLUMN IF EXISTS direction;
