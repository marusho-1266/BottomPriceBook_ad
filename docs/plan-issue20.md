# 実装計画: データエクスポート(CSV)機能(Issue #20)

> Status: **実装済み(PR #29)** / 作成日: 2026-07-20
> 対象仕様: `docs/spec-issue20.md`
> チェックリスト: `docs/tasks-issue20.md`

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

## 主要コンポーネントと依存

```
Task 1: src/lib/csv.ts(escapeCsvField / buildCsv)
      │
      ▼
Task 2: src/features/prices/export.ts
        (buildPriceRecordsCsv / buildExportFilename — 純粋関数)
      │
      ▼
Task 3: src/features/prices/export.ts
        (downloadPriceRecordsCsv — 副作用ラッパー、同ファイルに追加)
      │
      ▼
Task 4: src/routes/SettingsPage.tsx
        (usePriceRecords/useProducts/useStores を呼びボタン配線)
```

## 実装順序(フェーズ)

### Phase 1: CSV ユーティリティ(基盤)

1. **Task 1: `src/lib/csv.ts` 実装(XS)**
   `escapeCsvField(value: string): string` と `buildCsv(rows: string[][]): string` を実装。
   フィールドがカンマ・ダブルクォート・`\r`/`\n` を含む場合のみクォートし、ダブルクォートは二重化。
   行区切りは `\r\n`、末尾に余分な区切りは付けない。
   - 受け入れ: カンマ/ダブルクォート(二重化)/`\n`/`\r\n` を含むフィールドが正しくクォートされる。
     空文字列・複数行結合が期待通り
   - 検証: `npm run test -- tests/lib/csv.test.ts` → `npm run lint`
   - Files: `src/lib/csv.ts`, `tests/lib/csv.test.ts`

**✅ チェックポイント A**: `npm run test && npm run lint` green。`csv.ts` に Firestore/DOM 依存なし。

### Phase 2: エクスポートドメインロジック

2. **Task 2: `buildPriceRecordsCsv` / `buildExportFilename` 実装(S)**
   `src/features/prices/export.ts` に純粋関数を実装。
   ヘッダー: `記録日時, 商品名, 店舗名, 価格, 内容量, 単位, セール, メモ`。
   `productId`/`storeId` は `Map` で名前解決(未解決時は空文字)、`recordedAt` はローカル時刻
   `YYYY-MM-DD HH:mm` に整形、`isSale` は「はい」/「いいえ」、`note` 未設定は空文字。
   出力は BOM(`﻿`)を先頭に付加。
   `buildExportFilename(bookName, now)` は不正文字 `/ \ : * ? " < > |` を `_` に置換し
   `底値記録_<book名>_<YYYYMMDD>.csv` を返す。
   - 受け入れ: 0 件でヘッダーのみ・BOM 付き。各列の導出が仕様通り。
     カンマ/クォート/改行を含む商品名・メモが正しくエスケープされる。
     ファイル名の不正文字置換・日付ゼロ埋めが正しい
   - 検証: `npm run test -- tests/features/prices/export.test.ts` → `npm run lint`
   - Files: `src/features/prices/export.ts`, `tests/features/prices/export.test.ts`
   - 依存: Task 1

3. **Task 3: `downloadPriceRecordsCsv` 副作用ラッパー実装(S)**
   同ファイルに `downloadPriceRecordsCsv(records, products, stores, bookName, now?)` を追加。
   `Blob` 生成 → `URL.createObjectURL` → `<a>` 生成・`download` 属性設定・`click()` →
   `revokeObjectURL` → `trackEvent('export_data')`(引数なし)。
   `URL`/`click` のスタブは `export.test.ts` 内にローカルスコープ
   (`vi.stubGlobal` + `vi.spyOn(HTMLAnchorElement.prototype, 'click')`、
   `afterEach` で `vi.unstubAllGlobals()`)。**`tests/setup.ts` は変更しない**。
   - 受け入れ: `Blob` 生成・`URL.createObjectURL`/`revokeObjectURL` 呼び出し・
     `<a>.download` がファイル名と一致・`click()` 実行・`trackEvent('export_data')` 呼び出しを確認
   - 検証: `npm run test -- tests/features/prices/export.test.ts` →
     `npm run lint` → `npm run build`
   - Files: `src/features/prices/export.ts`, `tests/features/prices/export.test.ts`
   - 依存: Task 2

**✅ チェックポイント B**: `npm run test && npm run lint` green。純粋関数のテストに DOM モックが混入していないこと。`git diff tests/setup.ts` が空であること。

### Phase 3: UI 配線

4. **Task 4: `SettingsPage.tsx` にボタン配線(S)**
   `usePriceRecords()`(引数なし=全期間)/`useProducts()`/`useStores()`/`useBook()` を呼び、
   「データをエクスポート」ボタンの `onClick` で
   `downloadPriceRecordsCsv(records.data, products.data, stores.data, book?.name ?? '')` を実行。
   配置は `ShareSettings` 〜 ログアウトボタンの間に独立セクションとして常設。
   `isOwner` によるガードはしない。中立的なスタイル(既存 `h-12 w-full rounded-2xl` パターン踏襲)。
   - 受け入れ: オーナー/非オーナー双方の設定画面表示でボタンが見える。
     クリックで `downloadPriceRecordsCsv` が正しい引数で呼ばれる
     (テストでは各フックと `downloadPriceRecordsCsv` をモックし、CSV 生成ロジック自体は再テストしない)
   - 検証: `npm run test -- tests/routes/SettingsPage.test.tsx` →
     `npm run test && npm run lint && npm run build`
   - Files: `src/routes/SettingsPage.tsx`, `tests/routes/SettingsPage.test.tsx`
   - 依存: Task 3

**✅ 最終チェックポイント**:
- `npm run test && npm run lint && npm run build` 全 green
- 手動スモーク: 価格記録あり(メモにカンマ/引用符/改行を含むケース含む)・0 件の両方の book で
  ボタンを押下し、CSV を Excel 等で開いて文字化けなし・列崩れなしを確認。
  ファイル名が `底値記録_<book名>_<YYYYMMDD>.csv` 形式(不正文字含む book 名でも `_` 置換)であることを確認
- `export_data` イベントが発火し PII を含まないことを確認(GA4 DebugView 等)
- `docs/spec-issue20.md` の Success Criteria 全項目を満たすことを確認

## 並行可能性

- 各タスクは直列依存(Task 1 → 2 → 3 → 4)。いずれも規模が小さく並行実行のメリットは薄いため直列で進める

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| jsdom に `URL.createObjectURL` が無く、グローバル `tests/setup.ts` に混入させると他テストに影響 | 中 | `export.test.ts` 内でのみ `vi.stubGlobal`/`vi.spyOn` を使い `afterEach` で復元。`tests/setup.ts` は変更しない |
| `Timestamp.toDate()` はタイムゾーン依存。CI/開発機で結果がずれるとテストがフレーキーになる | 中 | テスト用 Timestamp は `Timestamp.fromDate(new Date(2026, 6, 20, 9, 5))` のようにローカル時刻コンストラクタで作り、期待値もローカル時刻ベースで組み立てる |
| RFC 4180 の端ケース(`\r` 単独、改行を含むメモ等) | 低 | `escapeCsvField` の正規表現 `/[",\r\n]/` で `\r` 単独もカバー。`\r\n` を含むメモのテストケースを明示的に追加 |
| 削除済み商品/店舗を参照する `productId`/`storeId`(参照整合性は保証されていない) | 低 | 仕様通り空文字にフォールバック。Task 2 のテストで未解決ケースを明示的にカバー |
| `verbatimModuleSyntax: true` により型のみインポートで `import type` を忘れるとビルド失敗 | 低 | 各タスクの検証手順に `npm run build` を含める |

## Open Questions

なし
