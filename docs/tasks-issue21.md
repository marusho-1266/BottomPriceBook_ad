# TODO: Issue #21 オンボーディング機能

詳細: `tasks/plan.md`(= `docs/plan-issue21.md`) / 仕様: `docs/spec-issue21.md`

## Phase 1: 基盤(ロジック単体)

- [ ] I21-T1: `src/features/onboarding/storage.ts`(`hasSeenOnboarding` / `markOnboardingSeen`)(XS)+ テスト
- [ ] I21-T2: `src/features/onboarding/content.ts`(4枚分のスライド内容定数)(XS)
- [ ] ✅ チェックポイント A: test/lint green・人間レビュー(スライド文言確認)

## Phase 2: UI コンポーネント

- [ ] I21-T3: `OnboardingModal.tsx`(ページング・戻る/次へ/スキップ/はじめる)(M)+ テスト
- [ ] ✅ チェックポイント B: test/lint green・人間レビュー(見た目・遷移、任意)

## Phase 3: 配線

- [ ] I21-T4: `App.tsx`(`Gate`)への初回自動表示配線(S)+ テスト
- [ ] I21-T5: `SettingsPage.tsx`への「使い方を見る」導線配線(S)+ テスト
- [ ] test/lint/build 全 green
- [ ] 手動スモーク(ユーザー確認待ち): 自動表示・スキップ・再表示・4イベント発火の確認
- [ ] ✅ 最終チェックポイント: `spec-issue21.md` の Success Criteria 全達成
