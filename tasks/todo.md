# TODO: Issue #14 利用規約・プライバシーポリシー

詳細: `tasks/plan.md`(= `docs/plan-issue14.md`) / 仕様: `docs/spec-issue14.md`

## Phase 1: ルーティング基盤

- [ ] T1: BrowserRouter を App 直下へ移動 + `/terms` `/privacy` 公開ルート枠(M)— `src/App.tsx`, `src/features/legal/{Terms,Privacy}Page.tsx`(仮), 公開ルートテスト新規
- [ ] T2: 利用規約・プライバシーポリシーの文面ドラフト作成 → ユーザーレビュー依頼(S・T1 と並行可)
- [ ] ✅ チェックポイント 1: 既存テスト全 green + 未ログインで公開ルート表示 + ドラフト提示済み

## Phase 2: ページ実装

- [ ] T3: PrivacyPage 本実装(M)— 文面・SubPageHeader・フォームリンク(`CONTACT_FORM_URL` 定数)+ テスト
- [ ] T4: TermsPage 本実装(S)+ テスト
- [ ] ✅ チェックポイント 2: 両ページ本文表示・テスト全 green

## Phase 3: リンク設置

- [ ] T5: LoginScreen フッターに 3 リンク(S)+ テスト
- [ ] T6: SettingsPage にメニュー 3 行(S)+ テスト
- [ ] ✅ チェックポイント 3: ログイン前後の両導線から到達可・test/lint/build 全 green

## Phase 4: 確定・手動作業

- [ ] (ユーザー)文面レビュー確定(事業者表記・制定日)
- [x] (ユーザー)Google フォーム作成・URL 共有 — `https://forms.gle/CmpLMKN9XWkxirNDA`
- [ ] T7: 確定文面反映 + フォーム URL 差し替え(XS〜S)+ 手動スモーク
- [ ] ✅ 最終チェックポイント: spec-issue14.md の Success Criteria 全達成
