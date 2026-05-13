# RUNBOOK.md — 手順書

> 非エンジニア向け。コピペで実行できるように書いています。
> コマンドは `! コマンド` の形式で Claude Code のターミナルから直接実行できます。

最終更新: 2026-05-10

---

## 手順1: スプレッドシート CSV インポート（欠損リードのバックフィル）

### 必要なもの
- Google スプレッドシートの「リード」シート（CSV でダウンロード済み）

### ステップ

**Step 1-1: CSVの列を確認する**

スプレッドシートの列が以下の順番になっているか確認してください:
```
会社名 | AD名 | 代表者名 | 都道府県 | 電話番号 | インバウンド
```

**Step 1-2: CSVを適切な形式に変換する**

CSV の1行目（ヘッダー行）を以下の英語名に変更してください:
```
company_name,ad_name,representative_name,prefecture,phone_number,inbound
```

**Step 1-3: 開発サーバーを起動する**

Claude Code のターミナルで:
```
! npm run dev
```

**Step 1-4: API に CSV データを送信する**

別のターミナルで（CSVをJSONに変換して送る例）:
```bash
# Python でCSVをJSONに変換してAPIに送る
python3 -c "
import csv, json
rows = []
with open('your-file.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        rows.append(row)
print(json.dumps({'rows': rows}, ensure_ascii=False))
" | curl -X POST http://localhost:3000/api/admin/import-leads \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <ログイン済みCookieをここに>' \
  -d @-
```

> Cookie の取得方法: ブラウザで http://localhost:3000 にログイン後、
> DevTools（F12）→ Application → Cookies → `__session` の値をコピー

**Step 1-5: 結果を確認する**

```json
{"imported": 35, "skipped": 0}
```
`imported` の数が取り込まれた件数です。

**Step 1-6: FM に一括プッシュする**

```bash
curl -X POST http://localhost:3000/api/admin/backfill-fm-push \
  -H 'Cookie: <ログイン済みCookie>'
```

レスポンス例:
```json
{"ok": true, "created": 20, "linked": 15, "failed": 0}
```
- `created`: FM に新規登録した件数
- `linked`: FM に既に存在したのでリンクのみした件数

---

## 手順2: Meta Webhook 登録（新規リードの自動受信設定）

### 前提
- Meta Business Suite にアクセスできること
- Facebook App の管理者権限があること

### ステップ

**Step 2-1: Meta for Developers にアクセス**

https://developers.facebook.com/apps/ を開く

**Step 2-2: 対象のアプリを選択**

Sooon-CRM 用のアプリ（または広告管理用アプリ）を選択

**Step 2-3: Webhook を設定**

左メニューから「Webhooks」→「追加」
- オブジェクトの種類: **Page**
- コールバック URL: `https://[your-vercel-domain]/api/webhooks/meta`
- 確認トークン: `sooon_meta_verify_2026`

**Step 2-4: leadgen イベントを購読**

「Page」行の「購読」ボタン → `leadgen` にチェック → 保存

**Step 2-5: テスト送信**

「テスト」ボタンを押して `200 OK` が返ることを確認

**Step 2-6: Vercel の環境変数を確認**

Vercel ダッシュボード → Settings → Environment Variables に以下があるか確認:
```
META_WEBHOOK_VERIFY_TOKEN = sooon_meta_verify_2026
DEFAULT_TENANT_ID = （設定済みの値）
```

---

## 手順3: Meta Graph API Pull（過去リードの手動取得）

### 使用場面
- Webhook が届かなかった期間のリードを手動で取得したいとき
- 定期的にバックアップとして取得したいとき

### ステップ

**Step 3-1: Pull API を実行**

```bash
curl -X POST https://[your-domain]/api/admin/pull-meta-leads \
  -H 'Cookie: <ログイン済みCookie>' \
  -H 'Content-Type: application/json' \
  -d '{"since": "2026-04-28", "until": "2026-05-10"}'
```

レスポンス例:
```json
{
  "ok": true,
  "forms_checked": 3,
  "leads_found": 42,
  "imported": 38,
  "skipped_duplicate": 4,
  "failed": 0
}
```

---

## 手順4: 開発サーバーの起動

```bash
! npm run dev
```

ブラウザで http://localhost:3000 を開く

---

## 手順5: DB マイグレーション適用（本番 DB に変更を反映）

```bash
! npx supabase db push
```

> 注意: 本番 DB に直接適用されます。実行前に内容を確認してください。

---

## 手順6: FM 手動フルシンク（スクリプト版）

```bash
! npx tsx scripts/run-full-sync.ts
```

FM の全件データを Supabase に取り込みます（変更のあったレコードのみ更新）。

---

## 手順6-B: FM 手動差分同期（UI版）

ブラウザで `/admin/sync` を開く。

- **リスト情報同期** ボタン → `POST /api/admin/sync-from-fm`
- **コール履歴同期** ボタン → `POST /api/admin/sync-calls`

結果（同期件数・スキップ件数・エラー件数）が画面に表示されます。

---

## 手順7: トラブルシューティング

### リードが一覧に表示されない
1. ブラウザの DevTools → Network タブで `/api/list-records` のレスポンスを確認
2. `data` 配列が空なら DB を確認: Supabase ダッシュボード → Table Editor → `list_records`

### Meta Webhook が届かない
1. Vercel の Function Logs で `/api/webhooks/meta` のエラーを確認
2. BLOCKER.md の BL-1 を確認

### FM 同期エラー
1. GitHub Actions → sync-fm.yml の最新実行ログを確認
2. BLOCKER.md の U-1 を確認（Vercel 環境変数）
