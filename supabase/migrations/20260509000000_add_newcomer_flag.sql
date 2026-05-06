-- ============================================================
-- Supabase ダッシュボードの SQL Editor で手動実行してください。
-- （ローカル CLI で適用する場合は `supabase db push` 等で反映可能）
-- ============================================================

-- 1. callsにnewcomer_flagを追加
ALTER TABLE calls ADD COLUMN IF NOT EXISTS newcomer_flag TEXT;

-- 2. leadsにも追加
ALTER TABLE leads ADD COLUMN IF NOT EXISTS newcomer_flag TEXT;

-- 3. callsトリガー（架電結果→leadsステータス自動反映）
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
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF target_lead_id IS NULL OR NEW.call_result IS NULL OR NEW.call_result = '' THEN
    RETURN NEW;
  END IF;

  UPDATE leads
  SET
    status = NEW.call_result,
    last_call_result = NEW.call_result,
    updated_at = NOW()
  WHERE id = target_lead_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_status ON calls;
CREATE TRIGGER trg_sync_lead_status
AFTER INSERT OR UPDATE OF call_result ON calls
FOR EACH ROW EXECUTE FUNCTION sync_lead_status_from_call();

-- 4. 既存callsデータのleads.status一括反映
WITH latest_calls AS (
  SELECT DISTINCT ON (lead_id)
    lead_id, call_result, agent_name, call_date
  FROM calls
  WHERE tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
    AND lead_id IS NOT NULL
    AND call_result IS NOT NULL AND call_result != ''
  ORDER BY lead_id, call_date DESC, created_at DESC
)
UPDATE leads l
SET
  status = lc.call_result,
  last_call_result = lc.call_result,
  updated_at = NOW()
FROM latest_calls lc
WHERE l.id = lc.lead_id
  AND l.tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';
