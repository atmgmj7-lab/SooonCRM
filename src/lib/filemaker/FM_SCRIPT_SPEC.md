# FileMaker → AI CRM OS 同期スクリプト仕様書（改訂版）

## エンドポイント

```
POST https://sooon-crm.vercel.app/api/fm/webhook
```

## 認証ヘッダー

```
x-fm-secret: [FM_WEBHOOK_SECRETの値]
Content-Type: application/json
```

> **重要**: FM_WEBHOOK_SECRET の値は `.env.local` および Vercel 環境変数に設定済みのものを使用してください。FM 側ではマスタ設定テーブルの `WEB_CRM_SECRET` で同一値を管理し、スクリプトにハードコードしない運用を推奨します。

---

## スクリプト構成（2本構成）

### 親スクリプト「Push To Web CRM（トリガー用）」

OnRecordCommit に設定。クライアント側では通信を行わず、サーバーに処理を委譲するだけ。UI がフリーズしない。

```
# 親スクリプト: Push To Web CRM（トリガー用）
Perform Script on Server [
  指定: "Push To Web CRM（サーバー実行）" ;
  引数: Get ( レコードID ) & "|" & テーブル名::fm_record_id ;
  終了を待たない: オン   ← ★これが重要。UIをブロックしない
]
```

### 子スクリプト「Push To Web CRM（サーバー実行）」

サーバー側で実行。引数からレコードを特定して API に送信する。

```
# ── 引数の分解 ──────────────────────────────────────
Set Variable [ $recID     ; Value: GetValue ( Get ( スクリプト引数 ) ; 1 ) ]
Set Variable [ $fmRecordID ; Value: GetValue ( Get ( スクリプト引数 ) ; 2 ) ]

# ── レコードを特定 ───────────────────────────────────
Go to Record/Request/Page [ First ]
Perform Find [
  テーブル名::レコードID = $recID   ← 直接フィールド参照（文字列指定NG）
]
If [ Get ( 対象レコード数 ) = 0 ]
  Exit Script [ Text Result: "record not found" ]
End If

# ── シークレットキー取得（マスタテーブルから） ───────
Set Variable [ $secret ; Value: マスタ設定::WEB_CRM_SECRET ]
# ※ マスタ設定テーブルに WEB_CRM_SECRET フィールドを用意して管理

# ── 日時をISO8601形式に変換 ──────────────────────────
# FileMakerのタイムスタンプ（2026/05/01 10:00:00）→ ISO8601（2026-05-01T10:00:00）
Set Variable [ $ts ; Value: テーブル名::問い合わせ日時 ]
Set Variable [ $dateStr ; Value: 
  Right ( "0" & Year ( $ts ) ; 4 ) & "-" &
  Right ( "0" & Month ( $ts ) ; 2 ) & "-" &
  Right ( "0" & Day ( $ts ) ; 2 )
]
Set Variable [ $timeStr ; Value:
  Right ( "0" & Hour ( $ts ) ; 2 ) & ":" &
  Right ( "0" & Minute ( $ts ) ; 2 ) & ":" &
  Right ( "0" & Seconds ( $ts ) ; 2 )
]
Set Variable [ $inquiryAtISO ; Value: $dateStr & "T" & $timeStr ]

# ── JSONペイロード構築 ──────────────────────────────
Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "action"                          ; "upsert"                           ; JSONString ] ;
    [ "record.fm_record_id"             ; テーブル名::レコードID             ; JSONString ] ;
    [ "record.customer_id"              ; テーブル名::顧客ID                 ; JSONString ] ;
    [ "record.ad_name"                  ; テーブル名::ADNAME                 ; JSONString ] ;
    [ "record.inquiry_at"               ; $inquiryAtISO                      ; JSONString ] ;
    [ "record.list_created_at"          ; $inquiryAtISO                      ; JSONString ] ;
    [ "record.status"                   ; テーブル名::最終架電結果           ; JSONString ] ;
    [ "record.last_call_result"         ; テーブル名::最終架電結果           ; JSONString ] ;
    [ "record.company_name"             ; テーブル名::会社名                 ; JSONString ] ;
    [ "record.representative_name"      ; テーブル名::代表名                 ; JSONString ] ;
    [ "record.prefecture"               ; テーブル名::都道府県               ; JSONString ] ;
    [ "record.deal_amount"              ; テーブル名::受注金額               ; JSONNumber ] ;
    [ "record.initial_fee"              ; テーブル名::初期費用               ; JSONNumber ] ;
    [ "record.monthly_fee"              ; テーブル名::月額費用               ; JSONNumber ] ;
    [ "record.newcomer_flag"            ; テーブル名::新人フラグ             ; JSONString ] ;
    [ "record.call_count"               ; テーブル名::架電回数               ; JSONNumber ]
  )
]

# ── cURL でPOST ─────────────────────────────────────
Insert from URL [
  Select ; No dialog ;
  Target: $result ;
  URL: "https://sooon-crm.vercel.app/api/fm/webhook" ;
  cURL options: 
    "--request POST" &
    " --header \"Content-Type: application/json\"" &
    " --header \"x-fm-secret: " & $secret & "\"" &
    " --data @$payload" &
    " --max-time 10"
]

# ── エラーチェック1: ネットワークエラー ─────────────
Set Variable [ $fmError ; Value: Get ( 最終エラー ) ]
If [ $fmError ≠ 0 ]
  # PSoSなのでShow Custom Dialogは使えない → ログテーブルに記録
  Set Variable [ $log ; Value:
    JSONSetElement ( "{}" ;
      [ "timestamp" ; Get ( 現在の時刻 ) ; JSONString ] ;
      [ "error_type" ; "network" ; JSONString ] ;
      [ "fm_error" ; $fmError ; JSONString ] ;
      [ "fm_record_id" ; テーブル名::レコードID ; JSONString ]
    )
  ]
  # 同期エラーログテーブルに記録（テーブル: sync_error_log）
  Exit Script [ Text Result: "Network Error: " & $fmError ]
End If

# ── エラーチェック2: APIエラー ──────────────────────
If [ JSONGetElement ( $result ; "ok" ) ≠ 1 ]
  Set Variable [ $errMsg ; Value: JSONGetElement ( $result ; "error" ) ]
  # ログテーブルに記録
  Exit Script [ Text Result: "API Error: " & $errMsg ]
End If

# ── 成功 ────────────────────────────────────────────
Exit Script [ Text Result: "ok" ]
```

