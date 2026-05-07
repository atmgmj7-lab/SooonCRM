# DB フィールド監査 — list_records / leads / calls / deals / webhook_leads

調査日: 2026-05-06  
対象: `supabase/migrations/*.sql`（全28ファイル）、`src/types/supabase.ts`（生成型）、`src/components/**`、`src/lib/**`、`src/app/api/**` の参照検索。

> **注意**: `src/types/supabase.ts` は自動生成のため、直近マイグレーション（アポ内訳・HUB同期など）より古い場合、実DBには列があるが型に無い列を本文で明示しています。実DBの真値は `supabase db dump` またはダッシュボードで確認してください。

---

## データ入力源の凡例

| 記号 | 意味 |
|------|------|
| **FM** | FileMaker Data API / `fm/webhook` / バッチ `lib/filemaker/sync.ts` / `mapFM*` |
| **Meta** | Meta Lead Ads Webhook `api/webhooks/meta` |
| **手動** | CRM UI の PATCH または `MANUAL_LEAD_FIELDS` 経由の API |
| **移行SQL** | 一度きりの `20260503000000_leads_migration.sql` 等（現行コードからは書き込みなし） |
| **トリガー** | PostgreSQL トリガー（`update_last_call_info` / `fn_update_inquiry_stats` / `trg_sync_lead_status` / HUB同期 等） |
| **CSV/API** | `admin/import-leads`、その他スクリプト |

---

## 1. `list_records`

**役割**: FM「リスト」相当の顧客1行HUB。Meta新規は `fm_record_id` が無い行も歴史的に存在し得る。`leads` は `list_record_id` で複数紐づき。

**主要FK（生成型・マイグレーションより）**: `tenant_id` → `tenants`；`webhook_lead_id` → `webhook_leads`；`selected_lead_id` → `leads`（マイグレーション）。

