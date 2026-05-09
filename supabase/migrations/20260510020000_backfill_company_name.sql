-- 既存の広告リードで company_name が NULL のものにフォールバック値を設定
-- （フィルター修正(20260510)以前に作成されたレコードが対象）

UPDATE list_records
SET company_name = '【' || COALESCE(NULLIF(trim(ad_name), ''), '広告') || 'からの問い合わせ】'
WHERE company_name IS NULL
  AND source IN ('meta_ads', 'google_ads');
