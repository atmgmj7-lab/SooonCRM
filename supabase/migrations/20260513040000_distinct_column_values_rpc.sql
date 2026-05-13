-- get_distinct_column_values: テーブルの指定カラムのユニーク値リストを返す汎用RPC
-- 使用箇所: チェックボックスフィルターのドロップダウン候補取得
CREATE OR REPLACE FUNCTION get_distinct_column_values(
  p_tenant_id uuid,
  p_table     text,
  p_column    text,
  p_limit     int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allowed_tables  text[] := ARRAY['leads', 'list_records'];
  v_allowed_columns text[] := ARRAY['ad_name', 'prefecture', 'status', 'source', 'representative_name'];
  v_result          jsonb;
BEGIN
  -- ホワイトリスト検証（SQLインジェクション防止）
  IF NOT (p_table = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Table not allowed: %', p_table;
  END IF;
  IF NOT (p_column = ANY(v_allowed_columns)) THEN
    RAISE EXCEPTION 'Column not allowed: %', p_column;
  END IF;

  IF p_table = 'leads' THEN
    SELECT jsonb_agg(DISTINCT val ORDER BY val)
    INTO v_result
    FROM (
      SELECT l.ad_name   AS val FROM leads l WHERE l.tenant_id = p_tenant_id AND l.ad_name IS NOT NULL AND p_column = 'ad_name'
      UNION ALL
      SELECT l.prefecture AS val FROM leads l WHERE l.tenant_id = p_tenant_id AND l.prefecture IS NOT NULL AND p_column = 'prefecture'
      UNION ALL
      SELECT l.status    AS val FROM leads l WHERE l.tenant_id = p_tenant_id AND l.status IS NOT NULL AND p_column = 'status'
      UNION ALL
      SELECT l.source    AS val FROM leads l WHERE l.tenant_id = p_tenant_id AND l.source IS NOT NULL AND p_column = 'source'
    ) sub
    LIMIT p_limit;
  ELSIF p_table = 'list_records' THEN
    SELECT jsonb_agg(DISTINCT val ORDER BY val)
    INTO v_result
    FROM (
      SELECT lr.ad_name             AS val FROM list_records lr WHERE lr.tenant_id = p_tenant_id AND lr.ad_name IS NOT NULL AND p_column = 'ad_name'
      UNION ALL
      SELECT lr.prefecture           AS val FROM list_records lr WHERE lr.tenant_id = p_tenant_id AND lr.prefecture IS NOT NULL AND p_column = 'prefecture'
      UNION ALL
      SELECT lr.source               AS val FROM list_records lr WHERE lr.tenant_id = p_tenant_id AND lr.source IS NOT NULL AND p_column = 'source'
      UNION ALL
      SELECT lr.representative_name  AS val FROM list_records lr WHERE lr.tenant_id = p_tenant_id AND lr.representative_name IS NOT NULL AND p_column = 'representative_name'
    ) sub
    LIMIT p_limit;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