| カラム | 型（生成型/マイグレーション） | UI（表示/編集） | 主な入力元 | FK等 | 備考 |
|--------|------------------------------|-----------------|------------|------|------|
| `id` | uuid | 一覧・詳細（内部） | DB default | PK | — |
| `tenant_id` | uuid | 間接のみ | 全経路 | → `tenants` | — |
| `fm_record_id` | text | 詳細（readonly的） | FM | UNIQUE（マイグレーション） | Meta行は null の期間あり |
| `fm_modification_id` | text | 非表示 | FM | — | 差分同期用 |
| `customer_id` | text | 一覧・詳細ヘッダ | FM / Meta採番RPC | — | `leads.customer_id`(uuid) とは別物 |
| `ad_name` | text | 一覧・詳細 | FM / Meta | — | |
| `list_handover_date` | date / string | ヘッダ | FM | — | |
| `list_name` | text | ヘッダ | FM | — | |
| `industry` | text | ヘッダ・編集可能 | FM / 手動 | — | |
| `newcomer_flag` | text | 非表示（list側は列あり） | FM | — | 編集UIは主に `leads.newcomer_flag` |
| `list_created_at` | timestamptz | ヘッダ | FM | — | |
| `company_name` | text | 一覧・詳細 | FM / Meta / 手動 | — | 一覧APIは not null フィルタ |
| `representative_name` | text | 一覧・詳細 | FM / Meta / 手動 | — | |
| `title` | text | 一覧 | FM / 手動 | — | |
| `regular_holidays` | jsonb | 主要フォームに未接続の可能性 | FM | — | 配列 |
| `prefecture` | text | 一覧・詳細 | FM / Meta / 手動 | — | |
| `phone_numbers` | jsonb | 詳細・編集 | FM / Meta / 手動 | GIN index | 文字列配列 |
| `company_email` | text | 詳細・編集 | FM / 手動 | — | |
| `business_start_time` | text | 詳細・編集 | FM / 手動 | — | |
| `business_end_time` | text | 詳細・編集 | FM / 手動 | — | |
| `homepage_exists` | text | 詳細・編集 | FM / 手動 | — | |
| `address` | text | 詳細・編集 | FM / 手動 | — | |
| `recall_date` | date | 詳細・編集 | FM / 手動 | — | |
| `recall_time` | text | 詳細・編集 | FM / 手動 | — | |
| `list_screening` | text | **型のみ**（主要UI未確認） | FM | — | `TO_FM` にマップあり（PATCH） |
| `homepage_url` | text | 詳細・編集 | FM / 手動 | — | |
| `meo_status` | jsonb | **型のみ**（インライン編集は未確認） | FM | — | |
| `case_memo` | text | メモ欄 | FM / 手動 | — | `MemoArea` |
| `meeting_date` | date | 詳細・編集 | FM / 手動 | — | |
| `meeting_time` | text | 詳細・編集 | FM / 手動 | — | |
| `zoom_url` | text | 詳細・編集 | FM / 手動 | — | |
| `pre_setup_date` | date | **型のみ** | FM | — | |
| `pre_setup_agent` | text | **型のみ** | FM | — | |
| `sales_agent` | text | **型のみ** | FM | — | |
| `source` | text | 間接 | FM / Meta | — | |
| `source_data` | jsonb | **型のみ**（画面は `leads.source_data` 優先） | FM default / Meta歴史 | — | |
| `webhook_lead_id` | uuid | 非表示 | Meta / 照合 | → `webhook_leads` | |
| `status` | text | 一覧・フィルタ | FM / 手動 / トリガー連鎖 | — | `last_call_result` と役割近い |
| `temperature` | text | **型のみ** | 不明・レガシー | — | DB_SCHEMA 由来の可能性 |
| `temperature_reason` | text | **型のみ** | 不明 | — | |
| `priority_score` | number | **型のみ** | 不明 | — | |
| `assigned_to` | uuid | **型のみ** | 不明 | — | `tenant_members` 想定だが生成型にFKなし |
| `lost_reason` | text | **型のみ** | FM? | — | |
| `deal_amount` | number | **型のみ** | FM? | — | `leads.deal_amount` と重複概念 |
| `deal_closed_at` | timestamptz | **型のみ** | FM? | — | |
| `last_call_date` | date | **集計キャッシュ** | **トリガー** `update_last_call_info` | — | `calls` から |
| `last_call_start_time` | text | **型のみ** | トリガー | — | |
| `last_call_end_time` | text | **型のみ** | トリガー | — | |
| `last_call_agent` | text | **型のみ** | トリガー | — | |
| `last_call_result` | text | 一覧・フィルタ | **トリガー** `sync_call_result_to_list_record`（calls） / 旧来の `update_last_call_info` と併存注意 | — | **二系統で更新されうる** |
| `last_call_category` | text | **型のみ** | トリガー | — | |
| `last_call_count` | int | 一覧・API readonly | トリガー | — | PATCH readonly |
| `last_call_list_name` | text | **型のみ** | トリガー | — | |
| `last_call_rep_level` | text | **型のみ** | トリガー | — | |
| `last_call_rep_level2` | text | **型のみ** | トリガー | — | |
| `last_call_appo_detail` | text | **型のみ** | トリガー | — | |
| `inquiry_count` | int | 一覧 | **トリガー** `fn_update_inquiry_stats` | — | |
| `last_inquiry_at` | timestamptz | 一覧 | 同上 | — | |
| `last_inquiry_ad_name` | text | 一覧 | 同上 | — | |
| `chosei` | boolean | 詳細（アポ内訳バッジ） | **トリガー** / `PATCH list-records/.../appo-detail` | — | **生成型未反映の可能性** |
| `saiyo_ok` | boolean | 同上 | 同上 | — | 同上 |
| `saiyo_ng` | boolean | 同上 | 同上 | — | 同上 |
| `juchu` | boolean | 同上 | 同上 | — | 同上 |
| `selected_lead_id` | uuid | 詳細（リード選択） | 手動 `api/list-records/[id]/selected-lead` | → `leads` | **生成型未反映の可能性** |
| `custom_data` | jsonb | **型のみ** | 拡張用 | — | |
| `created_at` | timestamptz | 一覧ソート | DB | — | |
| `updated_at` | timestamptz | **型のみ** | 手動・トリガー | — | |

