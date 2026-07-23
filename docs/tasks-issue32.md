# タスク分解: PC用レイアウト(Issue #32)

> Status: **Done** / 作成日: 2026-07-23
> 対象: `docs/spec-issue32.md` / 計画: `docs/plan-issue32.md`
> 実装は 1 タスク = 1 コミット相当で進めた。各タスクの Verify を通してから次へ。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase 1: レイアウト基盤

- [x] **I32-T1: `useIsDesktopLayout` + matchMedia テストヘルパー**
  - 内容: `(min-width: 768px)` を購読するフックと、jsdom 用 `stubMatchMedia` ヘルパーを追加
  - Acceptance: 768 相当で true / 未満で false、change で更新
  - Verify: `npm run test`
  - Files: `src/components/useIsDesktopLayout.ts`, `tests/helpers/matchMedia.ts`,
    `tests/components/useIsDesktopLayout.test.tsx`
  - 依存: なし / 規模: S

- [x] **I32-T2: `DesktopShell` + `AppShell` 幅分岐**
  - 内容: モバイルは現行ボトムタブ、デスクトップは左サイドナビ(ホーム/記録/比較/設定)+
    ブランド「そこねこ」。`OfflineBanner` は両シェルで維持
  - Acceptance: md でサイドナビ、未満でボトムタブ。ナビ遷移可
  - Verify: `npm run test && npm run lint`
  - Files: `src/components/DesktopShell.tsx`, `src/components/AppShell.tsx`,
    `tests/components/AppShell.test.tsx`
  - 依存: I32-T1 / 規模: M

### Checkpoint 1
- [x] リサイズ想定の単体/コンポーネントテストがグリーン

## Phase 2: ホーム共有ロジック → PC ダッシュボード

- [x] **I32-T3: サマリー算出の純粋関数切り出し**
  - 内容: `computeHomeSummary`(登録商品 / 今週の記録 / 底値更新)を切り出し、HomePage から利用
  - Acceptance: 定義が現行と同一。純関数テスト + HomePage 回帰
  - Verify: `npm run test`
  - Files: `src/features/prices/homeSummary.ts`, `tests/features/prices/homeSummary.test.ts`,
    `src/routes/HomePage.tsx`
  - 依存: なし / 規模: S

- [x] **I32-T4: PC ホーム — ヘッダー・サマリー・底値一覧・空状態**
  - 内容: `PcHomeDashboard`。BookSwitcher / 検索 /「価格を記録」導線、カテゴリ別テーブル、
    行選択で `selectedProductId` 更新
  - Acceptance: PC でサマリー3枚 + 一覧。モバイルホームは現行のまま
  - Verify: `npm run test && npm run lint`
  - Files: `src/components/PcHomeDashboard.tsx`, `src/routes/HomePage.tsx`,
    `src/features/sharing/BookSwitcher.tsx`, `tests/routes/PcHomeDashboard.test.tsx`,
    `tests/routes/HomePage.test.tsx`
  - 依存: I32-T1, I32-T3 / 規模: M

- [x] **I32-T5: PC 右ペイン詳細(閲覧のみ) +「詳細を開く」**
  - 内容: `PcProductDetailPane`。底値ヒーロー・店舗別・最近履歴(上限8)・未選択プレースホルダ。
    `/products/:id` へ遷移。編集・削除 UI なし
  - Acceptance: 行選択で右ペイン更新、「詳細を開く」遷移、編集 UI 非存在
  - Verify: `npm run test && npm run lint`
  - Files: `src/components/PcProductDetailPane.tsx`, `tests/routes/PcHomeDashboard.test.tsx`
  - 依存: I32-T4 / 規模: M

### Checkpoint 2
- [x] PC ホームの縦スライスが動く
- [x] モバイルホーム回帰テスト通過

## Phase 3: 他画面の収まり + 仕上げ

- [x] **I32-T6: 記録・比較・設定・商品詳細の PC 幅微調整**
  - 内容: `pt-14` → `md:pt-6`、記録画面の `md:max-w-lg`、比較/設定の余白、
    PWA 更新プロンプトのデスクトップ位置調整。電卓・比較ロジックの再設計はしない
  - Acceptance: PC シェル内で極端に狭いカラムに閉じない
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/components/SubPageHeader.tsx`, `src/components/PwaUpdatePrompt.tsx`,
    `src/routes/RecordPage.tsx`, `src/routes/ComparePage.tsx`, `src/routes/SettingsPage.tsx`,
    `src/components/DesktopShell.tsx`
  - 依存: I32-T2 / 規模: S

- [x] **I32-T7: 回帰・手動確認・docs 反映**
  - 内容: 全テスト通過、plan/tasks ドキュメント作成、spec Status 更新
  - Acceptance: Success Criteria 相当をテストで担保。docs 整備
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `docs/plan-issue32.md`, `docs/tasks-issue32.md`, `docs/spec-issue32.md`
  - 依存: I32-T5, I32-T6 / 規模: S

### Checkpoint: Complete
- [x] 既存テスト全通過
- [x] レビュー可能な状態
