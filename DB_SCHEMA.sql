-- ============================================================
-- AI CRM OS — 確定スキーマ
-- 2026年4月26日 統合決定版 v3
--
-- 設計方針:
--   1. 4層エンティティ (customers / leads / calls / deals)
--   2. ステータス・指標は動的マスタ駆動
--   3. JSONB拡張で項目追加に強い
--   4. FM同期は片方向（Phase 1）→ 双方向（Phase 3）対応構造
--   5. AI学習基盤の3層保存（構造化/非構造化/ベクトル）
--   6. 同一顧客の重複リードも全部カウント（広告ROI算出のため）
-- ============================================================

-- =============================================
-- 拡張機能
-- =============================================
create extension if not exists "uuid-ossp";
create extension if not exists "vector";
create extension if not exists "pg_trgm";

-- ============================================================
-- 1. テナント・ユーザー（マルチテナント基盤）
-- ============================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text not null unique,
  name text not null,
  mode text not null default 'self_hosted', -- 'self_hosted' / 'saas_client'
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  clerk_user_id text not null,
  role text not null default 'member', -- 'admin' / 'member'
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  unique(tenant_id, clerk_user_id)
);

-- ============================================================
-- 2. 顧客マスタ（customers）
-- 同一顧客は phone + customer_code で一意
-- ============================================================

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  -- === 同一性キー（FMのCSコードを継承）===
  customer_code text not null,           -- 例: "CS0140436"（FMのCSコードと一致）
  primary_phone text,                    -- 主電話番号（同一性判定キー）

  -- === 基本情報 ===
  company_name text,                     -- 会社名
  representative_name text,              -- 代表名
  title text,                            -- 役職
  industry text,                         -- 業種
  prefecture text,                       -- 都道府県
  address text,                          -- 住所
  email text,                            -- 会社mail
  phone_numbers jsonb not null default '[]', -- 複数電話番号 ["09012345678", "0312345678"]

  -- === 営業情報 ===
  business_start_time text,              -- 営業開始
  business_end_time text,                -- 営業終了
  regular_holidays jsonb not null default '[]', -- 定休日 ["月","水","金"]
  homepage_url text,
  meo_status jsonb not null default '[]', -- ["未対策","写真更新","商品設計"]

  -- === 顧客LTV集計用（マテリアライズドビューから定期更新）===
  total_lead_count int not null default 0,
  total_deal_count int not null default 0,
  total_deal_amount bigint not null default 0,
  first_contacted_at timestamptz,
  last_contacted_at timestamptz,

  -- === FM連携 ===
  fm_record_id text,                     -- FileMakerのレコードID
  fm_modification_id text,               -- FileMakerの修正ID
  fm_synced_at timestamptz,

  -- === カスタム項目（拡張用 JSONB）===
  custom_data jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 同一顧客判定: tenant内で customer_code は一意
  unique(tenant_id, customer_code)
);

