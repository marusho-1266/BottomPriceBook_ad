# タスク分解: アカウント連携(メール → Google)(Issue #22)

> Status: **Draft(レビュー待ち)** / 作成日: 2026-07-22
> 対象: `docs/spec-issue22.md` / 計画: `docs/plan-issue22.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase 1: Auth API 基盤

- [x] **I22-T1: プロバイダ判定 + `mapLinkGoogleError`**
  - 内容: `hasGoogleProvider` / `hasPasswordProvider` と、仕様表どおりの
    `auth/*` → 日本語メッセージ変換を `src/features/auth/api.ts` に追加
  - Acceptance: password / google の有無判定が正しい。
    `credential-already-in-use` / `provider-already-linked` / popup キャンセル /
    `requires-recent-login` / `network-request-failed` / その他の文言が仕様どおり
  - Verify: `npm run test -- tests/features/auth/api.test.ts` → `npm run lint`
  - Files: `src/features/auth/api.ts`, `tests/features/auth/api.test.ts`
  - 依存: なし / 規模: XS

- [ ] **I22-T2: `linkGoogleAccount`**
  - 内容: `linkWithPopup(currentUser, GoogleAuthProvider)`。未ログインは reject。
    成功時 `trackEvent('account_link_google')`(引数なし)。失敗は `mapLinkGoogleError` 経由
  - Acceptance: 成功パスで `linkWithPopup` + Analytics。衝突 code がユーザー向け Error になる。
    未ログインで API を呼ばない
  - Verify: `npm run test -- tests/features/auth/api.test.ts` → `npm run lint`
  - Files: `src/features/auth/api.ts`, `tests/features/auth/api.test.ts`
  - 依存: I22-T1 / 規模: S

- [ ] ✅ チェックポイント A: `npm run test && npm run lint` green・Firestore/DOM 依存なし

## Phase 2: UI

- [ ] **I22-T3: `LinkGoogleSection`**
  - 内容: 未連携(password のみ)で連携ボタン、確認ダイアログ、エラー表示、
    `requires-recent-login` 時は `reauthenticate` 後に再試行、成功/既連携で「Google 連携済み」表示。
    Google のみユーザーにはセクション非表示
  - Acceptance: 表示分岐・確認キャンセルで API 未呼び出し・衝突メッセージ表示・
    再認証後再試行がコンポーネントテストで確認できる
  - Verify: `npm run test -- tests/features/auth/LinkGoogleSection.test.tsx` → `npm run lint`
  - Files: `src/features/auth/LinkGoogleSection.tsx`,
    `tests/features/auth/LinkGoogleSection.test.tsx`
  - 依存: I22-T2 / 規模: M

- [ ] **I22-T4: SettingsPage に連携セクション配線**
  - 内容: ログアウトボタン直前に `<LinkGoogleSection />` を配置
  - Acceptance: 設定画面にセクションが載る(テストでは子コンポーネントをモックしてよい)
  - Verify: `npm run test -- tests/routes/SettingsPage.test.tsx` →
    `npm run test && npm run lint && npm run build`
  - Files: `src/routes/SettingsPage.tsx`, `tests/routes/SettingsPage.test.tsx`
  - 依存: I22-T3 / 規模: S

- [ ] ✅ 最終チェックポイント: `npm run test && npm run lint && npm run build` 全 green +
  手動スモーク(メール→連携→Google 再ログインで同一帳面 / 別メール可 / 衝突はエラーのみ) +
  `docs/spec-issue22.md` の Success Criteria 全達成
