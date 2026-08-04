# Tasks: ホーム・比較の内容量表示

> Spec: `docs/spec-quantity-on-lists.md` / Plan: `docs/plan-quantity-on-lists.md`

- [x] Task 1: `formatQuantityLabel` を追加
  - Acceptance: `{quantity}{unit}` を返す。スペースなし
  - Verify: `npm run test -- tests/lib/units.test.ts`
  - Files: `src/lib/units.ts`, `tests/lib/units.test.ts`

- [x] Task 2: ホーム(モバイル)に内容量を表示
  - Acceptance: 副行が `店舗 · 内容量 · 単価`
  - Verify: `npm run test -- tests/routes/HomePage.test.tsx`
  - Files: `src/routes/HomePage.tsx`, `tests/routes/HomePage.test.tsx`

- [x] Task 3: ホーム(PC)に内容量列を追加
  - Acceptance: 底値と店舗の間に「内容量」列があり値が表示される
  - Verify: `npm run test -- tests/routes/PcHomeDashboard.test.tsx`
  - Files: `src/components/PcHomeDashboard.tsx`, `tests/routes/PcHomeDashboard.test.tsx`

- [x] Task 4: 比較画面に内容量を表示
  - Acceptance: メタ行が `¥価格 · 内容量 · 店舗 · 日付`
  - Verify: `npm run test -- tests/routes/ComparePage.test.tsx`
  - Files: `src/routes/ComparePage.tsx`, `tests/routes/ComparePage.test.tsx`

- [x] Task 5: 親ドキュメント追随と全体検証
  - Acceptance: `docs/spec.md` / `docs/design.md` 更新。lint/test 緑
  - Verify: `npm run lint` / `npm run test`
  - Files: `docs/spec.md`, `docs/design.md`, `docs/spec-quantity-on-lists.md`(Success Criteria チェック)