---

## 2. `leads`

**役割**: 問い合わせ（広告流入）1件。同一 `list_record` に複数可。

**FK（生成型）**: `tenant_id`→`tenants`；`ad_campaign_id`→`ad_campaigns`；`ad_creative_id`→`ad_creatives`；`assigned_to`/`status_locked_by`→`tenant_members`；`webhook_lead_id`→`webhook_leads`。  
**注意**: `list_record_id` はマイグレーションで `customers` FK が外れ、**生成型 Relationships に list_records へのFK記載なし**。

| カラム | 型（生成型） | UI | 主な入力元 | FK | 備考 |
|--------|-------------|-----|-----------|-----|------|
| `id` | uuid | 全画面 | DB | PK | — |
| `tenant_id` | uuid | 間接 | 全経路 | → `tenants` | — |
| `customer_id` | uuid \| null | 間接 | Meta / 移行 | → `customers`（意図的に NULL 可） | `list_records.customer_id`(text) と型不一致 |
| `list_record_id` | uuid \| null | リード一覧・リンク | Meta / 手動 / 電話照合 | （FKなし） | |
| `webhook_lead_id` | uuid \| null | 非表示 | Meta | → `webhook_leads` | |
| `inquiry_at` | timestamptz | 詳細・集計 | Meta / 手動 / FM legacy | — | 必須 |
| `inquiry_date` | date \| null | 一覧・詳細 | Meta / CSV / FM | — | |
| `list_created_at` | timestamptz \| null | **型のみ**（集計補完用） | FM Webhook legacy / マイグレーション | — | |
| `source` | text | 間接 | Meta / FM / import | — | |
| `source_data` | jsonb | 詳細（フォーム回答） | Meta（`form_answers`） | — | |
| `ad_name` | text | 一覧・詳細・アナリティクス | Meta / FM / CSV | — | |
| `adset_id` | text | **型のみ**主 | Meta | — | |
| `ad_campaign_id` | uuid \| null | **型のみ** | 媒体連携 | → `ad_campaigns` | |
| `ad_creative_id` | uuid \| null | **型のみ** | 媒体連携 | → `ad_creatives` | |
| `company_name` | text | 一覧・詳細 | Meta / CSV | — | |
| `representative_name` | text | 同上 | 同上 | — | |
| `rep_title` | text | **型のみ**主 | CSV | — | |
| `prefecture` | text | 一覧 | Meta / CSV | — | |
| `city` | text | **型のみ** | CSV? | — | |
| `phone_number` | text | 一覧 | Meta / CSV | — | |
| `email_address` | text | **型のみ** | CSV / Meta | — | |
| `lead_detail` | text | **型のみ** | CSV | — | |
| `form_q1`–`form_q4` | text | **型のみ** | CSV | — | |
| `inquiry_content` | text | **型のみ** | DB_SCHEMA | — | |
| `status` | text | 一覧・`StatusSelect` | 手動 / **トリガー** calls→leads | — | `trg_sync_lead_status` |
| `last_call_result` | text | 一覧・詳細 | 手動 / **トリガー** | — | calls と二重管理 |
| `newcomer_flag` | text | 詳細（新人フラグ） | 手動 PATCH | — | **生成型未反映の可能性**（マイグレーションで追加） |
| `appo_detail_status` | text | 詳細・アナリティクス | 手動 / **トリガー** list→lead | — | **生成型未反映の可能性** |
| `appo_date` | date | 詳細 | 手動 | — | **生成型未反映** |
| `appo_time` | text | 詳細 | 手動 | — | **生成型未反映** |
| `appo_detail` | text | 詳細 | 手動 | — | **生成型未反映** |
| `appo_at` | timestamptz \| null | **API要約** `leads GET` | 不明 | — | UIでは未使用気味 |
| `jitsuyo_ok` | boolean | 詳細・一覧バッジ | 手動 / CSV | — | |
| `ichiyou_ng` | boolean | **型のみ**主 | CSV | — | |
| `order_closed` | boolean | 詳細・一覧 | 手動 | — | |
| `adjusting` | boolean \| null | アナリティクス | 不明 | — | |
| `initial_fee` | string \| null | アナリティクス（文字列型） | CSV / 手動 | — | マイグレーション当初 integer → 現状 string |
| `monthly_fee` | string \| null | 同上 | 同上 | — | |
| `contract_months` | string \| null | **型のみ** | CSV | — | |
| `total_revenue` | string \| null | 詳細・履歴 | CSV / 手動 | — | |
| `deal_amount` | number \| null | ダッシュボード・アナリティクス | FM legacy / 手動 | — | `has_deal` とセットで整理余地 |
| `deal_closed_at` | timestamptz \| null | **型のみ** | — | — | |
| `lost_reason` | text \| null | **型のみ** | — | — | |
| `has_deal` | boolean | **型のみ** | DB_SCHEMA / 更新ロジック要確認 | — | |
| `call_count` | string \| null | API summary | CSV / 手動 | — | **integer から string へスキーム漂流** |
| `total_call_count` | number | **型のみ** | — | — | |
| `first_call_at` | timestamptz \| null | **型のみ** | — | — | |
| `last_call_at` | timestamptz \| null | **型のみ** | — | — | |
| `recall_date` | date \| null | **MANUAL** | 手動 | — | |
| `recall_time` | text \| null | **MANUAL** | 手動 | — | |
| `list_handover_date` | date \| null | **型のみ** | FM | — | |
| `completion_progress` | text \| null | **型のみ** | CSV | — | |
| `imported_from_csv` | boolean \| null | **型のみ** | CSV | — | |
| `csv_row_number` | number \| null | **型のみ** | CSV | — | |
| `fm_record_id` | text \| null | 間接 | FM push / Webhook | UNIQUE (tenant, fm) partial | |
| `fm_synced_at` | timestamptz \| null | **型のみ** | FM | — | |
| `assigned_to` | uuid \| null | **型のみ** | — | → `tenant_members` | |
| `status_locked_at` | timestamptz \| null | **型のみ** | — | — | |
| `status_locked_by` | uuid \| null | **型のみ** | — | → `tenant_members` | |
| `status_history` | jsonb | **型のみ** | — | — | |
| `temperature` | text | **型のみ** | デフォルト 'cold' | — | |
| `temperature_reason` | text \| null | **型のみ** | — | — | |
| `priority_score` | number | **型のみ** | デフォルト 0 | — | |
| `inquiry_date_1` | string \| null | **型のみ** | 不明 | — | 重複疑い |
| `inquiry_datetime_raw` | string \| null | **型のみ** | 不明 | — | |
| `custom_data` | jsonb | **型のみ** | 拡張 | — | |
| `created_at` | timestamptz | 詳細ソート | DB | — | |
| `updated_at` | timestamptz | **型のみ** | 手動・トリガー | — | |