-- ============================================================
-- 3. リード（leads = 問い合わせ単位）
-- 1顧客に複数のリードが紐づく（広告A流入、広告B流入で別レコード）
-- ステータスはこのテーブルで管理
-- ============================================================

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,

  -- === 流入情報 ===
  inquiry_at timestamptz not null,       -- 問い合わせ日時
  source text not null default 'other',  -- 'meta_ads' / 'google_ads' / 'web_form' / 'referral' / 'dm' / 'other'

  -- 広告キャンペーン・クリエイティブへの参照（FK制約はad_campaigns/ad_creatives作成後にALTER TABLEで追加）
  ad_campaign_id uuid,
  ad_creative_id uuid,
  ad_name text,                          -- 広告名（クリエイティブ追跡が深まるまでの暫定保持）

  -- 流入時の生データ（拡張可能）
  source_data jsonb not null default '{}',
  -- 例: メタ広告:   {"campaign_id":"...", "ad_id":"...", "adset_id":"...", "creative_name":"..."}
  --     リスティング: {"campaign_id":"...", "keyword":"...", "match_type":"...", "gclid":"..."}
  --     DM:        {"platform":"Instagram", "template_id":"..."}
  --     紹介:       {"referrer_name":"...", "referrer_company":"..."}

  inquiry_content text,                  -- 問い合わせ内容

  -- === ステータス管理（リード単位）===
  status text not null default '新規',    -- status_definitions.status_key を参照
  status_locked_at timestamptz,          -- 手動ロック日時（ロック中は自動昇格しない）
  status_locked_by uuid references tenant_members(id),
  status_history jsonb not null default '[]',
  -- 例: [{"status":"新規","at":"2025-09-01T10:00:00Z","by":"system"},
  --      {"status":"留守","at":"2025-09-02T11:30:00Z","by":"call:abc123"},
  --      {"status":"アポOK","at":"2025-09-05T14:00:00Z","by":"call:xyz456"}]

  -- === AI判定 ===
  temperature text not null default 'cold', -- 'hot' / 'warm' / 'cold'
  temperature_reason text,
  priority_score float not null default 0.0,

  -- === 受注管理（リード単位の受注情報サマリ・詳細はdealsテーブル）===
  has_deal boolean not null default false,
  deal_amount int,                       -- 受注金額
  deal_closed_at timestamptz,            -- 受注確定日
  lost_reason text,                      -- 失注理由

  -- === 担当 ===
  assigned_to uuid references tenant_members(id),

  -- === KPI ===
  first_call_at timestamptz,
  last_call_at timestamptz,
  total_call_count int not null default 0,

  -- === FM連携 ===
  fm_record_id text,
  fm_synced_at timestamptz,

  -- === カスタム項目 ===
  custom_data jsonb not null default '{}',

  -- === ソート用 ===
  list_handover_date date,               -- リスト譲渡日（FM互換）
  recall_date date,                      -- 再コール日
  recall_time text,                      -- 再コール時刻

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. コール（calls = 架電履歴）
-- 1リードに複数のコールが紐づく
-- 最新コールの結果が leads.status に自動昇格する
-- ============================================================

create table calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade, -- 高速JOIN用に冗長保持

  agent_id uuid references tenant_members(id) on delete set null,
  agent_display_name text,               -- 表示用キャッシュ

  -- === 架電情報 ===
  direction text not null default 'outbound', -- 'outbound' / 'inbound'
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int,
  day_of_week text,                      -- 曜日（FM互換: "(火)" 等）

  -- === 結果 ===
  result text,                           -- status_definitions.status_key を参照
                                         -- 例: "NG" / "留守" / "決め" / "アポOK" / "対象外"
  result_note text,                      -- 結果メモ
  rep_hit text,                          -- 代表ヒット（FM互換: "ヒット" or null）
  cl text,                               -- CL（FM互換）
  rep_level text,                        -- 代表レベル（FM互換: "3R" 等）
  rep_level2 text,
  appo_detail text,                      -- アポ情報詳細
  category text,                         -- 対応カテゴリ（FM互換: "受付拒否" / "即NG" 等）

  -- === 音声・文字起こし（Phase 3）===
  audio_r2_key text,                     -- Cloudflare R2のキー
  audio_url text,                        -- 一時URL（署名付き）

  -- === FM連携 ===
  fm_record_id text,                     -- 例: "TA0000150"（FMの対応履歴ID）
  fm_synced_at timestamptz,

  -- === カスタム項目 ===
  custom_data jsonb not null default '{}',

  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. ディール（deals = 受注・商談）
-- 1リードに最大1ディール（受注）が紐づく
-- 顧客LTVは customer_id 経由で集計
-- ============================================================

create table deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade, -- 高速JOIN用に冗長保持

  -- === 受注情報 ===
  stage text not null default 'ニーズ確認', -- 'ニーズ確認' / '提案済み' / '商談中' / '見積' / '受注' / '失注'
  amount int not null default 0,         -- 受注金額
  probability int,                       -- 受注確率（%）
  expected_close_date date,
  closed_at timestamptz,                 -- 受注確定日
  lost_reason text,

  -- === 商品・プラン情報 ===
  product_name text,                     -- 商材名（例: "クチコミ", "シンプル"）
  payment_method text,                   -- 決済方法（例: "Univ", "NSS"）
  initial_amount int,                    -- 初期費用
  monthly_amount int,                    -- 月額費用
  contract_months int,                   -- 契約月数
  contract_date date,                    -- 契約日
  start_date date,                       -- 開始日（予定）
  next_payment_date date,
  first_payment_date date,

  -- === 担当 ===
  assignee_id uuid references tenant_members(id),

  -- === カスタム項目 ===
  custom_data jsonb not null default '{}',

  -- === FM連携 ===
  fm_record_id text,
  fm_synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. 広告キャンペーン・クリエイティブ・広告費
