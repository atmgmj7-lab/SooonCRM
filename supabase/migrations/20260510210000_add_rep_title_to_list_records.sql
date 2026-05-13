-- Add rep_title (役職) to list_records for Meta webhook data
ALTER TABLE list_records ADD COLUMN IF NOT EXISTS rep_title text;
