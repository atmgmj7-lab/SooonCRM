# FileMaker → AI CRM OS 同期スクリプト仕様書

## エンドポイント

```
POST https://sooon-crm.vercel.app/api/fm/webhook
```

## 認証ヘッダー

```
x-fm-secret: [FM_WEBHOOK_SECRETの値]
Content-Type: application/json
```

> **重要**: FM_WEBHOOK_SECRET の値は `.env.local` および Vercel 環境変数に設定済みのものを使用してください。

---

## FMスクリプト「Push To Web CRM」実装手順

### トリガー設定

| 項目         | 設定値               |
|------------|---------------------|
| スクリプトトリガー | OnRecordCommit      |
| 対象レイアウト  | リスト情報（または架電管理） |

### スクリプト本体（FileMaker Script Workspace）

```
# ── Push To Web CRM ──────────────────────────────────────────────
Set Variable [ $url ; Value: "https://sooon-crm.vercel.app/api/fm/webhook" ]

# ── JSONペイロード構築 ────────────────────────────────────────────
Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "action"                       ; "upsert" ; JSONString ] ;
    [ "record.fm_record_id"          ; GetField("レコードID") ; JSONString ] ;
    [ "record.ad_name"               ; GetField("広告名") ; JSONString ] ;
    [ "record.inquiry_at"            ; GetAsTimestamp(GetField("問い合わせ日時")) ; JSONString ] ;
    [ "record.list_created_at"       ; GetAsTimestamp(GetField("リスト作成日時")) ; JSONString ] ;
    [ "record.status"                ; GetField("ステータス") ; JSONString ] ;
    [ "record.last_call_result"      ; GetField("最終架電結果") ; JSONString ] ;
    [ "record.company_name"          ; GetField("会社名") ; JSONString ] ;
    [ "record.representative_name"   ; GetField("代表名") ; JSONString ] ;
    [ "record.prefecture"            ; GetField("都道府県") ; JSONString ] ;
    [ "record.deal_amount"           ; GetField("受注金額") ; JSONNumber ] ;
    [ "record.initial_fee"           ; GetField("初期費用") ; JSONNumber ] ;
    [ "record.monthly_fee"           ; GetField("月額費用") ; JSONNumber ] ;
    [ "record.call_count"            ; GetField("架電回数") ; JSONNumber ]
  )
]

# ── cURL でPOST ──────────────────────────────────────────────────
Insert from URL [
  Select ; No dialog ;
  Target: $result ;
  URL: $url ;
  cURL options: "--request POST
    --header \"Content-Type: application/json\"
    --header \"x-fm-secret: [FM_WEBHOOK_SECRETの値]\"
    --data @$payload"
]

# ── エラーチェック ────────────────────────────────────────────────
If [ JSONGetElement ( $result ; "ok" ) ≠ "true" ]
  Show Custom Dialog [ "CRM同期エラー" ; JSONGetElement ( $result ; "error" ) ]
End If
```

---

## フィールドマッピング（FM名 → APIキー名）

| FMフィールド名     | JSONキー                     | 型       | 必須 |
|------------------|------------------------------|---------|------|
| レコードID         | record.fm_record_id          | string  | ◎   |
| 広告名            | record.ad_name               | string  |      |
| 問い合わせ日時     | record.inquiry_at            | ISO8601 |      |
| リスト作成日時     | record.list_created_at       | ISO8601 |      |
| ステータス         | record.status                | string  |      |
| 最終架電結果       | record.last_call_result      | string  |      |
| 会社名            | record.company_name          | string  |      |
| 代表名            | record.representative_name   | string  |      |
| 都道府県          | record.prefecture            | string  |      |
| 受注金額          | record.deal_amount           | number  |      |
| 初期費用          | record.initial_fee           | number  |      |
| 月額費用          | record.monthly_fee           | number  |      |
| 架電回数          | record.call_count            | number  |      |

---

## レスポンス仕様

### 成功（upsert）
```json
{ "ok": true, "action": "upserted", "id": "uuid" }
```

### 成功（delete）
```json
{ "ok": true, "action": "deleted" }
```

### エラー例
| HTTPステータス | 意味                     |
|------------|------------------------|
| 401        | x-fm-secret が不一致      |
| 400        | fm_record_id が未指定     |
| 500        | Supabase 書き込みエラー   |

---

## 動作確認用 curl コマンド

```bash
curl -X POST https://sooon-crm.vercel.app/api/fm/webhook \
  -H "Content-Type: application/json" \
  -H "x-fm-secret: YOUR_SECRET_HERE" \
  -d '{
    "action": "upsert",
    "record": {
      "fm_record_id": "TEST-001",
      "ad_name": "テスト広告",
      "inquiry_at": "2026-05-01T10:00:00",
      "status": "新規"
    }
  }'
```

期待レスポンス: `{"ok":true,"action":"upserted","id":"..."}`