---

## 3. `calls`

**役割**: FM「コール履歴」。`list_record_id` 必須。`lead_id` は生成型・画面で使用（アポ内訳コンポーネント）→ **マイグレーション初期CREATEには無く、別途追加されたかリモート先行の可能性**。

**FK（生成型）**: `tenant_id`；`list_record_id`→`list_records`；`lead_id`→`leads`；`agent_id`→`tenant_members`。

| カラム | 型 | UI | 主な入力元 | FK | 備考 |
|--------|-----|-----|-----------|-----|------|
| `id` | uuid | 間接 | DB | PK | — |
| `tenant_id` | uuid | 間接 | 全経路 | → `tenants` | |
| `list_record_id` | uuid | コール一覧（join） | FM / `POST api/calls` | → `list_records` | |
| `lead_id` | uuid \| null | `HistoryTabs` `AppoStatusSelect` | **要確認** / 手動? | → `leads` | FMマッパに無い |
| `agent_id` | uuid \| null | **型のみ**主 | — | → `tenant_members` | |
| `agent_name` | text | コール一覧・詳細 | FM / 手動POST | — | |
| `call_date` | date | 一覧・詳細 | FM / 手動 | — | |
| `call_start_time` | text | 同上 | FM / 手動 | — | |
| `call_end_date` | date \| null | **型のみ** | FM? | — | 初期CREATEにあったがマッパは end_time のみ |
| `call_end_time` | text \| null | 同上 | FM | — | |
| `call_number` | int | **型のみ** | FM default | — | |
| `call_result` | text | 一覧・詳細 | FM / 手動 | — | **トリガー**で `leads`/`list_records` へ |
| `call_category` | text | 一覧・詳細 | FM | — | |
| `reissue_pending` | text \| null | **型のみ** | FM | — | |
| `list_name` | text \| null | **型のみ** | FM | — | |
| `rep_level` | text \| null | コール一覧 | FM | — | |
| `rep_level2` | text \| null | **型のみ** | FM | — | |
| `ci` | text \| null | **型のみ** | FM（CL） | — | |
| `appo_detail` | text \| null | 一覧・詳細 | FM | — | |
| `call_duration_minutes` | float \| null | 詳細 | FM | — | |
| `call_duration_seconds` | float \| null | **型のみ** | FM | — | |
| `direction` | text | **型のみ** | default outbound | — | |
| `audio_r2_key` | text \| null | **型のみ** | Phase3 | — | |
| `custom_data` | jsonb | **型のみ** | — | — | |
| `fm_record_id` | text \| null | 非表示 | FM | UNIQUE | |
| `fm_modification_id` | text \| null | 非表示 | FM | — | |
| `claris_id` | text \| null | **型のみ** | FM | — | |
| `rep_hit` | text \| null | **型のみ** | FM | — | |
| `hidden_flag` | text \| null | **型のみ** | FM | — | |
| `list_source` | text \| null | **型のみ** | FM | — | |
| `call_history_id` | text \| null | **型のみ** | FM | — | |
| `inquiry_date` | date \| null | **型のみ** | FM | — | |
| `called_at` | timestamptz \| null | **型のみ** | 不明 | — | 生成型にあるがマイグレーション初期に無い |
| `duration_seconds` | number \| null | **型のみ** | 不明 | — | **call_duration_seconds と重複疑い** |
| `newcomer_flag` | text | 詳細コール表 | FM / **マイグレーション** | — | **生成型 Row に未反映の可能性** |
| `created_at` | timestamptz | ソート | DB | — | |

