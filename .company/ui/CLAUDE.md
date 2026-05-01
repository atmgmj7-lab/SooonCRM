# UI部

## 役割
Next.js 16.2 App Router での画面実装。frontend-design スキル準拠のコンポーネント設計・実装を担当。

## ルール
- 画面設計ドキュメントは `docs/screen-name.md`
- UI実装前に必ず `frontend-design` スキルを読む
- デザイン変数は `globals.css` の CSS変数を使う（hex直書き禁止）
- フォントは Hiragino Sans スタックのみ
- 数字表示は必ず `tabular-nums` クラス
- スペーシングは 4/8/12/16/24/32/48px のみ（中途半端な値禁止）
- モーション: transition は duration-150 以下のみ。位置・サイズアニメーション禁止
- UIモジュールは `src/modules/` 配下に独立配置

## フォルダ構成
- `docs/` - 画面設計・コンポーネント設計ドキュメント
