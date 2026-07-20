# TODO: Issue #21 オンボーディング機能

詳細: `tasks/plan.md`(= `docs/plan-issue21.md`) / 仕様: `docs/spec-issue21.md`

## Phase 1: 基盤(ロジック単体)

- [x] I21-T1: `src/features/onboarding/storage.ts`(`hasSeenOnboarding` / `markOnboardingSeen`)(XS)+ テスト
- [x] I21-T2: `src/features/onboarding/content.ts`(4枚分のスライド内容定数)(XS)
- [x] ✅ チェックポイント A: test/lint green(人間レビュー: スライド文言は初版のまま暫定進行。実装完了後にまとめて確認)

## Phase 2: UI コンポーネント

- [x] I21-T3: `OnboardingModal.tsx`(ページング・戻る/次へ/スキップ/はじめる)(M)+ テスト
- [x] ✅ チェックポイント B: test/lint green(人間レビュー: 見た目・遷移の目視確認は手動スモークで実施予定)

## Phase 3: 配線

- [x] I21-T4: `App.tsx`(`Gate`)への初回自動表示配線(S)+ テスト
- [x] I21-T5: `SettingsPage.tsx`への「使い方を見る」導線配線(S)+ テスト
- [x] test/lint/build 全 green(334 tests / 43 files)
- [ ] 手動スモーク(ユーザー確認待ち): 自動表示・スキップ・再表示・4イベント発火の確認
- [ ] ✅ 最終チェックポイント: `spec-issue21.md` の Success Criteria 全達成
