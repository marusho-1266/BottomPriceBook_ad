# TODO: Issue #20 データエクスポート(CSV等)機能

詳細: `tasks/plan.md`(= `docs/plan-issue20.md`) / 仕様: `docs/spec-issue20.md`

## Phase 1: CSV ユーティリティ(基盤)

- [x] I20-T1: `src/lib/csv.ts`(`escapeCsvField` / `buildCsv`)(XS)+ テスト
- [x] ✅ チェックポイント A: test/lint green・`csv.ts` に Firestore/DOM 依存なし

## Phase 2: エクスポートドメインロジック

- [x] I20-T2: `buildPriceRecordsCsv` / `buildExportFilename`(純粋関数、S)+ テスト
- [x] I20-T3: `downloadPriceRecordsCsv`(副作用ラッパー、S)+ テスト(`tests/setup.ts` は変更しない)
- [x] ✅ チェックポイント B: test/lint green・純粋関数のテストに DOM モック混入なし

## Phase 3: UI 配線

- [x] I20-T4: `SettingsPage.tsx` にエクスポートボタン配線(S)+ テスト
- [x] test/lint/build 全 green(319 tests / 41 files)
- [ ] 手動スモーク(ユーザー確認待ち): 実データでのダウンロード・Excel等での文字化け確認・
  `export_data` イベント発火確認
- [ ] ✅ 最終チェックポイント: spec-issue20.md の Success Criteria 全達成
