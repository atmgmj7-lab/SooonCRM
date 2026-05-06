-- list_records: 架電結果・アポ内訳の HUB 同期トリガー
-- ⚠️ Supabase ダッシュボードの SQL Editor で実行するか supabase db push で適用してください。

-- =============================================
-- 列追加（トリガー・関数より先に必要）
-- =============================================
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS selected_lead_id UUID REFERENCES leads(id);
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS last_call_result TEXT;

-- =============================================
-- トリガー1: calls更新 → list_recordsの最終架電結果を自動更新
-- =============================================
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
    updated_at = NOW()
  WHERE id = target_list_record_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_call_to_list_record ON calls;
CREATE TRIGGER trg_call_to_list_record
AFTER INSERT OR UPDATE OF call_result ON calls
FOR EACH ROW EXECUTE FUNCTION sync_call_result_to_list_record();

-- =============================================
-- トリガー2: leads.appo_detail_status更新 → list_recordsのchosei/saiyo_ok/saiyo_ng/juchuを更新
-- =============================================
CREATE OR REPLACE FUNCTION sync_appo_detail_to_list_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.list_record_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.appo_detail_status IS NOT DISTINCT FROM OLD.appo_detail_status THEN
    RETURN NEW;
  END IF;

  UPDATE list_records
  SET
    chosei   = (NEW.appo_detail_status = '調整中'),
    saiyo_ok = (NEW.appo_detail_status = '採用OK'),
    saiyo_ng = (NEW.appo_detail_status = '採用NG'),
    juchu    = (NEW.appo_detail_status = '受注'),
    updated_at = NOW()
  WHERE id = NEW.list_record_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appo_detail_to_list ON leads;
CREATE TRIGGER trg_appo_detail_to_list
AFTER UPDATE OF appo_detail_status ON leads
FOR EACH ROW EXECUTE FUNCTION sync_appo_detail_to_list_record();

-- =============================================
-- トリガー3: list_recordsのchosei/saiyo_ok/saiyo_ng/juchu更新 → 紐づくleadsに反映
-- selected_lead_id がある場合はそのリードへ、なければ inquiry_at 最大のリードへ
-- =============================================
CREATE OR REPLACE FUNCTION sync_list_appo_to_latest_lead()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_lead_id UUID;
  new_appo_status TEXT;
BEGIN
  IF (NEW.chosei   IS NOT DISTINCT FROM OLD.chosei AND
      NEW.saiyo_ok IS NOT DISTINCT FROM OLD.saiyo_ok AND
      NEW.saiyo_ng IS NOT DISTINCT FROM OLD.saiyo_ng AND
      NEW.juchu    IS NOT DISTINCT FROM OLD.juchu) THEN
    RETURN NEW;
  END IF;

  new_appo_status := CASE
    WHEN NEW.juchu    THEN '受注'
    WHEN NEW.saiyo_ok THEN '採用OK'
    WHEN NEW.saiyo_ng THEN '採用NG'
    WHEN NEW.chosei   THEN '調整中'
    ELSE NULL
  END;

  target_lead_id := NULL;
  IF NEW.selected_lead_id IS NOT NULL THEN
    SELECT l.id INTO target_lead_id
    FROM leads l
    WHERE l.id = NEW.selected_lead_id
      AND l.list_record_id = NEW.id
      AND l.tenant_id = NEW.tenant_id
    LIMIT 1;
  END IF;

  IF target_lead_id IS NULL THEN
    SELECT id INTO target_lead_id
    FROM leads
    WHERE list_record_id = NEW.id
      AND tenant_id = NEW.tenant_id
    ORDER BY inquiry_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;

  IF target_lead_id IS NOT NULL THEN
    UPDATE leads
    SET
      appo_detail_status = new_appo_status,
      updated_at = NOW()
    WHERE id = target_lead_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_list_appo_to_lead ON list_records;
CREATE TRIGGER trg_list_appo_to_lead
AFTER UPDATE OF chosei, saiyo_ok, saiyo_ng, juchu ON list_records
FOR EACH ROW EXECUTE FUNCTION sync_list_appo_to_latest_lead();
