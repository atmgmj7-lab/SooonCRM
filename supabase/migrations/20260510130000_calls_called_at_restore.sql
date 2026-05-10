-- calls.called_at 復帰（schema_cleanup で DROP 後もトリガ等が NEW.called_at を参照している DB 向け）
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS called_at TIMESTAMPTZ;

COMMENT ON COLUMN calls.called_at IS 'コール開始の実日時（Asia/Tokyo 相当を API でオフセット付きで格納）。';

-- calls.list_record_id を NULL 許可
-- FM Webhook でコールが来た時点で list_records に未登録のケースに対応
ALTER TABLE calls
  ALTER COLUMN list_record_id DROP NOT NULL;