---

## 4. `deals`

**役割**: 商談・受注（DB_SCHEMA上は `leads` に紐づく）。

**FK**: `tenant_id`；`lead_id`→`leads`；`customer_id`→`customers`；`assignee_id`→`tenant_members`。

| カラム | 型 | UI | 主な入力元 | 備考 |
|--------|-----|-----|-----------|------|
| 全列 | int/text/jsonb… | **`/deals` はプレースホルダ** | **`api/deals` は TODO** | **現行CRM UI・API から実質未使用** |
| `lead_id` | uuid | — | 設計上 FM/将来 | アナリティクスは `leads.deal_amount` 等を直接使用 |
| `customer_id` | uuid | — | 同上 | |
| `amount` | number | — | — | |
| `stage` | text | — | — | |
| … | … | — | — | RPC `get_ad_roi*` は `deals` をJOINで使用（マイグレーション内SQL） |

---

## 5. `webhook_leads`

**役割**: Meta生DTOの受け皿。`list_records` / `leads` 作成後に `status` 更新。

**FK**: `tenant_id`→`tenants`（`added_to_list_id` にFKなし）。

| カラム | 型 | UI | 主な入力元 | 備考 |
|--------|-----|-----|-----------|------|
| `id` | uuid | 非表示 | DB | |
| `tenant_id` | uuid | 非表示 | Meta route | |
| `raw_data` | jsonb | **型のみ** | Meta | |
| `mapped_data` | jsonb | **型のみ** | default {} | **未使用気味** |
| `source` | text | 非表示 | `meta_ads` | |
| `ad_name` | text | **型のみ** | Meta | |
| `status` | text | **一覧 `/list` ベル**（pending count） | Meta flow | `pending`→`added` |
| `added_to_list_id` | uuid \| null | 非表示 | Meta | FKなし |
| `added_at` | timestamptz \| null | 非表示 | Meta | |
| `received_at` | timestamptz | 非表示 | DB default | |
| `created_at` | timestamptz | 非表示 | DB | |
| `phone_normalized` |text \| null | 照合ロジック | **FM系マイグレーション**/正規化 | |
| `fm_record_id` | text \| null | 非表示 | **list sync** が追記 | **生成型未反映の可能性** |
| `fm_synced_at` | timestamptz \| null | 非表示 | sync | **生成型未反映** |
| `match_status` | text | rematch API | Meta / 照合 | default `pending`、**生成型にある** |

