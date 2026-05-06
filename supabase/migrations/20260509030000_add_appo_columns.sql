-- list_records: アポOK内訳フラグ（Meta/CRM の leads と整合）
-- 同一 list_records に複数 leads がある場合は「いずれか該当で TRUE」（EXISTS）

ALTER TABLE list_records ADD COLUMN IF NOT EXISTS chosei   BOOLEAN DEFAULT FALSE;
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS saiyo_ok BOOLEAN DEFAULT FALSE;
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS saiyo_ng BOOLEAN DEFAULT FALSE;
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS juchu    BOOLEAN DEFAULT FALSE;

UPDATE list_records lr
SET
  chosei = EXISTS (
    SELECT 1 FROM leads l
    WHERE l.list_record_id = lr.id
      AND l.tenant_id = lr.tenant_id
      AND trim(coalesce(l.appo_detail_status, '')) = '調整中'
  ),
  saiyo_ok = EXISTS (
    SELECT 1 FROM leads l
    WHERE l.list_record_id = lr.id
      AND l.tenant_id = lr.tenant_id
      AND trim(coalesce(l.appo_detail_status, '')) = '採用OK'
  ),
  saiyo_ng = EXISTS (
    SELECT 1 FROM leads l
    WHERE l.list_record_id = lr.id
      AND l.tenant_id = lr.tenant_id
      AND trim(coalesce(l.appo_detail_status, '')) = '採用NG'
  ),
  juchu = EXISTS (
    SELECT 1 FROM leads l
    WHERE l.list_record_id = lr.id
      AND l.tenant_id = lr.tenant_id
      AND trim(coalesce(l.appo_detail_status, '')) = '受注'
  )
WHERE EXISTS (
  SELECT 1 FROM leads l2
  WHERE l2.list_record_id = lr.id
    AND l2.tenant_id = lr.tenant_id
    AND l2.appo_detail_status IS NOT NULL
    AND trim(l2.appo_detail_status) <> ''
);