-- ============================================================

create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  -- === 識別 ===
  external_id text,                      -- 媒体側のID（Meta: campaign_id等）
  platform text not null,                -- 'meta' / 'google' / 'other'
  name text not null,                    -- 表示名
  objective text,                        -- 'lead_gen' / 'conversion' / 'traffic' / 'awareness'

  -- === ステータス ===
  status text not null default 'active', -- 'active' / 'paused' / 'ended'
  started_at timestamptz,
  ended_at timestamptz,

  -- === 集計用キャッシュ（cron で更新）===
  total_spend bigint not null default 0,
  total_impressions bigint not null default 0,
  total_clicks bigint not null default 0,
  total_leads int not null default 0,

  -- === メタデータ ===
  metadata jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ad_creatives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,

  -- === 識別 ===
  external_id text,                      -- 媒体側のクリエイティブID
  name text not null,                    -- 例: "金額表示_ポップ_イラスト20250622~"

  -- === 内容 ===
  thumbnail_url text,                    -- サムネイル画像URL
  ad_format text,                        -- 'image' / 'video' / 'carousel' / 'text'

  -- === 集計キャッシュ ===
  total_spend bigint not null default 0,
  total_impressions bigint not null default 0,
  total_clicks bigint not null default 0,
  total_leads int not null default 0,

  -- === メタデータ（拡張可能）===
  metadata jsonb not null default '{}',
  -- 例: {"image_url":"...", "video_url":"...", "headline":"...", "body":"...", "cta":"..."}

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- leads テーブルへの広告FK制約を後付け追加
alter table leads add constraint leads_ad_campaign_id_fkey
  foreign key (ad_campaign_id) references ad_campaigns(id) on delete set null;
alter table leads add constraint leads_ad_creative_id_fkey
  foreign key (ad_creative_id) references ad_creatives(id) on delete set null;

create table ad_spend_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  creative_id uuid references ad_creatives(id) on delete set null,

  -- === 日次データ ===
  spend_date date not null,
  spend_amount bigint not null default 0,         -- 広告費（円）
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  reach bigint not null default 0,
  frequency float,                                 -- 表示頻度
  leads_count int not null default 0,              -- 当日獲得リード数

  -- === 動画系（適用時のみ）===
  video_views bigint default 0,
  installs bigint default 0,                       -- アプリインストール
  engagements bigint default 0,                    -- エンゲージメント

  -- === 計算済キャッシュ（参照用、プリセット指標）===
  cpc float,                                       -- spend / clicks
  cpm float,                                       -- spend / impressions * 1000
  ctr float,                                       -- clicks / impressions

  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(tenant_id, campaign_id, creative_id, spend_date)
);

