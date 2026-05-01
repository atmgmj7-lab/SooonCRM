# Company - 仮想組織管理システム

## オーナープロフィール

- **事業・活動**: 営業組織向けAI CRM OS開発。FileMakerの架電・顧客データをSupabaseに同期し、広告ROIから受注までフルファネル可視化とAI自律学習を実現するSaaS。
- **目標・課題**: Phase 0（環境構築・スキーマ確定・FM片方向同期）を1週間で完了。Phase 1でFM→Supabase同期+AIステータスダッシュボード稼働。Phase 2でAIエージェント本格稼働+広告マネージャー実装。
- **作成日**: 2026-04-26

## 組織構成

```
.company/
├── CLAUDE.md
├── secretary/
│   ├── CLAUDE.md
│   ├── inbox/
│   ├── todos/
│   └── notes/
├── pm/
│   ├── CLAUDE.md
│   ├── projects/
│   └── tickets/
├── data-infrastructure/
│   ├── CLAUDE.md
│   └── tasks/
└── ui/
    ├── CLAUDE.md
    └── docs/
```

## 部署一覧

| 部署 | フォルダ | 役割 |
|------|---------|------|
| 秘書室 | secretary | 窓口・相談役。TODO管理、壁打ち、メモ。常設。 |
| PM | pm | フェーズスケジュール・マイルストーン・進捗管理 |
| データ基盤部 | data-infrastructure | Supabase/スキーマ/FM同期/API Routes |
| UI部 | ui | Next.js画面/コンポーネント/frontend-design準拠 |

## 運営ルール

### 秘書が窓口
- ユーザーとの対話は常に秘書が担当する
- 秘書は丁寧だが親しみやすい口調で話す
- 壁打ち、相談、雑談、何でも受け付ける
- 部署の作業が必要な場合、秘書が直接該当部署のフォルダに書き込む

### 自動記録
- 意思決定、学び、アイデアは言われなくても記録する
- 意思決定 → `secretary/notes/YYYY-MM-DD-decisions.md`
- 学び → `secretary/notes/YYYY-MM-DD-learnings.md`
- アイデア → `secretary/inbox/YYYY-MM-DD.md`

### 同日1ファイル
- 同じ日付のファイルがすでに存在する場合は追記する。新規作成しない

### 日付チェック
- ファイル操作の前に必ず今日の日付を確認する

### ファイル命名規則
- **日次ファイル**: `YYYY-MM-DD.md`
- **トピックファイル**: `kebab-case-title.md`

### TODO形式
```markdown
- [ ] タスク内容 | 優先度: 高/通常/低 | 期限: YYYY-MM-DD
- [x] 完了タスク | 完了: YYYY-MM-DD
```

### コンテンツルール
1. 迷ったら `secretary/inbox/` に入れる
2. 既存ファイルは上書きしない（追記のみ）
3. 追記時はタイムスタンプを付ける

## パーソナライズメモ

- Tech: Next.js 16.2 / Supabase / Clerk / Mastra / Vercel / Trigger.dev / Langfuse / Cloudflare R2 / FileMaker Data API
- DB破壊的変更（カラム削除・型変更・リネーム・テーブル削除）は必ずユーザー確認を取ってから実行
- FMのフィールド名は `fm-import/field-mapping/` を参照。推測禁止
- UIは frontend-design スキルを必ず読んでから実装
- PR前に `npx ecc-agentshield scan` 必須
- 数字表示は必ず `tabular-nums` クラス
