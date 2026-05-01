# サイドバー変更指示書 — sooon-crm
# このファイルをClaude Codeに渡して実行させること

---

## 変更内容

サイドバーのナビゲーション項目を以下の通り変更する。

### 変更前（削除する項目）
- `顧客 & コール履歴`（id: `customercall`）— 1つにまとまった項目を削除

### 変更後（追加する項目）
- `リスト情報`（id: `list`、href: `/list`）
- `コール履歴`（id: `calls`、href: `/calls`）

---

## 対象ファイル

サイドバーを定義しているファイルを特定して変更すること。
以下のいずれかにある（プロジェクト構造に応じて確認）:

```
src/app/(dashboard)/layout.tsx
src/components/layout/Sidebar.tsx
src/components/Sidebar.tsx
src/modules/navigation/Sidebar.tsx
```

---

## navアイテムの変更仕様

### 削除
```typescript
// この項目を削除
{ id: "customercall", label: "顧客 & コール履歴", href: "/customercall" },
// または以下のような類似定義も削除
{ id: "customers", label: "顧客データ", ... },
{ id: "calls", label: "コール", ... },  // 単体のコール項目があれば削除
```

### 追加（この2項目を、削除した位置に挿入）

```typescript
{
  id: "list",
  label: "リスト情報",
  href: "/list",
  icon: <ListIcon />, // 下記アイコン定義を使用
  // FMの「リスト情報」レイアウトに対応 → list_records テーブル
},
{
  id: "calls",
  label: "コール履歴",
  href: "/calls",
  icon: <CallHistoryIcon />, // 下記アイコン定義を使用
  // FMの「コール履歴」レイアウトに対応 → calls テーブル
},
```

---

## アイコン定義（SVG）

### リスト情報アイコン
```tsx
// リスト情報: テーブル/リスト型のアイコン
<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
  <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
  <path d="M1.5 5h11" stroke="currentColor" strokeWidth="1.2"/>
  <path d="M5 5v7.5" stroke="currentColor" strokeWidth="1.2"/>
</svg>
```

### コール履歴アイコン
```tsx
// コール履歴: 電話+時計（履歴）のアイコン
<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
  <path d="M2.5 2.5C2.5 2.5 4 1 5 2.5L6 4.5C6 4.5 6.5 5.5 5.5 6L4.5 6.5C4.5 6.5 5.5 9 7.5 9.5L8 8.5C8.5 7.5 9.5 8 9.5 8L11.5 9C13 10 11.5 11.5 11.5 11.5C10 13 2.5 8 2.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M9 1.5v3l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx="10" cy="3" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
</svg>
```

---

## 完成後のサイドバー項目順序（推奨）

```
ダッシュボード       /dashboard
広告               /ads
リード管理          /leads          ← webhook_leads（Meta広告リード）
リスト情報          /list           ← list_records（FMリスト情報）★追加
コール履歴          /calls          ← calls（FMコール履歴）★追加
商談データ          /deals
集計               /reports
─────────────────────
AIエージェント      /ai
設定               /settings
```

---

## ルーティング確認・ページ存在確認

変更後、以下のページが存在するか確認し、なければスタブページを作成すること。

### `/list` — リスト情報一覧
```
src/app/(dashboard)/list/page.tsx
```
存在しない場合は以下のスタブを作成:
```tsx
export default function ListPage() {
  return (
    <div>
      <h1>リスト情報</h1>
      <p>FM「リスト情報」レイアウト連携 — list_records テーブル</p>
    </div>
  );
}
```

### `/calls` — コール履歴一覧
```
src/app/(dashboard)/calls/page.tsx
```
存在しない場合は以下のスタブを作成:
```tsx
export default function CallsPage() {
  return (
    <div>
      <h1>コール履歴</h1>
      <p>FM「コール履歴」レイアウト連携 — calls テーブル</p>
    </div>
  );
}
```

---

## アクティブ状態の判定

現在のURLパスで `isActive` を判定している場合、以下のように設定:

```typescript
// /list → /list/* もアクティブにする
isActive: pathname === '/list' || pathname.startsWith('/list/'),

// /calls → /calls/* もアクティブにする
isActive: pathname === '/calls' || pathname.startsWith('/calls/'),
```

---

## 確認チェックリスト

```
[ ] 旧「顧客 & コール履歴」項目がサイドバーから消えている
[ ] 旧「コール」単体項目（あれば）も消えている
[ ] 「リスト情報」がサイドバーに表示され、/list に遷移する
[ ] 「コール履歴」がサイドバーに表示され、/calls に遷移する
[ ] /list ページが表示される（スタブでもOK）
[ ] /calls ページが表示される（スタブでもOK）
[ ] /list/[id] を開いたとき「リスト情報」がアクティブ（ハイライト）になる
[ ] アイコンが正しく表示される
```

---

_sooon-crm サイドバー変更指示 — 2026-04-30_
