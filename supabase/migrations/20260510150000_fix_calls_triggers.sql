-- ============================================================
-- calls テーブル トリガー修正
-- エラー: record "new" has no field "result"
--
-- 原因: DB_SCHEMA.sql の calls_after_insert トリガーが本番DBに残っており
--       NEW.result（廃止カラム名）を参照していた。
--       現行の calls テーブルは call_result カラムを使用。
-- ============================================================

-- 1. 廃止済みトリガー・関数を削除（NEW.result を参照する旧スキーマ定義）
DROP TRIGGER IF EXISTS calls_after_insert ON calls;
DROP FUNCTION IF EXISTS trg_promote_lead_status_from_call();

-- 2. 旧 update_last_call_info を削除
--    list_records に存在しない last_call_date 等を UPDATE しようとする
DROP TRIGGER IF EXISTS trg_update_last_call ON calls;
DROP FUNCTION IF EXISTS update_last_call_info();

-- 3. sync_lead_status_from_call のトリガー削除（あれば）
--    calls に lead_id カラムが存在しないため NEW.lead_id 参照でエラーになる
DROP TRIGGER IF EXISTS trg_sync_lead_status ON calls;

-- 4. calls に必須カラムが存在することを保証（未適用マイグレーションへの安全ガード）
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ;

ALTER TABLE calls
  ALTER COLUMN list_record_id DROP NOT NULL;

-- 5. sync_call_result_to_list_record を現行スキーマに合わせて置換
--    calls に lead_id が存在しないため、list_record_id のみで解決する
CREATE OR REPLACE FUNCTION sync_call_result_to_list_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.list_record_id IS NULL OR NEW.call_result IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE list_records
  SET
    last_call_result = NEW.call_result,
    last_call_at     = NEW.call_date,
    updated_at       = NOW()
  WHERE id = NEW.list_record_id;

  RETURN NEW;
END;
$$;

-- 6. trg_call_to_list_record を確実に再作成
DROP TRIGGER IF EXISTS trg_call_to_list_record ON calls;
CREATE TRIGGER trg_call_to_list_record
AFTER INSERT OR UPDATE OF call_result ON calls
FOR EACH ROW EXECUTE FUNCTION sync_call_result_to_list_record();
