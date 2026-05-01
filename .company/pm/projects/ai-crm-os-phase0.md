---
created: "2026-04-26"
project: "AI CRM OS — Phase 0"
status: in-progress
tags: [phase0, setup, schema, next.js]
---

# プロジェクト: AI CRM OS — Phase 0（環境構築）

## 概要
Next.js 16.2 + Supabase + Clerk + Mastra の環境を構築し、
DBスキーマを確定・投入する。FM片方向同期の土台を整える。

## ゴール
- `npm run dev` でエラーなく起動
- Supabase に全テーブルが作成されている
- `metric_definitions` / `status_definitions` にデフォルト値が入っている
- Mastra Studio (`:4111`) でエージェントが表示される
- `/dashboard/ai-status` にアクセスできる（空画面でOK）
- `fm-import/` フォルダが存在する
- `npx ecc-agentshield scan` でクリーン

## マイルストーン

| # | マイルストーン | 期限 | 担当 | 状態 |
|---|-------------|------|------|------|
| 1 | Next.jsプロジェクト初期化 + パッケージインストール | 2026-04-27 | データ基盤部 | ⬜ 未着手 |
| 2 | Supabaseプロジェクト作成 + pgvector有効化 | 2026-04-27 | データ基盤部 | ⬜ 未着手 |
| 3 | DB_SCHEMA.sql 全実行 | 2026-04-28 | データ基盤部 | ⬜ 未着手 |
| 4 | ステータスマスタ / 指標マスタ 初期投入 | 2026-04-28 | データ基盤部 | ⬜ 未着手 |
| 5 | Mastra 初期化（agents/workflows/RAG/memory） | 2026-04-29 | データ基盤部 | ⬜ 未着手 |
| 6 | ディレクトリ構成作成（REQUIREMENTS.md §15 STEP5） | 2026-04-29 | UI部 | ⬜ 未着手 |
| 7 | サイドバー + ヘッダー レイアウト実装 | 2026-04-30 | UI部 | ⬜ 未着手 |
| 8 | /dashboard/ai-status 空画面実装 | 2026-04-30 | UI部 | ⬜ 未着手 |
| 9 | /settings/metrics / /settings/statuses 画面実装 | 2026-05-01 | UI部 | ⬜ 未着手 |
| 10 | QA: ECC scan + 動作確認チェックリスト全クリア | 2026-05-02 | QA部 | ⬜ 未着手 |
| 11 | Phase 0 完了・Phase 1 キックオフ準備 | 2026-05-03 | PM | ⬜ 未着手 |

## 詳細スケジュール（Week 1）

```
04/26 (日)  組織構築・ドキュメント読み込み      [完了]
04/27 (月)  Next.js初期化 / Supabase作成
04/28 (火)  スキーマ実行 / マスタ投入
04/29 (水)  Mastra初期化 / ディレクトリ構成
04/30 (木)  レイアウト / ai-status画面
05/01 (金)  settings/metrics + statuses画面
05/02 (土)  QA・ECCスキャン
05/03 (日)  Phase 0 完了確認 → Phase 1へ
```

## 関連部署
- データ基盤部: スキーマ作成・Supabase設定（STEP 0.2〜0.10）
- UI部: ディレクトリ構成・レイアウト・初期画面（STEP 0.5）
- QA部: 動作確認・ECCスキャン（STEP 0.11）

## 参照ドキュメント
- `REQUIREMENTS.md` セクション15 実行手順
- `EXECUTION_PLAN.md` Phase 0 詳細（STEP 0.1〜0.11）
- `DB_SCHEMA.sql` 実行するスキーマ（存在確認が必要）

## メモ
- DB_SCHEMA.sql の存在確認が必要（プロジェクトルートに未確認）
- fm-import/field-mapping/ はFMのフィールド情報が届き次第配置
- フェーズ期間目安: Phase 0=1週間 / Phase 1=2-3週間 / Phase 2=1ヶ月
