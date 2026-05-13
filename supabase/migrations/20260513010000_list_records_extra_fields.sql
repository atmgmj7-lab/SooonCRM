-- list_records: FM全フィールド対応カラム追加（業種・MEO等 不足分）

ALTER TABLE list_records
  ADD COLUMN IF NOT EXISTS industry           TEXT,   -- 業種
  ADD COLUMN IF NOT EXISTS meo                TEXT,   -- MEO
  ADD COLUMN IF NOT EXISTS list_source        TEXT,   -- リスト仕入れ先
  ADD COLUMN IF NOT EXISTS list_transfer_date DATE,   -- リスト譲渡日
  ADD COLUMN IF NOT EXISTS homepage_url       TEXT,   -- ホームページURL
  ADD COLUMN IF NOT EXISTS email_address      TEXT,   -- メールアドレス
  ADD COLUMN IF NOT EXISTS list_quality       TEXT;   -- リスト精査