-- Meta / 広告API 同期のカーソル（テナントごと最終同期日）
create table ad_sync_state (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  last_synced_date date not null,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 7. 文字起こし・ベクトル（AI学習基盤・3層保存）
-- ============================================================

create table call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references calls(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,

  full_text text,
  speaker_segments jsonb,                -- [{"speaker":"agent","start":0,"end":10,"text":"..."}]
  summary text,
  key_points jsonb,                      -- ["顧客は予算50万", "競合検討中"]
  sentiment text,                        -- 'positive' / 'neutral' / 'negative'

  whisper_status text not null default 'pending',     -- 'pending' / 'processing' / 'done' / 'failed'
  ai_analysis_status text not null default 'pending',
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table call_embeddings (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references calls(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,

  embedding vector(1536) not null,       -- OpenAI text-embedding-3-small
  chunk_index int not null default 0,
  chunk_text text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 8. AIエージェント関連
-- ============================================================

create table agent_instructions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  agent_type text not null,              -- 'lead_scorer' / 'call_time_optimizer' / etc
  target_type text not null,             -- 'lead' / 'call' / 'campaign' / 'pattern'
  target_id uuid,

  instruction text not null,             -- 自然言語の指示文
  instruction_data jsonb,                -- 構造化データ
  reasoning text,                        -- 判断理由
  confidence_score float,                -- 0.0 - 1.0

  status text not null default 'pending', -- 'pending' / 'approved' / 'rejected' / 'auto_executed'
  reviewed_by uuid references tenant_members(id),
  reviewed_at timestamptz,

  source_call_ids uuid[],
  created_at timestamptz not null default now()
);

create table agent_metrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  agent_type text not null,
  metric_date date not null default current_date,

  total_instructions int not null default 0,
  approved_count int not null default 0,
  rejected_count int not null default 0,
  auto_executed_count int not null default 0,
  accuracy_rate float,

  data_points_used int not null default 0,
  model_version text,

  custom_metrics jsonb not null default '{}',
  -- 例: {"avg_lead_score_accuracy": 0.82, "call_time_hit_rate": 0.71}

  created_at timestamptz not null default now()
);

create table agent_patterns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  discovered_by_agent text not null,     -- 'self_improver' 等

  -- === パターン内容 ===
  pattern_type text not null,            -- 'time_based' / 'industry_based' / 'script_based' / etc
  pattern_summary text not null,         -- 自然言語でのパターン説明
  pattern_data jsonb not null,           -- 構造化されたパターン条件

  -- === 効果指標 ===
  baseline_rate float,                   -- 元のアポ率等
  improved_rate float,                   -- パターン適用時のアポ率
  sample_size int not null,              -- データ件数

  -- === 採用状態 ===
  status text not null default 'proposed', -- 'proposed' / 'approved' / 'active' / 'archived'
  approved_by uuid references tenant_members(id),
  approved_at timestamptz,
  applied_to_agent text,                 -- どのエージェントに適用されたか

  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. マスタテーブル（動的拡張の核心）
-- ============================================================

-- ステータスマスタ
create table status_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  status_key text not null,              -- 'アポOK' / '採用OK' / etc
  label text not null,                   -- 表示名
  category text not null,                -- 'initial' / 'pending' / 'nurturing' / 'confirmed' / 'won_path' / 'won' / 'lost' / 'excluded' / 'legacy'
  order_index int not null default 0,
  color text,                            -- 表示色 #HEX

  is_completed boolean not null default false, -- 完了系か（未完了/完了の判定）
  is_won boolean not null default false,       -- 受注扱いか（ROI計算）
  is_excluded boolean not null default false,  -- 集計から除外するか
  is_system boolean not null default false,    -- システム標準（削除不可）

  -- 遷移可否（許可される次ステータス、空配列=どこへでも遷移可）
  allowed_next_statuses text[] default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, status_key)
);

-- 指標マスタ
create table metric_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  metric_key text not null,              -- 'lead_to_apo_rate' / 'cpa' / etc
  label text not null,                   -- 表示名
  category text not null,                -- 'count' / 'rate' / 'amount' / 'cost' / 'cohort'

  -- 計算式
  formula_type text not null,            -- 'preset' / 'sql' / 'jsonb_path'
  formula text not null,                 -- preset_keyまたはSQL式

  unit text,                             -- '%' / '円' / '件' / 'ms' / etc
  format_pattern text,                   -- '#,##0' / '#,##0.0%' etc

  display_order int not null default 0,
  is_visible boolean not null default true,
  is_system boolean not null default false, -- システム標準（削除不可・編集制限）

  -- メタデータ（描画用ヒント等）
  metadata jsonb not null default '{}',
  -- 例: {"color":"#0D9488", "bold":true, "section":"単価・受注"}

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, metric_key)
);

-- フィールドマッピング（FM連携用）
create table field_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  source_type text not null,             -- 'fm_list' / 'fm_calls' / 'meta_webhook' / etc
  source_field text not null,            -- 元データのフィールド名
  target_table text not null,            -- 'customers' / 'leads' / 'calls'
  target_field text not null,            -- ターゲットカラム名（custom_data.xxxも可）
  transform_type text,                   -- 'direct' / 'jsonb_path' / 'function'
  transform_function text,               -- 関数名（適用時のみ）

  is_required boolean not null default false,
  notes text,

  created_at timestamptz not null default now(),
  unique(tenant_id, source_type, source_field)
);

-- カスタムフィールド定義（将来CRMエディタ用・現フェーズ未使用）
create table tenant_schemas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  target_table text not null,            -- 'customers' / 'leads' / 'calls' / 'deals'
  field_definitions jsonb not null default '[]',
  -- 例: [{"key":"budget", "label":"予算", "type":"number", "required":false}]
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, target_table)
);

