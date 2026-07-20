# 実装計画: データエクスポート(CSV)機能(Issue #20)

> Status: **Draft(承認済み・実装前)** / 作成日: 2026-07-20
> 対象仕様: `docs/spec-issue20.md`
> チェックリスト: `tasks/todo.md`(= `docs/tasks-issue20.md`)

## 方針

- 新規 npm 依存は追加しない。サーバー(Cloud Functions)・Firestore ルールの変更もなし
- CSV 生成ロジックは純粋関数として切り出し、DOM(`Blob`/`URL`/`<a>`)に依存するのは薄いラッパー 1 関数のみに閉じる(テスト容易性のため)
- 縦切り: 基盤(CSV エスケープ)→ ドメインロジック(価格記録→CSV変換)→ UI 配線、の順に完結させながら積む
- 各タスク終了時に該当テスト → `npm run lint` を通してから次へ進む。Task 3/4 は追加で `npm run build` も通す

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| `src/lib/csv.ts`(汎用 RFC 4180 エスケープ)と `src/features/prices/export.ts`(ドメイン変換+副作用)を分離 | 純粋関数(`buildPriceRecordsCsv`/`buildExportFilename`)を DOM モックなしで単体テストできるようにする。DOM 依存は `downloadPriceRecordsCsv` 1 関数のみに閉じ込める |
| BOM 付加は `export.ts` 側(`csv.ts` はしない) | BOM は Excel 向けエンコーディングという用途固有の関心事であり、`csv.ts` は汎用ユーティリティとして用途に依存させない |
| `productId`/`storeId` → 名前解決は `Map` によるルックアップ | `.find()` ループより O(n+m) で明確。参照整合性は保証されていないため未解決時は空文字にフォールバック |
| `isOwner` によるボタン表示のガードをしない | 仕様の「退会フローに限らず、いつでも使える」という意図に合わせ、book の全メンバーが自分のデータを持ち出せるようにする |
| ボタンは非破壊的操作として中立的なスタイル(`text-sale` 等の警告色を使わない) | ログアウト・退会ボタンと視覚的に区別し、危険な操作だと誤解させない |

詳細は `docs/plan-issue20.md` を参照(本ファイルはその写し)。実装が完了したら本ファイルおよび `tasks/todo.md` はそのまま「直近issueの写し」として維持し、次 Issue 着手時に上書きする(Issue #14 運用と同じ)。
