-- ============================================================
-- list_records: FM全フィールド対応カラム追加
-- FM「リスト情報」レイアウトの全保存フィールドをSupabaseで受け取れるようにする
-- ADD COLUMN IF NOT EXISTS で既存カラムへの影響なし
-- ============================================================

ALTER TABLE list_records
  -- ── 最終コール情報（FMの「最終*」フィールド）────────────────
  ADD COLUMN IF NOT EXISTS last_agent_name        TEXT,
  ADD COLUMN IF NOT EXISTS last_rep_level         TEXT,
  ADD COLUMN IF NOT EXISTS last_rep_level2        TEXT,
  ADD COLUMN IF NOT EXISTS last_call_category     TEXT,
  ADD COLUMN IF NOT EXISTS last_rep_hit           TEXT,
  ADD COLUMN IF NOT EXISTS last_list_level        TEXT,
  ADD COLUMN IF NOT EXISTS last_call_start_time   TEXT,
  ADD COLUMN IF NOT EXISTS last_call_end_time     TEXT,
  ADD COLUMN IF NOT EXISTS last_call_duration_sec FLOAT,
  ADD COLUMN IF NOT EXISTS last_call_duration_min FLOAT,
  ADD COLUMN IF NOT EXISTS last_appo_detail       TEXT,
  ADD COLUMN IF NOT EXISTS last_cl                TEXT,
  -- ── ZOOM・メール設定用 ────────────────────────────────────
  ADD COLUMN IF NOT EXISTS zoom_pw                TEXT,
  ADD COLUMN IF NOT EXISTS zoom_id                TEXT,
  ADD COLUMN IF NOT EXISTS zoom_link              TEXT,
  ADD COLUMN IF NOT EXISTS email_subject          TEXT,
  ADD COLUMN IF NOT EXISTS email_body             TEXT,
  -- ── 基本情報（初期マイグレーション漏れ分）────────────────
  ADD COLUMN IF NOT EXISTS case_memo              TEXT,
  ADD COLUMN IF NOT EXISTS representative_name    TEXT,
  ADD COLUMN IF NOT EXISTS address                TEXT,
  ADD COLUMN IF NOT EXISTS recall_date            DATE,
  ADD COLUMN IF NOT EXISTS recall_time            TEXT;
