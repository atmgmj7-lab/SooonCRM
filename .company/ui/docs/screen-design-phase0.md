---
created: "2026-04-26"
topic: "Phase 0 画面設計"
type: technical-doc
tags: [phase0, ui, layout, next.js]
---

# Phase 0 画面設計

## 概要
Phase 0で実装する画面・コンポーネントの設計書。
REQUIREMENTS.md セクション9・10 に基づく。

---

## 1. アプリケーション全体レイアウト

```
src/app/(dashboard)/layout.tsx
  ├── <Sidebar />         固定左サイドバー（幅220px、ネイビー背景）
  ├── <Header />          固定ヘッダー（高さ56px、白背景）
  └── {children}          可変メインコンテンツ（padding 24-32px）
```

サイドバーナビゲーション構造は `REQUIREMENTS.md` セクション9.1参照（7セクション）。

---

## 2. Phase 0で実装する画面（最小セット）

### 認証
- `(auth)/sign-in/[[...sign-in]]/page.tsx` — Clerk SignIn
- `(auth)/sign-up/[[...sign-up]]/page.tsx` — Clerk SignUp

### ダッシュボードレイアウト
- `(dashboard)/layout.tsx` — サイドバー + ヘッダー

### AIステータスダッシュボード（Phase 0 必須）
パス: `/dashboard/ai-status`

4パネル構成:
- データ蓄積状況パネル（総リード/コール/受注数、蓄積率バー）
- AIエージェント状態パネル（ON/OFF・精度・最終実行日時）
- 学習進捗パネル（Recharts グラフ、発見パターン一覧）
- 広告ROIパネル（広告別アポ率・受注率ランキング）

Phase 0では空状態でも崩れないよう実装。

### 設定画面（Phase 0 必須）
- `/settings/metrics` — metric_definitions テーブル CRUD
- `/settings/statuses` — status_definitions テーブル CRUD

---

## 3. デザインシステム（CLAUDE.md §デザインシステム 準拠）

### フォント
```css
font-family: 'Hiragino Sans', 'ヒラギノ角ゴシック', 'Hiragino Kaku Gothic ProN',
             'ヒラギノ角ゴ ProN W3', sans-serif;
```
- サイズ: 11/12/13/14/15/18/22px の7段階のみ
- ウェイト: 400/500/600/700 の4段階のみ
- 数字: `tabular-nums` 必須

### カラー（CSS変数のみ、hex直書き禁止）
主要変数: `--color-navy`, `--color-blue`, `--color-gray-50〜900`, `--color-white`

### スペーシング（8の倍数のみ）
4 / 8 / 12 / 16 / 24 / 32 / 48px

### 角丸
- 4px: バッジ・タグ
- 8px: ボタン・インプット・小カード
- 12px: メインカード・パネル

### モーション制限
- transition: `duration-150` 以下のみ
- 許可: `transition-colors`, `transition-opacity`
- 禁止: 位置・サイズアニメーション全般

---

## 4. コンポーネント設計

### src/components/layout/
- `sidebar.tsx` — 幅220px固定、ネスト構造ナビゲーション、アクティブ状態
- `header.tsx` — 高さ56px固定、右: Clerk UserButton

### src/components/settings/
- `metric-editor.tsx` — metric_definitions CRUD（is_system=true は削除不可）
- `status-editor.tsx` — status_definitions CRUD（is_system=true は削除不可）

### src/components/dashboard/ai-status/
- `DataAccumulationPanel.tsx`
- `AgentStatusPanel.tsx`
- `LearningProgressPanel.tsx`（Recharts使用）
- `AdRoiPanel.tsx`

---

## 5. Phase 0 最小ディレクトリ構成

```
src/
├── app/
│   ├── (auth)/sign-in・sign-up
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/ai-status/page.tsx
│   │   └── settings/metrics・statuses/page.tsx
│   └── api/webhooks/clerk/route.ts
├── components/layout/ + dashboard/ai-status/ + settings/
├── lib/supabase/client.ts + server.ts
├── modules/fm-layout/ + crm-editor/.gitkeep
└── types/supabase.ts（自動生成・手動編集禁止）
```

---

## 参照
- `REQUIREMENTS.md` セクション9（主要画面仕様）、セクション10（デザインシステム）
- `EXECUTION_PLAN.md` Phase 0 / Phase 1 UI関連STEP
- frontend-design スキル: `/mnt/skills/public/frontend-design/SKILL.md`（実装前に必読）
