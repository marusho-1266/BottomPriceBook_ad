# タスク分解: データエクスポート(CSV)機能(Issue #20)

> Status: **Draft(承認済み・実装前)** / 作成日: 2026-07-20
> 対象: `docs/spec-issue20.md` / 計画: `docs/plan-issue20.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase 1: CSV ユーティリティ(基盤)

- [ ] **I20-T1: `src/lib/csv.ts`(`escapeCsvField` / `buildCsv`)**
  - 内容: RFC 4180 準拠のフィールドエスケープ(カンマ・ダブルクォート・`\r`/`\n` を含む場合のみクォート、
    ダブルクォートは二重化)と行結合(`\r\n` 区切り、末尾に余分な区切りなし)を実装
  - Acceptance: カンマ/ダブルクォート/`\n`/`\r\n` を含むフィールドが正しくクォートされる。
    空文字列・複数行結合が期待通り
  - Verify: `npm run test -- tests/lib/csv.test.ts` → `npm run lint`
  - Files: `src/lib/csv.ts`, `tests/lib/csv.test.ts`
  - 依存: なし / 規模: XS

- [ ] ✅ チェックポイント A: `npm run test && npm run lint` green・`csv.ts` に Firestore/DOM 依存なし

## Phase 2: エクスポートドメインロジック

- [ ] **I20-T2: `buildPriceRecordsCsv` / `buildExportFilename`(純粋関数)**
  - 内容: `src/features/prices/export.ts` に価格記録配列 → CSV 文字列変換(ID→名前解決・日時整形・
    BOM 付加)とファイル名生成を実装
  - Acceptance: 0 件でヘッダーのみ・BOM 付き。列導出が仕様通り(日時・名前解決・はい/いいえ・メモ)。
    エスケープ対象文字を含む値が正しく処理される。ファイル名の不正文字置換・日付ゼロ埋めが正しい
  - Verify: `npm run test -- tests/features/prices/export.test.ts` → `npm run lint`
  - Files: `src/features/prices/export.ts`, `tests/features/prices/export.test.ts`
  - 依存: I20-T1 / 規模: S

- [ ] **I20-T3: `downloadPriceRecordsCsv`(副作用ラッパー)**
  - 内容: `Blob` 生成 → `URL.createObjectURL` → `<a>` 生成・click → `revokeObjectURL` →
    `trackEvent('export_data')`。DOM スタブは `export.test.ts` 内ローカルスコープのみ
    (`tests/setup.ts` は変更しない)
  - Acceptance: `Blob`/`URL.createObjectURL`/`revokeObjectURL`/`<a>.download`/`click()`/
    `trackEvent('export_data')` 呼び出しをテストで確認
  - Verify: `npm run test -- tests/features/prices/export.test.ts` → `npm run lint` → `npm run build`
  - Files: `src/features/prices/export.ts`, `tests/features/prices/export.test.ts`
  - 依存: I20-T2 / 規模: S

- [ ] ✅ チェックポイント B: `npm run test && npm run lint` green・純粋関数のテストに DOM モック混入なし・
  `git diff tests/setup.ts` 空

## Phase 3: UI 配線

- [ ] **I20-T4: `SettingsPage.tsx` にエクスポートボタン配線**
  - 内容: `usePriceRecords()`/`useProducts()`/`useStores()`/`useBook()` を呼び、
    「データをエクスポート」ボタンで `downloadPriceRecordsCsv` を実行。`isOwner` ガードなし、
    中立スタイル、`ShareSettings` 〜 ログアウトボタン間に常設セクションとして配置
  - Acceptance: オーナー/非オーナー双方でボタン表示。クリックで正しい引数で
    `downloadPriceRecordsCsv` が呼ばれる
  - Verify: `npm run test -- tests/routes/SettingsPage.test.tsx` →
    `npm run test && npm run lint && npm run build`
  - Files: `src/routes/SettingsPage.tsx`, `tests/routes/SettingsPage.test.tsx`
  - 依存: I20-T3 / 規模: S

- [ ] ✅ 最終チェックポイント: `npm run test && npm run lint && npm run build` 全 green +
  手動スモーク(記録あり/0 件双方でダウンロード・Excel 等で文字化けなし確認)+
  `export_data` イベント発火確認 + `docs/spec-issue20.md` の Success Criteria 全達成
