-- ============================================================
-- calls: 代表レベル カラム追加
-- FM「コール履歴」には「代表レベル」「リストレベル」「担当レベル」の3種がある
-- 既存: rep_level=リストレベル, rep_level2=担当レベル
-- 新規: daihyo_level=代表レベル
-- ============================================================

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS daihyo_level TEXT;

COMMENT ON COLUMN calls.daihyo_level IS 'FMフィールド「代表レベル」（rep_level=リストレベル、rep_level2=担当レベルとは別）';