---

## 重複・矛盾・整理候補

1. **`last_call_result` の二重管理**  
   - `list_records.last_call_result`: トリガー `sync_call_result_to_list_record`（`calls.call_result`）と、従来の `update_last_call_info` の両方が履歴上存在。どちらが最終的に勝つか・NULL 時の挙動は運用確認が必要。

2. **`leads.status` と `calls.call_result` と `leads.last_call_result`**  
   - `trg_sync_lead_status` は `call_result` を `leads.status` / `leads.last_call_result` にコピー。UI は `status` を主表示。三者の意味差（ステータスマスタ vs 生コール結果）をドキュメント化した方が良い。

3. **`list_records` のアポ内訳フラグ vs `leads.appo_detail_status`**  
   - `chosei`/`saiyo_*`/`juchu` は `leads.appo_detail_status` からトリガー同期。`PATCH appo-detail` は `list_records` だけ更新し、逆方向トリガーで `leads` 更新。双方向同期の順序・競合に注意。

4. **顧客IDの型二重**  
   - `list_records.customer_id` は **text**（FMの顧客ID）。`leads.customer_id` は **uuid**（`customers` テーブル）。名前は同じだが別概念。

5. **スキーマ漂流（leads）**  
   - `call_count` / `initial_fee` / `monthly_fee` / `contract_months` / `total_revenue`: マイグレーション上はintegerだった列が、生成型では `string` になっている。表示・集計バグの温床。

6. **`calls` の時間系**  
   - `call_duration_minutes` と `call_duration_seconds` と `duration_seconds`（生成型）の役割分担が不明瞭。

7. **`deals` テーブル**  
   - スキーマと RPC は存在するが、**UI・REST が未実装**。受注金額は `leads.deal_amount` や RPC内の `deals` が混在。単一方針（どちらをマスタにするか）が必要。

8. **`src/types/supabase.ts` の陳腐化**  
   - `selected_lead_id` / `chosei` 系 / `leads.appo_*` / `calls.newcomer_flag` / `webhook_leads.fm_*` がマイグレーションより遅れている可能性。**`supabase gen types` の再実行推奨**。

9. **`leads.inquiry_date` と `inquiry_at`**  
   - 一覧・フィルタは両方使用。Metaは主に `inquiry_at`。意味の整理（日付のみ vs タイムスタンプ）が必要。

10. **`mapped_data`（webhook_leads）**  
    - 常に default のままなら、将来使う前提か削除不可ルール下では「reserved」と明記するのみ。

11. **テナントIDのハードコード**  
    - `fm/webhook`、`dashboard/page.tsx`、`leads_migration` 等に特定 `tenant_id` が埋め込み。マルチテナント拡張時はリスク。

---

## 調査ファイル参照（抜粋）

| 種別 | パス |
|------|------|
| FMマッピング | `src/lib/filemaker/mappers.ts` |
| list PATCH readonly | `src/app/api/list-records/[id]/route.ts` |
| Meta 取り込み | `src/app/api/webhooks/meta/route.ts` |
| 手動リード更新許可列 | `src/types/leads.ts`、`MANUAL_LEAD_FIELDS` |
| トリガー定義 | `supabase/migrations/20260430000000_fm_sync_schema.sql`, `20260503000000_leads_migration.sql`, `20260509000000_add_newcomer_flag.sql`, `20260509030000_add_appo_columns.sql`, `20260509040000_hub_sync_triggers.sql` |
