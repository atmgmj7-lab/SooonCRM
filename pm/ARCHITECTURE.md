# ARCHITECTURE.md — システム設計図

最終更新: 2026-05-11

---

## システム全体のデータフロー

```
【リード獲得】
Meta/Google 広告 ──────────────────────────────────────────┐
                                                            │
  ① リアルタイム受信（Webhook）                              │
     Meta がイベントを PUSH                                  │
     → /api/webhooks/meta                                  │
        ↓ 電話番号正規化 + 名寄せ                             │
        ↓ list_records に INSERT                            ├→ Sooon-CRM（Supabase）
        ↓ leads に INSERT                                   │
        ↓ FM 電話番号チェック                                │
           ├─ 未登録 → FM 新規リスト作成                     │
           └─ 既存   → fm_record_id をリンク（重複なし）     │
                                                            │
  ② 能動取得（Graph API Pull）                               │
     /api/admin/pull-meta-leads                            │
     Meta Ads API → リード一覧取得 → 上記と同じ処理          │

【FM→CRM 同期（毎日 JST 0:00）】
FileMaker ──→ GitHub Actions cron ──→ scripts/sync-list-bulk.ts
             syncListRecords()     ──→ list_records（upsert）
             syncCalls()           ──→ calls（upsert）
                                       ↓ DB トリガー自動発火
                                       ↓ list_records.last_call_result 更新
                                       ↓ list_records.last_call_at 更新

【FM Webhook（リアルタイム更新）】
FileMaker ──→ /api/webhooks/filemaker
              ├─ record_type: list_update → list_records を更新
              └─ record_type: call_update → calls を upsert
                                            ↓ DB トリガー自動発火
```

---

## フォルダ構成（主要ファイル）

```
Sooon-CRM/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # 画面
│   │   │   ├── list/             # リスト情報
│   │   │   ├── leads/            # リード一覧・詳細
│   │   │   │   └── inbox/        # 受信リード（Meta webhook）
│   │   │   ├── calls/            # コール履歴
│   │   │   ├── analytics/        # 分析画面
│   │   │   ├── ads/              # 広告マネージャー
│   │   │   └── admin/sync/       # 手動差分同期UI
│   │   └── api/
│   │       ├── webhooks/
│   │       │   ├── meta/         # Meta広告リード受信
│   │       │   └── filemaker/    # FM更新通知受信
│   │       ├── admin/
│   │       │   ├── backfill-fm-push/   # FM未同期リードを一括プッシュ
│   │       │   ├── pull-meta-leads/    # Meta API からリードを能動取得
│   │       │   ├── sync-from-fm/       # FM→CRM リスト差分同期
│   │       │   ├── sync-calls/         # FM→CRM コール履歴差分同期
│   │       │   └── import-leads/       # CSV インポート
│   │       ├── list-records/     # リスト一覧 API
│   │       └── leads/            # リード API
│   └── lib/
│       ├── filemaker/
│       │   ├── client.ts         # FM Data API クライアント（Claris ID認証）
│       │   ├── sync.ts           # FM delta sync ロジック
│       │   └── mappers.ts        # FM フィールド名 → Supabase カラム変換
│       └── meta/
│           ├── client.ts         # Meta Graph API（広告インサイト用）
│           └── sync-service.ts   # 広告データ同期
├── supabase/
│   └── migrations/               # DB スキーマ変更履歴
├── scripts/
│   ├── run-full-sync.ts          # FM フルシンク（手動実行用）
│   └── import-from-fm.ts        # FM→CRM インポートスクリプト
├── .github/workflows/
│   └── sync-fm.yml               # 毎日 JST 0:00 に FM 同期
└── pm/                           # プロジェクト管理ファイル（このフォルダ）
```

---

## データベース主要テーブル

| テーブル | 役割 |
|---------|------|
| `list_records` | 顧客リスト（FM の「リスト」に対応） |
| `leads` | リード（問い合わせ1件 = 1行） |
| `calls` | コール履歴 |
| `webhook_leads` | Meta/Google webhook の生データ保管 |
| `ad_campaigns` | 広告キャンペーン |
| `ad_spend_daily` | 広告費日次データ |

---

## 認証

- **ユーザー認証**: Clerk（Organizations対応）
- **FM認証**: Claris ID（AWS Cognito SRP → FMID セッション）
- **Meta認証**: Long-lived Access Token（.env.local の `META_ACCESS_TOKEN`）

---

## 環境変数一覧

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DEFAULT_TENANT_ID

# FileMaker
FM_HOST
FM_DATABASE
FM_USERNAME
FM_PASSWORD
FM_REFRESH_TOKEN
FM_LAYOUT_LIST
FM_LAYOUT_CALLS

# Meta Ads
META_ACCESS_TOKEN
META_AD_ACCOUNT_ID
META_WEBHOOK_VERIFY_TOKEN   = sooon_meta_verify_2026

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```
