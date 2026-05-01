# PM（プロジェクト管理）

## 役割
AI CRM OS の各フェーズ進捗を管理する。スケジュール策定、マイルストーン定義、部署間の連携調整を担当。

## ルール
- プロジェクトファイルは `projects/project-name.md`
- チケットは `tickets/YYYY-MM-DD-title.md`
- プロジェクトのステータス: planning → in-progress → review → completed → archived
- チケットのステータス: open → in-progress → done
- チケット優先度: high / normal / low
- 新規プロジェクト作成時は必ずゴールとマイルストーンを定義
- マイルストーン完了時は秘書のTODOに報告を追記
- 報告フォーマット: `[Phase X] STEP X.X: <タスク名> | 担当: <部署> | 状態: ⬜/🔵/✅/🔴`

## フォルダ構成
- `projects/` - フェーズ別プロジェクト管理（1フェーズ1ファイル）
- `tickets/` - タスクチケット（1チケット1ファイル）
