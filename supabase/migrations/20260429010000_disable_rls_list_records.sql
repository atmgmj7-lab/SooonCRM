-- list_records テーブルの RLS を無効化
-- webhook_leads と同様に anon key でもアクセス可能にする
ALTER TABLE list_records DISABLE ROW LEVEL SECURITY;