-- ユーザー個別設定（カラムトグル等）
create table user_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  member_id uuid not null references tenant_members(id) on delete cascade,

  visible_metrics jsonb not null default '[]',  -- ["lead_count","apo_rate",...]
  visible_columns jsonb not null default '{}',  -- {"leads":[...],"deals":[...]}
  filters jsonb not null default '{}',
  preferences jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id, member_id)
);

-- ============================================================
-- 10. FM同期系（Phase 1: 片方向、Phase 3: 双方向対応）
-- ============================================================

create table fm_sync_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  sync_direction text not null,          -- 'fm_to_supabase' / 'supabase_to_fm'
  sync_type text not null,               -- 'full' / 'delta' / 'manual' / 'webhook'
  target_layout text,                    -- 'リスト情報' / 'コール履歴' / 'ALL'

  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running', -- 'running' / 'success' / 'partial_failure' / 'failed'

  records_total int not null default 0,
  records_inserted int not null default 0,
  records_updated int not null default 0,
  records_skipped int not null default 0,
  records_failed int not null default 0,

  error_log jsonb,
  metadata jsonb not null default '{}',

  created_at timestamptz not null default now()
);

-- 双方向化用キュー（Phase 1では enabled=false で停止、Phase 3で有効化）
create table fm_sync_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,

  enabled boolean not null default false, -- Phase 3で true に切替
  direction text not null default 'supabase_to_fm',

  target_table text not null,             -- 'customers' / 'leads' / 'calls' / 'deals'
  target_record_id uuid not null,
  fm_record_id text,                       -- 既存FMレコードIDがある場合
  fm_layout text,
  operation text not null,                 -- 'create' / 'update' / 'delete'

  payload jsonb not null,                  -- 送信予定データ
  status text not null default 'queued',   -- 'queued' / 'processing' / 'success' / 'failed' / 'skipped_disabled'
  attempts int not null default 0,
  last_attempt_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ============================================================
-- 11. インデックス
-- ============================================================

-- customers
create index idx_customers_tenant on customers(tenant_id);
create index idx_customers_phone on customers(tenant_id, primary_phone);
create index idx_customers_code on customers(tenant_id, customer_code);
create index idx_customers_company on customers(tenant_id, company_name);
create index idx_customers_phones_jsonb on customers using gin (phone_numbers);
create index idx_customers_custom_data on customers using gin (custom_data);

-- leads
create index idx_leads_tenant on leads(tenant_id);
create index idx_leads_customer on leads(customer_id);
create index idx_leads_status on leads(tenant_id, status);
create index idx_leads_source on leads(tenant_id, source);
create index idx_leads_inquiry_at on leads(tenant_id, inquiry_at desc);
create index idx_leads_created on leads(tenant_id, created_at desc);
create index idx_leads_campaign on leads(ad_campaign_id);
create index idx_leads_creative on leads(ad_creative_id);
create index idx_leads_assigned on leads(tenant_id, assigned_to);
create index idx_leads_custom_data on leads using gin (custom_data);
create index idx_leads_status_history on leads using gin (status_history);

-- calls
create index idx_calls_tenant on calls(tenant_id);
create index idx_calls_lead on calls(lead_id);
create index idx_calls_customer on calls(customer_id);
create index idx_calls_started on calls(tenant_id, started_at desc);
create index idx_calls_result on calls(tenant_id, result);
create index idx_calls_agent on calls(tenant_id, agent_id);

-- deals
create index idx_deals_tenant on deals(tenant_id);
create index idx_deals_lead on deals(lead_id);
create index idx_deals_customer on deals(customer_id);
create index idx_deals_stage on deals(tenant_id, stage);
create index idx_deals_closed on deals(tenant_id, closed_at desc);

-- ad_*
create index idx_campaigns_tenant on ad_campaigns(tenant_id);
create index idx_campaigns_platform on ad_campaigns(tenant_id, platform);
-- PostgREST upsert(onConflict: tenant_id,external_id) に必須（external_id 無し行は除外）
create unique index ad_campaigns_tenant_external_idx
  on ad_campaigns(tenant_id, external_id)
  where external_id is not null;
create index idx_creatives_campaign on ad_creatives(campaign_id);
create index idx_spend_date on ad_spend_daily(tenant_id, spend_date desc);
create index idx_spend_campaign_date on ad_spend_daily(campaign_id, spend_date desc);
create index idx_spend_creative_date on ad_spend_daily(creative_id, spend_date desc);

