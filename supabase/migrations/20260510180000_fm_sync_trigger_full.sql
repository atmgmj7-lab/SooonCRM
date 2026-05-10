-- ============================================================
-- calls → list_records: 全 last_* フィールド同期トリガー更新
-- コール保存時に list_records の「最終*」情報を自動更新する
-- これにより FM からのリスト情報 Webhook 送信が不要になる（1回通信化）
-- ============================================================

CREATE OR REPLACE FUNCTION sync_call_result_to_list_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.list_record_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE list_records
  SET
    -- コール結果・日時
    last_call_result        = NEW.call_result,
    last_call_at            = NEW.call_date,
    last_call_start_time    = NEW.call_start_time,
    last_call_end_time      = NEW.call_end_time,
    last_call_duration_sec  = NEW.call_duration_seconds,
    last_call_duration_min  = NEW.call_duration_minutes,
    -- 担当者・レベル
    last_agent_name         = NEW.agent_name,
    last_rep_hit            = NEW.rep_hit,
    last_cl                 = NEW.ci,
    last_rep_level          = NEW.daihyo_level,
    last_list_level         = NEW.rep_level,
    last_rep_level2         = NEW.rep_level2,
    last_call_category      = NEW.call_category,
    -- アポ情報
    last_appo_detail        = NEW.appo_detail,
    updated_at              = NOW()
  WHERE id = NEW.list_record_id;

  RETURN NEW;
END;
$$;

-- トリガーを全フィールド変更対応に再作成
DROP TRIGGER IF EXISTS trg_call_to_list_record ON calls;
CREATE TRIGGER trg_call_to_list_record
AFTER INSERT OR UPDATE ON calls
FOR EACH ROW EXECUTE FUNCTION sync_call_result_to_list_record();