> **メモ**: 実際のレイアウトでは `テーブル名::` を読み替えること。`list_created_at` を問い合わせ日時と同一にしている例のため、別フィールド（リスト作成日時）を送る場合は ISO 変換をそのフィールド用に追加すること。

---

## 削除時の対応

OnRecordDelete トリガーに「Delete From Web CRM」スクリプトを割り当てる。

**注意**: PSoS で非同期にすると削除後にレコードが存在しないため、引数に `fm_record_id` を直接渡すこと。

```
# 削除スクリプト（クライアント側）
Set Variable [ $fmRecordID ; Value: テーブル名::レコードID ]
Perform Script on Server [
  指定: "Delete From Web CRM（サーバー実行）" ;
  引数: $fmRecordID ;
  終了を待たない: オン
]
```

```
# 削除スクリプト（サーバー側）
Set Variable [ $fmRecordID ; Value: Get ( スクリプト引数 ) ]
Set Variable [ $secret ; Value: マスタ設定::WEB_CRM_SECRET ]
Set Variable [ $payload ; Value:
  JSONSetElement ( "{}" ;
    [ "action" ; "delete" ; JSONString ] ;
    [ "record.fm_record_id" ; $fmRecordID ; JSONString ]
  )
]
Insert from URL [ ... 同様にPOST ... ]
```

---

## マスタ設定テーブルの構成

FM に以下のテーブルを作成してシークレットを管理する:

| フィールド名 | 値 |
|------------|-----|
| WEB_CRM_SECRET | （FM_WEBHOOK_SECRETの値） |

スクリプト内ではこのテーブルから取得することで、キーローテーション時にスクリプト修正が不要になる。

---

## フィールドマッピング

| FMフィールド（直接参照） | JSONキー | 型 |
|------------------------|---------|-----|
| テーブル名::レコードID | record.fm_record_id | string |
| テーブル名::顧客ID | record.customer_id | string |
| テーブル名::ADNAME | record.ad_name | string |
| テーブル名::問い合わせ日時（ISO変換後） | record.inquiry_at | ISO8601 |
| テーブル名::最終架電結果 | record.status | string |
| テーブル名::最終架電結果 | record.last_call_result | string |
| テーブル名::会社名 | record.company_name | string |
| テーブル名::代表名 | record.representative_name | string |
| テーブル名::都道府県 | record.prefecture | string |
| テーブル名::受注金額 | record.deal_amount | number |
| テーブル名::初期費用 | record.initial_fee | number |
| テーブル名::月額費用 | record.monthly_fee | number |
| テーブル名::新人フラグ | record.newcomer_flag | string |
| テーブル名::架電回数 | record.call_count | number |


---

## API レスポンス仕様（CRM 側）

### 成功（upsert）

```json
{ "ok": true, "action": "upserted", "id": "uuid" }
```

### 成功（delete）

```json
{ "ok": true, "action": "deleted" }
```

### エラー例

| HTTPステータス | 意味 |
|------------|------|
| 401 | x-fm-secret が不一致 |
| 400 | fm_record_id が未指定など |
| 500 | Supabase 書き込みエラー |

FileMaker 側の `JSONGetElement ( $result ; "ok" )` は JSON の真偽値 `true` を評価する。環境によっては文字列化されるため、比較式は実機で確認すること。

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
      "customer_id": "CS-00001",
      "ad_name": "テスト広告",
      "inquiry_at": "2026-05-01T10:00:00",
      "newcomer_flag": "",
      "status": "新規",
      "last_call_result": "新規"
    }
  }'
```

期待レスポンス: `{"ok":true,"action":"upserted","id":"..."}`
