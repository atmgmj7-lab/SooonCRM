-- list_records に最終架電日カラムを追加し、
-- calls → list_records のトリガーで自動更新する

-- 1. last_call_at 列追加
ALTER TABLE list_records
  ADD COLUMN IF NOT EXISTS last_call_at DATE;

-- 2. 既存の sync_call_result_to_list_record() を last_call_at も更新するよう置換
--    (20260509040000_hub_sync_triggers.sql で定義済みの関数を上書き)
CREATE OR REPLACE FUNCTION sync_call_result_to_list_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_list_record_id UUID;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT list_record_id INTO target_list_record_id
    FROM leads
    WHERE id = NEW.lead_id
    LIMIT 1;
  ELSIF NEW.list_record_id IS NOT NULL THEN
    target_list_record_id := NEW.list_record_id;
  END IF;

  IF target_list_record_id IS NULL OR NEW.call_result IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE list_records
  SET
    last_call_result = NEW.call_result,
    last_call_at     = NEW.call_date,
    updated_at       = NOW()
  WHERE id = target_list_record_id;

  RETURN NEW;
END;
$$;

-- 3. 既存コールデータのバックフィル（最新架電日を各 list_record に反映）
UPDATE list_records lr
SET last_call_at = sub.latest_date
FROM (
  SELECT
    COALESCE(
      c.list_record_id,
      (SELECT list_record_id FROM leads WHERE id = c.lead_id AND list_record_id IS NOT NULL LIMIT 1)
    ) AS lr_id,
    MAX(c.call_date) AS latest_date
  FROM calls c
  WHERE c.call_date IS NOT NULL
  GROUP BY lr_id
) sub
WHERE lr.id = sub.lr_id
  AND sub.lr_id IS NOT NULL
  AND lr.last_call_at IS NULL;
