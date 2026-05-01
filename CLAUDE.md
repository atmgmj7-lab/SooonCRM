# AI CRM OS — Claude Code 動作ルール
# このファイルをプロジェクトルートに `CLAUDE.md` として配置すること
# 全Claude Codeセッションで自動読み込みされる

---

## プロダクト

営業組織の1次情報をAIが自律学習するCRM。
FileMakerで管理している架電・顧客データをSupabaseに同期し、
広告ROIから受注までフルファネル可視化と自律学習を実現する。

詳細仕様は `REQUIREMENTS.md` を参照。

---

## 技術スタック

- Next.js 16.2 (App Router, Turbopack)
- Supabase (PostgreSQL + pgvector + RLS)
- Clerk (Organizations)
- Mastra (エージェント + RAG + MCP)
- Vercel + Trigger.dev
- Langfuse (AI監視)
- Cloudflare R2 (音声ストレージ)
- FileMaker Data API (Phase 1: 片方向同期)

---

## 開発コマンド

```bash
npm run dev          # 開発サーバー（Turbopack）
npx mastra dev       # Mastra Studio（:4111）
npx supabase start   # ローカルSupabase
npm run build        # 本番ビルド
npm run lint         # ESLint
npx ecc-agentshield scan   # ECCセキュリティスキャン（PR前必須）
```

---

## Cursor Orchestration（実装委譲）

コード生成・ファイル編集はCursor Agentに委譲する。Claude Codeは設計・レビュー・デプロイのみ担当。

```bash
DISPATCH="python3 /Users/narikiyotakashi/Desktop/dev/claude-cursor-orchestration/src/cursor_dispatch.py"

# 単体タスク
$DISPATCH "修正内容の説明" --workspace $PWD --model composer-2-fast

# 並列タスク（独立した複数ファイルの同時実装）
$DISPATCH parallel --workspace $PWD \
  --tasks '["タスク1の説明", "タスク2の説明"]' \
  --model composer-2-fast

# 質問が返ってきた場合（result.has_question == true）
$DISPATCH "回答" --workspace $PWD --resume <session_id>
```

### パイプライン
1. **Phase 0** — 要件確認（Claude Code）
2. **Phase 1** — 設計レビュー（`--mode plan` でCursorに送る）
3. **Phase 2** — 並列実装ディスパッチ（独立タスクを同時に）
4. **Phase 3** — 統合レビュー（Claude Codeがコンフリクト確認）
5. **Phase 4** — 品質レビュー（6並列: 型安全/セキュリティ/UI/ロジック/テスト/パフォーマンス）
6. **Phase 5** — 修正ディスパッチ（レビュー指摘をCursorへ）
7. **Phase 6** — E2Eテスト
8. **Phase 7** — デプロイ（Claude Codeが直接実行）
9. **Phase 8** — PR作成

---

## 絶対ルール（厳守）

### データベース系

1. **全テーブルに `tenant_id` 必須** — マルチテナント分離の基本
2. **DB操作はSupabase RPC経由** — 直接SQL禁止（型安全性とRLS適用のため）
3. **カスタム項目は `custom_data jsonb` に格納** — スキーマ汚染防止
4. **`src/types/supabase.ts` は自動生成** — 手動編集禁止
5. **マイグレーションでスキーマ変更** — ダッシュボード直接SQL禁止
6. **AIエージェントの全判断を `agent_instructions` に記録** — Human in the Loop

### 破壊的DB変更（必ず事前確認）

以下の変更は**必ずユーザーに確認を取ってから実行する**:
- 既存カラムの削除
- 既存カラムの型変更
- 既存カラムのリネーム
- 既存テーブルの削除
- インデックス削除
- RLSポリシーの大規模変更

新規カラム追加・新規テーブル作成は確認不要（後方互換あり）。

### コード系