-- AI
create index idx_transcripts_tenant on call_transcripts(tenant_id);
create index idx_embeddings_tenant on call_embeddings(tenant_id);
create index idx_embeddings_vector on call_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index idx_instructions_tenant on agent_instructions(tenant_id);
create index idx_instructions_status on agent_instructions(tenant_id, status);
create index idx_metrics_tenant_date on agent_metrics(tenant_id, metric_date desc);
create index idx_patterns_tenant on agent_patterns(tenant_id);
create index idx_patterns_status on agent_patterns(tenant_id, status);

-- マスタ
create index idx_status_def_tenant on status_definitions(tenant_id);
create index idx_metric_def_tenant on metric_definitions(tenant_id);
create index idx_field_map_tenant on field_mappings(tenant_id);

-- FM同期
create index idx_fm_sync_log_tenant on fm_sync_log(tenant_id, started_at desc);
create index idx_fm_sync_queue_status on fm_sync_queue(tenant_id, status, created_at);

-- ============================================================
-- 12. RLS（Row Level Security）
-- ============================================================

alter table tenants enable row level security;
alter table tenant_members enable row level security;
alter table customers enable row level security;
alter table leads enable row level security;
alter table calls enable row level security;
alter table deals enable row level security;
alter table ad_campaigns enable row level security;
alter table ad_creatives enable row level security;
alter table ad_spend_daily enable row level security;
alter table ad_sync_state enable row level security;
alter table call_transcripts enable row level security;
alter table call_embeddings enable row level security;
alter table agent_instructions enable row level security;
alter table agent_metrics enable row level security;
alter table agent_patterns enable row level security;
alter table status_definitions enable row level security;
alter table metric_definitions enable row level security;
alter table field_mappings enable row level security;
alter table tenant_schemas enable row level security;
alter table user_preferences enable row level security;
alter table fm_sync_log enable row level security;
alter table fm_sync_queue enable row level security;

create or replace function get_current_tenant_id()
returns uuid language sql stable as $$
  select tenant_id from tenant_members
  where clerk_user_id = auth.jwt() ->> 'sub' limit 1;
$$;

-- すべてのテナント分離テーブルに統一ポリシー適用
create policy "tenant_isolation" on customers using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on leads using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on calls using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on deals using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on ad_campaigns using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on ad_creatives using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on ad_spend_daily using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on ad_sync_state using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on call_transcripts using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on call_embeddings using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on agent_instructions using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on agent_metrics using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on agent_patterns using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on status_definitions using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on metric_definitions using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on field_mappings using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on tenant_schemas using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on user_preferences using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on fm_sync_log using (tenant_id = get_current_tenant_id());
create policy "tenant_isolation" on fm_sync_queue using (tenant_id = get_current_tenant_id());

-- ============================================================
-- 13. トリガー（核心ロジック）
-- ============================================================

-- 13.1 calls INSERT時に leads.status を自動昇格
create or replace function trg_promote_lead_status_from_call()
returns trigger language plpgsql as $$
declare
  v_lead leads%rowtype;
  v_status_def status_definitions%rowtype;
begin
  -- ロックされていない場合のみ昇格
  select * into v_lead from leads where id = new.lead_id;
  if v_lead.status_locked_at is not null then
    return new;
  end if;

  -- result が status_definitions に存在する場合のみ昇格
  if new.result is not null then
    select * into v_status_def from status_definitions
      where tenant_id = new.tenant_id and status_key = new.result;

    if found then
      update leads set
        status = new.result,
        status_history = status_history || jsonb_build_object(
          'status', new.result,
          'at', new.started_at,
          'by', 'call:' || new.id::text,
          'agent_id', new.agent_id
        ),
        last_call_at = new.started_at,
        total_call_count = total_call_count + 1,
        first_call_at = coalesce(first_call_at, new.started_at),
        updated_at = now()
      where id = new.lead_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger calls_after_insert
after insert on calls
for each row execute function trg_promote_lead_status_from_call();

