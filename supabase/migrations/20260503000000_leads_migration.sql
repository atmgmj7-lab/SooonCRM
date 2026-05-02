-- leads移行・電話番号照合紐づけ・問い合わせ履歴集計（2026-05-03）

-- ============================================================
-- STEP 1: leads インデックス追加（customer_idは既存）
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_list_record_id ON leads(list_record_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number);

-- list_record_idのFK制約をcustomers→list_recordsに変更
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_list_record_id_fkey;

-- customer_idのNOT NULL制約を解除（Meta広告リードはcustomer_id=NULLで始まる）
ALTER TABLE leads ALTER COLUMN customer_id DROP NOT NULL;

-- ============================================================
-- STEP 2: list_records のMeta広告データ(fm_record_id=NULL)をleadsへ移行
-- ============================================================
INSERT INTO leads (
  id,
  tenant_id,
  list_record_id,
  customer_id,
  ad_name,
  company_name,
  representative_name,
  prefecture,
  phone_number,
  inquiry_date,
  inquiry_at,
  source_data,
  created_at
)
SELECT
  gen_random_uuid(),
  tenant_id,
  NULL,
  NULL,
  ad_name,
  company_name,
  representative_name,
  prefecture,
  phone_numbers->>0,
  CASE
    WHEN list_handover_date IS NOT NULL THEN list_handover_date
    ELSE created_at::date
  END,
  created_at,
  COALESCE(source_data, '{}'),
  created_at
FROM list_records
WHERE fm_record_id IS NULL
  AND tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';

-- ============================================================
-- STEP 3: leadsとlist_recordsを電話番号で紐づけ
-- ============================================================
-- leads.customer_id はuuid型のため list_records.customer_id(text)とは紐づけ不可
-- list_record_id (uuid) のみセット
UPDATE leads l
SET list_record_id = lr.id
FROM list_records lr
WHERE l.list_record_id IS NULL
  AND l.phone_number IS NOT NULL
  AND l.phone_number != ''
  AND lr.fm_record_id IS NOT NULL
  AND lr.tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'
  AND lr.phone_numbers::jsonb @> to_jsonb(regexp_replace(l.phone_number, '[^0-9]', '', 'g'));

-- ============================================================
-- STEP 4: list_recordsに問い合わせ履歴集計カラム追加
-- ============================================================
ALTER TABLE list_records
  ADD COLUMN IF NOT EXISTS inquiry_count        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_inquiry_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_inquiry_ad_name text;

-- 既存データで初期集計
UPDATE list_records lr SET
  inquiry_count        = (SELECT COUNT(*)   FROM leads WHERE list_record_id = lr.id),
  last_inquiry_at      = (SELECT MAX(created_at) FROM leads WHERE list_record_id = lr.id),
  last_inquiry_ad_name = (
    SELECT ad_name FROM leads
    WHERE list_record_id = lr.id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
  )
WHERE id IN (SELECT DISTINCT list_record_id FROM leads WHERE list_record_id IS NOT NULL);

-- ============================================================
-- STEP 5: 新規リード受信時に自動集計するトリガー
-- ============================================================
CREATE OR REPLACE FUNCTION fn_update_inquiry_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.list_record_id IS NOT NULL THEN
    UPDATE list_records SET
      inquiry_count        = (SELECT COUNT(*)   FROM leads WHERE list_record_id = NEW.list_record_id),
      last_inquiry_at      = (SELECT MAX(created_at) FROM leads WHERE list_record_id = NEW.list_record_id),
      last_inquiry_ad_name = (
        SELECT ad_name FROM leads
        WHERE list_record_id = NEW.list_record_id
        ORDER BY created_at DESC NULLS LAST LIMIT 1
      ),
      updated_at = now()
    WHERE id = NEW.list_record_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_inquiry_stats ON leads;
CREATE TRIGGER trg_update_inquiry_stats
  AFTER INSERT OR UPDATE OF list_record_id ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_inquiry_stats();

-- ============================================================
-- STEP 6: 移行済みデータをlist_recordsから削除
-- ============================================================
DELETE FROM list_records
WHERE fm_record_id IS NULL
  AND tenant_id = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d';