7. **proxy.ts を使う** — middleware.ts は非推奨
8. **PR前に `npx ecc-agentshield scan`** — セキュリティスキャン必須
9. **環境変数は `.env.local`** — コミット禁止
10. **API key・顧客データのハードコード禁止**
11. **UIモジュールは `src/modules/` 配下に独立配置**
12. **FMのフィールド名・レイアウト名は推測禁止** — `fm-import/field-mapping/` を必ず参照

### 指標・ステータス系

13. **指標は `metric_definitions` マスタで管理** — ハードコード禁止
14. **ステータスは `status_definitions` マスタで管理** — ハードコード禁止
15. **エージェント指標は運用中に調整する前提で実装** — 最初から完璧を求めない

### UI系

16. **UI実装前に `frontend-design` スキルを読む** — `/mnt/skills/public/frontend-design/SKILL.md`
17. **数字表示は必ず `tabular-nums` クラス** — 縦ラインがブレない
18. **デザイン変数は `globals.css` のCSS変数を使う** — hex直書き禁止
19. **Hiragino Sans フォントスタックを使う** — DM Sans等は使わない

---

## デザインシステム（厳守）

### フォント

```css
font-family: 'Hiragino Sans', 'ヒラギノ角ゴシック', 'Hiragino Kaku Gothic ProN',
             'ヒラギノ角ゴ ProN W3', sans-serif;
```

- フォントサイズスケール: 11 / 12 / 13 / 14 / 15 / 18 / 22px の7段階のみ使用
- フォントウェイト: 400 / 500 / 600 / 700 の4段階のみ使用
- 数字は必ず `tabular-nums` クラス（`font-variant-numeric: tabular-nums`）

### メインカラー（CSS変数）

```css
--color-navy:        #0D1B2A;
--color-navy-mid:    #1A3A5C;
--color-blue:        #2563EB;
--color-blue-light:  #EFF6FF;
--color-success:     #0F6E56;
--color-success-bg:  #E1F5EE;
--color-warning:     #854F0B;
--color-warning-bg:  #FAEEDA;
--color-danger:      #A32D2D;
--color-danger-bg:   #FCEBEB;
--color-gray-50:     #F8FAFC;
--color-gray-100:    #F1F5F9;
--color-gray-200:    #E2E8F0;
--color-gray-400:    #94A3B8;
--color-gray-600:    #475569;
--color-gray-900:    #0F172A;
--color-white:       #FFFFFF;
```

### スペーシング（8の倍数ルール）

4 / 8 / 12 / 16 / 24 / 32 / 48px のみ。中途半端な値禁止。

### 角丸

- 4px: バッジ・タグ / 8px: ボタン・小カード / 12px: メインカード / 16px: モーダル / 9999px: 丸ボタン

### モーション制限

- `duration-150` 以下のみ許可
- 禁止: 位置・サイズアニメーション全般、ページロード時フェードイン
- 例外: `animate-spin`（スピナー）、`animate-pulse`（スケルトン）

### レイアウト原則

- 左サイドバー: 固定（ネイビー背景、幅220px）
- ヘッダー: 固定（白背景、高さ56px、下境界1px solid gray-200）
- メインコンテンツ: 可変、padding 24-32px

---

## FMデータ同期ルール（Phase 1）

- 現フェーズは **FM→Supabase 片方向のみ**
- FMが書き込みマスタ、Supabaseは読み取りミラー
- `fm_sync_queue.enabled=false` で停止（Phase 3で有効化）
- FMフィールド名は `fm-import/field-mapping/` の記載を絶対の正とする

詳細は `FM_SYNC_DESIGN.md` 参照。

---

## 詳細仕様

- **REQUIREMENTS.md** — 要件定義書（全体像）
- **DB_SCHEMA.sql** — 確定SQLスキーマ
- **METRICS_DEFINITION.md** — 全指標の計算式
- **FM_SYNC_DESIGN.md** — FileMaker同期設計
- **AI_LEARNING_FOUNDATION.md** — AI学習基盤
- **AD_MANAGER_SPEC.md** — 広告マネージャー画面仕様
- **EXECUTION_PLAN.md** — Claude Code 実行手順
