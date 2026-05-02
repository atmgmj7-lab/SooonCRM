-- FM完全対応スキーマ追加（2026-05-02）
-- FMレイアウトの全フィールドに対応するカラム追加 + UNIQUE制約修正

-- ============================================================
-- list_records: 不足カラム追加
-- ============================================================
ALTER TABLE list_records
  ADD COLUMN IF NOT EXISTS business_start_time  text,
  ADD COLUMN IF NOT EXISTS business_end_time    text,
  ADD COLUMN IF NOT EXISTS homepage_exists      text,
  ADD COLUMN IF NOT EXISTS meeting_date         date,
  ADD COLUMN IF NOT EXISTS meeting_time         text,
  ADD COLUMN IF NOT EXISTS zoom_url             text,
  ADD COLUMN IF NOT EXISTS webhook_lead_id      uuid REFERENCES webhook_leads(id),
  ADD COLUMN IF NOT EXISTS source_data          jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS list_handover_date   date,
  ADD COLUMN IF NOT EXISTS list_name            text,
  ADD COLUMN IF NOT EXISTS industry             text,
  ADD COLUMN IF NOT EXISTS newcomer_flag        text,
  ADD COLUMN IF NOT EXISTS list_created_at      timestamptz,
  ADD COLUMN IF NOT EXISTS regular_holidays     jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS list_screening       text,
  ADD COLUMN IF NOT EXISTS homepage_url         text,
  ADD COLUMN IF NOT EXISTS meo_status           jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS pre_setup_date       date,
  ADD COLUMN IF NOT EXISTS pre_setup_agent      text,
  ADD COLUMN IF NOT EXISTS sales_agent          text,
  ADD COLUMN IF NOT EXISTS fm_modification_id   text;

CREATE INDEX IF NOT EXISTS idx_list_records_webhook_lead ON list_records(webhook_lead_id);

-- ============================================================
-- list_records.fm_record_id に UNIQUE 制約を追加
-- 重複がある場合は最新行だけ残して削除してから追加
-- ============================================================
DO $$
BEGIN
  DELETE FROM list_records
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY fm_record_id
          ORDER BY created_at DESC
        ) AS rn
      FROM list_records
      WHERE fm_record_id IS NOT NULL
    ) ranked
    WHERE rn > 1
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'list_records_fm_record_id_key'
      AND conrelid = 'list_records'::regclass
  ) THEN
    ALTER TABLE list_records
      ADD CONSTRAINT list_records_fm_record_id_key UNIQUE (fm_record_id);
  END IF;
END $$;

-- ============================================================
-- calls: 不足カラム追加
-- ============================================================
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS fm_modification_id    text,
  ADD COLUMN IF NOT EXISTS call_duration_seconds float,
  ADD COLUMN IF NOT EXISTS claris_id             text,
  ADD COLUMN IF NOT EXISTS rep_hit               text,
  ADD COLUMN IF NOT EXISTS hidden_flag           text,
  ADD COLUMN IF NOT EXISTS list_source           text,
  ADD COLUMN IF NOT EXISTS call_history_id       text,
  ADD COLUMN IF NOT EXISTS inquiry_date          date;

-- ============================================================
-- calls.fm_record_id に UNIQUE 制約を追加
-- ============================================================
DO $$
BEGIN
  DELETE FROM calls
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY fm_record_id
          ORDER BY created_at DESC
        ) AS rn
      FROM calls
      WHERE fm_record_id IS NOT NULL
    ) ranked
    WHERE rn > 1
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calls_fm_record_id_key'
      AND conrelid = 'calls'::regclass
  ) THEN
    ALTER TABLE calls
      ADD CONSTRAINT calls_fm_record_id_key UNIQUE (fm_record_id);
  END IF;
END $$;