-- 13.2 leads UPDATE時に customers の集計を更新
create or replace function trg_update_customer_aggregates()
returns trigger language plpgsql as $$
begin
  update customers set
    last_contacted_at = greatest(coalesce(last_contacted_at, '1970-01-01'::timestamptz), coalesce(new.last_call_at, last_contacted_at)),
    first_contacted_at = least(coalesce(first_contacted_at, '9999-12-31'::timestamptz), coalesce(new.first_call_at, first_contacted_at)),
    updated_at = now()
  where id = new.customer_id;

  return new;
end;
$$;

create trigger leads_after_update
after update on leads
for each row when (old.last_call_at is distinct from new.last_call_at)
execute function trg_update_customer_aggregates();

-- 13.3 deals INSERT/UPDATE時に leads.has_deal と customer集計を更新
create or replace function trg_update_deal_summary()
returns trigger language plpgsql as $$
begin
  -- リード側を更新
  if new.stage = '受注' then
    update leads set
      has_deal = true,
      deal_amount = new.amount,
      deal_closed_at = new.closed_at,
      updated_at = now()
    where id = new.lead_id;
  elsif new.stage = '失注' then
    update leads set
      has_deal = false,
      lost_reason = new.lost_reason,
      updated_at = now()
    where id = new.lead_id;
  end if;

  -- 顧客集計を更新
  update customers set
    total_deal_count = (select count(*) from deals where customer_id = new.customer_id and stage = '受注'),
    total_deal_amount = (select coalesce(sum(amount), 0) from deals where customer_id = new.customer_id and stage = '受注'),
    updated_at = now()
  where id = new.customer_id;

  return new;
end;
$$;

create trigger deals_after_change
after insert or update on deals
for each row execute function trg_update_deal_summary();

-- 13.4 leads INSERT時に customers.total_lead_count を更新
create or replace function trg_increment_customer_lead_count()
returns trigger language plpgsql as $$
begin
  update customers set
    total_lead_count = total_lead_count + 1,
    updated_at = now()
  where id = new.customer_id;
  return new;
end;
$$;

create trigger leads_after_insert
after insert on leads
for each row execute function trg_increment_customer_lead_count();

-- 13.5 updated_at の自動更新
create or replace function trg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at before update on customers
for each row execute function trg_set_updated_at();
create trigger leads_set_updated_at before update on leads
for each row execute function trg_set_updated_at();
create trigger deals_set_updated_at before update on deals
for each row execute function trg_set_updated_at();
create trigger campaigns_set_updated_at before update on ad_campaigns
for each row execute function trg_set_updated_at();
create trigger creatives_set_updated_at before update on ad_creatives
for each row execute function trg_set_updated_at();
create trigger statusdef_set_updated_at before update on status_definitions
for each row execute function trg_set_updated_at();
create trigger metricdef_set_updated_at before update on metric_definitions
for each row execute function trg_set_updated_at();

-- ============================================================
-- 14. RPC関数（型安全な集計用）
-- ============================================================

-- 14.1 テナントKPI取得
create or replace function get_tenant_kpi(
  p_tenant_id uuid default get_current_tenant_id(),
  p_period_start date default current_date - interval '30 days',
  p_period_end date default current_date
)
returns jsonb language plpgsql stable as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'lead_count',     (select count(*) from leads where tenant_id = p_tenant_id and inquiry_at::date between p_period_start and p_period_end),
    'call_count',     (select count(*) from calls where tenant_id = p_tenant_id and started_at::date between p_period_start and p_period_end),
    'apo_count',      (select count(*) from leads where tenant_id = p_tenant_id and status = 'アポOK' and inquiry_at::date between p_period_start and p_period_end),
    'won_count',      (select count(*) from deals where tenant_id = p_tenant_id and stage = '受注' and closed_at::date between p_period_start and p_period_end),
    'won_amount',     (select coalesce(sum(amount),0) from deals where tenant_id = p_tenant_id and stage = '受注' and closed_at::date between p_period_start and p_period_end),
    'ad_spend',       (select coalesce(sum(spend_amount),0) from ad_spend_daily where tenant_id = p_tenant_id and spend_date between p_period_start and p_period_end)
  ) into v_result;
  return v_result;
end;
$$;

-- 14.2 広告ROI取得（媒体×クリエイティブ別）はマイグレーションまたはリモートDB参照。
-- 広告セット日次: supabase/migrations/20260428120000_ad_sets_daily_spend.sql の get_ad_roi_adset_daily を参照。