# タスク分解: メールアドレス確認とパスワードポリシー強化(Issue #15)

> Status: **I15-T1 完了(2026-07-19)** / 作成日: 2026-07-19
> 対象: `docs/spec-issue15.md` / 計画: `docs/plan-issue15.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase 1: rules 強制

- [x] **I15-T1: firestore.rules に email_verified 検証を追加 + ルールテスト更新**
  - 内容: `request.auth != null` 判定を共通ヘルパー(例: `isVerified()` =
    `request.auth != null && request.auth.token.email_verified == true`)に集約し、
    全コレクション(invites / books とサブコレクション)の判定を置き換える。
    ルールテスト側は認証コンテキスト生成をヘルパーに集約し、既存全テストの
    トークンに `email_verified: true` を付与して回帰。
    `email_verified: false` のトークンで代表的な read/write
    (自分の book の get / priceRecords の create / invites の create)が
    deny される新規テストを追加
  - Acceptance: 未確認トークンは全コレクションで deny、確認済みトークンは従来どおり。
    既存 84 件が引き続きグリーン
  - Verify: `npm run test:rules`
  - Files: `firestore.rules`, `tests/rules/*`(認証ヘルパー + 新規テスト)
  - 依存: なし / 規模: M

### Checkpoint 1(= plan の Phase 1 完了)
- [x] `npm run test:rules` グリーン(既存94件 + 未確認 deny の新規6件 = 100件)

## Phase 2: 認証 API とバリデーション

- [ ] **I15-T2: パスワードバリデーション純関数(password.ts)**
  - 内容: `src/features/auth/password.ts` に
    `validatePasswordStrength(password: string): string | null`
    (問題なければ null、問題があれば日本語エラーメッセージ)を実装。
    条件: 8 文字以上・半角英字を含む・半角数字を含む。TDD で境界値から書く
    (7 文字 / 8 文字ちょうど・英字のみ・数字のみ・記号のみ・全角文字混じり)
  - Acceptance: 境界値テストがすべてグリーン
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/auth/password.ts`, `tests/features/auth/password.test.ts`
  - 依存: なし(I15-T1 と並行可)/ 規模: S

- [ ] **I15-T3: auth/api.ts 拡張(確認メール送信・再送・リフレッシュ)**
  - 内容:
    1. `signUpWithEmail` — `createUserWithEmailAndPassword` 成功後に
       `sendEmailVerification(userCredential.user)` を送信
    2. `resendVerificationEmail(): Promise<void>` — `auth.currentUser` に再送
    3. `refreshEmailVerification(): Promise<boolean>` — `currentUser.reload()` +
       `getIdToken(true)` を実行し、`emailVerified` を返す
    4. `src/lib/firebase.ts` で `auth.languageCode = 'ja'` を設定
    単体テスト(firebase/auth をモックし、呼び出し順・引数・戻り値を検証)
  - Acceptance: 登録成功時に必ず sendEmailVerification が呼ばれる。
    refresh は reload と強制トークン更新をセットで行い emailVerified を返す
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/auth/api.ts`, `src/lib/firebase.ts`,
    `tests/features/auth/api.test.ts`
  - 依存: なし(I15-T1/T2 と並行可)/ 規模: S

## Phase 3: UI

- [ ] **I15-T4: VerifyEmailScreen(確認待ち画面)**
  - 内容: `src/features/auth/VerifyEmailScreen.tsx` を新規作成。
    - 送信先メールアドレスの表示と案内文(迷惑メールフォルダの言及を含む)
    - 「確認しました」ボタン: `refreshEmailVerification()` →
      false なら「まだ確認できていません」を表示(確認は AuthProvider の
      user オブジェクト更新で Gate 側が再判定するため、true 時の画面遷移は
      親に任せる。必要なら `onVerified` コールバック)
    - 「確認メールを再送」ボタン: `resendVerificationEmail()` +
      送信後 60 秒無効化(残秒数表示)。`auth/too-many-requests` は日本語文言表示
    - 「ログアウト」ボタン: `signOut()`
    - LoginScreen と同じトーン(bg-cream / rounded-2xl / primary)で実装
    コンポーネントテスト(fake timers で 60 秒無効化、各ボタンの挙動、エラー表示)
  - Acceptance: 3 ボタンの挙動・クールダウン・エラー表示がテストで確認できる
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/auth/VerifyEmailScreen.tsx`,
    `tests/features/auth/VerifyEmailScreen.test.tsx`
  - 依存: I15-T3 / 規模: M

- [ ] **I15-T5: Gate に emailVerified 分岐を追加**
  - 内容: `src/App.tsx` の `Gate` を
    「loading → 未ログイン(LoginScreen)→ **未確認(VerifyEmailScreen)** →
    book 準備(ensureBook)→ アプリ」の順に変更。
    `user.emailVerified === false` の間は `ensureBook` の effect を実行しない
    (rules 強制後は permission-denied になるため)。
    reload 後の反映は、refreshEmailVerification が返した true を受けて
    再レンダリングされること(AuthProvider の user は同一参照のままの可能性が
    あるため、Gate 側で reload 完了を検知できる仕組みにする。
    例: VerifyEmailScreen の `onVerified` で local state を更新)。
    Gate のテスト: 未確認ユーザーで VerifyEmailScreen が出て ensureBook が
    呼ばれない / 確認済み(Google 含む)で従来フロー
  - Acceptance: 未確認ユーザーはアプリ本体・ensureBook に到達しない。
    確認済みユーザーとGoogle ユーザーは従来どおり
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/App.tsx`, `tests/App.test.tsx`(または既存 Gate テストの拡張)
  - 依存: I15-T4 / 規模: M

- [ ] **I15-T6: LoginScreen の登録時バリデーションとエラーメッセージ**
  - 内容: signup モードの submit 時に `validatePasswordStrength` で事前チェックし、
    NG ならリクエストせずエラー表示。パスワード欄の下に条件のヒント
    (「8 文字以上・英字と数字を含む」)を signup モードのみ表示。
    `AUTH_ERROR_MESSAGES` に `auth/password-does-not-meet-requirements` と
    `auth/too-many-requests` を追加し、`auth/weak-password` の文言を
    「8 文字以上・英字と数字を含めてください」に更新。
    コンポーネントテスト(弱いパスワードで API が呼ばれない・ヒント表示)
  - Acceptance: 弱いパスワードは登録リクエスト前に止まり、条件が画面に明示される
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/auth/LoginScreen.tsx`,
    `tests/features/auth/LoginScreen.test.tsx`
  - 依存: I15-T2 / 規模: S

### Checkpoint 2(= plan の Phase 3 完了)
- [ ] `npm run test` / `npm run test:rules` / `npm run lint` / `npm run build` グリーン

## Phase 4: E2E・ドキュメント

- [ ] **I15-T7: E2E(確認フロー完走 + 未確認 deny)**
  - 内容: `tests/e2e/emailVerification.e2e.test.ts` を新規作成
    (実クライアント API × Auth/Firestore エミュレータ。deleteAccount.e2e の構成を踏襲):
    1. メール登録 → エミュレータ REST(`/emulator/v1/projects/{id}/oobCodes`)から
       verifyEmail の oobCode を取得(= 確認メールが送られた証明)
    2. 未確認のまま自分の book を read/write → permission-denied
    3. oobCode を適用(REST または `applyActionCode`)→ reload +
       `getIdToken(true)` → emailVerified が true
    4. 確認後は book の read/write が成功(ensureBook 相当の流れが通る)
    あわせて Auth エミュレータがパスワードポリシー設定を再現できるか検証し、
    結果(可否と対応)を spec の Open Questions に反映
  - Acceptance: 上記 4 ステップがすべて自動テストで通る
  - Verify: `npm run test:e2e`(エミュレータ起動下)+ 既存 E2E の回帰
  - Files: `tests/e2e/emailVerification.e2e.test.ts`, `docs/spec-issue15.md`(OQ 更新)
  - 依存: I15-T1〜T5 / 規模: M

- [ ] **I15-T8: ドキュメント + 本番反映チェックリスト**
  - 内容: `docs/spec.md`(親仕様)に メール確認必須・パスワードポリシーを反映。
    `docs/spec-issue15.md` の Status 更新と本番反映チェックリストを記録:
    1. Firebase コンソール: パスワードポリシー設定(8 文字・英小文字・数字、強制モード)
    2. Firebase コンソール: 確認メールテンプレートの日本語化
    3. `firebase deploy --only firestore:rules`(アプリのデプロイと同時)
    ※ 1〜3 は人間の承認後に実施
  - Acceptance: 親仕様・チェックリストが最新の実装と一致している
  - Verify: 目視レビュー + `npm run test`(回帰)
  - Files: `docs/spec.md`, `docs/spec-issue15.md`, `docs/tasks-issue15.md`(進捗更新)
  - 依存: I15-T7 / 規模: S

### Checkpoint: 完了
- [ ] Success Criteria 全項目にチェック(コンソール手動設定は本番反映時に人間が実施)

## 依存関係まとめ

```
I15-T1(rules)────────────────┐
I15-T2(password.ts)──→ I15-T6 ├─→ I15-T7(E2E)─→ I15-T8(docs)
I15-T3(api)─→ I15-T4 ─→ I15-T5 ┘
```

- T1 / T2 / T3 は相互に独立(並行可)
- T4 → T5 は直列。T6 は T2 のみに依存
- T7 は実装全体(T1〜T5)完了後
