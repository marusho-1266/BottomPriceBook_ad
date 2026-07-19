# Spec: Issue #15 メールアドレス確認(email verification)とパスワードポリシー強化

> Status: **実装完了(2026-07-19)。本番反映(コンソール設定・デプロイ)は人間の承認待ち** / 作成: 2026-07-19
> 対象 Issue: [#15 メールアドレス確認(email verification)がない](https://github.com/marusho-1266/BottomPriceBook_ad/issues/15)
> 親仕様: `docs/spec.md` / 関連: `docs/spec-issue13.md`(再認証・Functions の前例)

## ヒアリング結果(2026-07-19 確定)

1. **強制レベル**: クライアント側ガード(確認待ち画面)+ **firestore.rules での
   `request.auth.token.email_verified` 検証の両方**。SDK 直叩きでも未確認ユーザーは
   Firestore にアクセスできない
2. **パスワードポリシー**: **8 文字以上 + 英字 + 数字を必須**。
   Firebase コンソールのパスワードポリシー設定(サーバー側強制)と
   クライアント側バリデーションの二段構え
3. **既存の未確認メールユーザー**: 免除しない。**次回アクセス時に確認待ち画面**で
   確認メールの送信/再送を案内し、確認完了までアプリ本体に入れない

## 現状の問題(コード確認済み)

- `src/features/auth/api.ts` の `signUpWithEmail` は `createUserWithEmailAndPassword`
  を呼ぶだけで `sendEmailVerification` を送っていない → 他人のメールアドレスで登録できる
- `src/App.tsx` の `Gate` は `user != null` のみ判定し `emailVerified` を見ていない
- `firestore.rules` は全箇所 `request.auth != null` のみで `email_verified` を検証していない
- パスワードは Firebase デフォルトの 6 文字下限のまま
  (`LoginScreen` の `auth/weak-password` メッセージも「6 文字以上」)

## 前提(仮定 — 誤りがあれば指摘してください)

1. **Google ログインは対象外**。Google 経由のユーザーは `emailVerified = true` が
   自動付与されるため、確認フローはメール/パスワード登録のみが通る
2. 確認後にセキュリティルールへ `email_verified = true` が反映されるのは
   **ID トークンの再発行後**。確認待ち画面の「確認しました」ボタンで
   `user.reload()` + `getIdToken(true)` を行い、トークンを強制リフレッシュする
3. `Gate` の `ensureBook`(book 自動作成)は Firestore 書き込みを伴うため、
   **メール確認チェックを ensureBook より前**に行う(未確認のまま書き込むと
   rules 変更後は permission-denied になる)
4. 確認メールの文面・差出人は Firebase コンソールのテンプレート設定で日本語化する
   (手動作業)。クライアントでは `auth.languageCode = 'ja'` を設定して
   テンプレートの言語選択を確実にする
5. パスワードポリシーのサーバー側強制は Firebase コンソール
   (Authentication → Settings → パスワードポリシー)での手動設定。
   クライアント側は自前バリデーション(8 文字以上・英字・数字の正規表現)で
   事前チェックし、`auth/password-does-not-meet-requirements` エラーも文言マッピングに追加する
6. Auth エミュレータは実メールを送らず、OOB コード(確認リンク)を
   REST API(`/emulator/v1/projects/{id}/oobCodes`)で取得できる。E2E はこれで
   確認リンク踏破まで自動化する
7. 既存ユーザーへの影響: rules 強制により、未確認のメールユーザーは確認完了まで
   Firestore に一切アクセスできなくなる(確認待ち画面のみ表示)。
   本番ユーザーが少ない現段階で一括適用する
8. パスワード変更(既存ユーザーの弱いパスワード)は**遡及しない**。
   ポリシーは新規登録・パスワード再設定時のみ適用される(Firebase の仕様)

## Objective

### 何を作るか

メール/パスワード登録時にメールアドレスの所有確認を必須にし、
他人のメールアドレスでの登録・利用を防ぐ。あわせてパスワードの最低強度を
8 文字以上 + 英字 + 数字に引き上げる。

### ユーザーストーリー

- ユーザーとして、登録したメールアドレスに届く確認リンクを踏むだけで利用を開始したい
- ユーザーとして、確認メールが届かなかった場合に再送できてほしい
- サービス側として、他人のメールアドレスを勝手に登録された場合でも、
  そのアドレスの所有者以外はデータにアクセスできない状態にしたい

## 処理フロー

### 新規登録(メール/パスワード)

1. `LoginScreen` でパスワードをクライアント側バリデーション
   (8 文字未満・英字なし・数字なしはその場でエラー表示)
2. `signUpWithEmail`: `createUserWithEmailAndPassword` → 成功したら続けて
   `sendEmailVerification` を送信
3. ログイン状態になるが `emailVerified = false` のため、`Gate` が
   **確認待ち画面(VerifyEmailScreen)** を表示
4. ユーザーがメール内のリンクを踏む → 確認待ち画面の「確認しました」ボタンで
   `reload()` + トークンリフレッシュ → `emailVerified = true` ならアプリ本体へ
   (ここで初めて `ensureBook` が走る)

### 確認待ち画面(VerifyEmailScreen)

- 送信先メールアドレスの表示と「確認メールのリンクを開いてください」の案内
- 「確認しました」ボタン: `user.reload()` + `getIdToken(true)` → 未確認なら
  「まだ確認できていません」を表示
- 「確認メールを再送」ボタン: `sendEmailVerification`(連打防止に送信後 60 秒無効化。
  `auth/too-many-requests` の文言マッピングも追加)
- 「ログアウト」ボタン: 別アカウントでやり直せる導線
- 既存の未確認ユーザー(確認メール未受領)もこの画面に着地し、再送ボタンで受け取れる

### firestore.rules

- `request.auth != null` 判定を共通ヘルパー(例: `isVerified()`)に集約し、
  `request.auth.token.email_verified == true` を追加
- Google ユーザーは `email_verified = true` のため影響なし

## Tech Stack(追加分)

新規依存なし。`firebase/auth` の `sendEmailVerification` を追加インポートするのみ。
Cloud Functions の変更もなし。

## Commands(変更なし)

```
npm run test / npm run test:rules / npm run lint / npm run build
npm run emulators
```

## Project Structure(追加分)

```
src/features/auth/api.ts             → signUpWithEmail 拡張・resendVerification 等を追加
src/features/auth/VerifyEmailScreen.tsx → 確認待ち画面(新規)
src/features/auth/password.ts        → パスワードバリデーション(新規・純関数)
src/features/auth/LoginScreen.tsx    → 登録時バリデーション・エラーメッセージ追加
src/App.tsx                          → Gate に emailVerified 判定を追加
firestore.rules                      → email_verified 検証の追加
tests/features/auth/                 → 単体・コンポーネントテスト
tests/rules/                         → 既存ルールテストの更新(email_verified トークン)
tests/e2e/                           → 確認フローの E2E(OOB コード取得)
```

## Code Style

親仕様 `docs/spec.md` から変更なし。

## Testing Strategy(本 Issue 分)

| レベル | 対象 |
|---|---|
| 単体 | パスワードバリデーション(境界値: 7/8 文字・英字のみ・数字のみ)、エラーメッセージのマッピング |
| コンポーネント | VerifyEmailScreen(再送・確認・ログアウト・60 秒無効化)、LoginScreen の登録時バリデーション、Gate の分岐(未確認 → 確認待ち画面 / 確認済み → アプリ) |
| セキュリティルール | `email_verified: false` のトークンで各コレクションの read/write が deny、`true` で従来どおり allow(既存テスト全体の認証トークンに `email_verified: true` を付与して回帰) |
| E2E | 登録 → OOB コード取得 → 確認リンク踏破 → reload → アプリ入場。未確認のままの Firestore アクセスが deny されること |

## Boundaries(本 Issue 固有)

- **Always**
  - メール確認チェックは `ensureBook` より前に行う
  - 確認後は必ず `getIdToken(true)` でトークンをリフレッシュしてから本体へ進める
  - パスワードはクライアント・サーバー(コンソール設定)の両方で強制する
- **Ask first**
  - firestore.rules の本 Issue 範囲(email_verified 追加)を超える変更
  - 確認メール以外のメール送信(ウェルカムメール等)の追加
  - 既存ユーザーの強制パスワードリセット
- **Never**
  - クライアント側ガードのみで rules 未強制のままリリースしない
  - 確認待ち画面から Firestore への読み書きを行わない
  - ログにメールアドレス等の個人情報を出力しない

## Success Criteria

- [x] メール/パスワード登録直後に確認メールが送信される
      (E2E: エミュレータの oobCodes に verifyEmail が積まれることを確認)
- [x] 未確認ユーザーはログインしても確認待ち画面から先に進めない(Gate のテスト)
- [x] 未確認ユーザーのトークンでは Firestore の read/write が deny される(ルールテスト)
- [x] 確認リンク踏破 → 「確認しました」でアプリ本体に入れ、book が作成される
      (E2E: applyActionCode → refreshEmailVerification → ensureBook 成功まで確認)
- [x] Google ログインは従来どおり確認画面を経由せず利用できる(Gate のテスト。
      Google は emailVerified が自動 true のため影響なし)
- [x] 確認メールの再送ができ、60 秒間は再送ボタンが無効化される(コンポーネントテスト)
- [x] 7 文字・英字のみ・数字のみのパスワードは登録前にエラー表示され、
      8 文字以上 + 英字 + 数字は通る(単体テスト)
- [ ] Firebase コンソールでパスワードポリシー(8 文字・英小文字・数字)を設定済み
      (手動作業・本番反映時。下記チェックリスト参照)
- [ ] 確認メールテンプレートを日本語化済み(手動作業・本番反映時。下記チェックリスト参照)
- [x] 既存テスト(`npm run test` 274件 / `npm run test:rules` 100件)がすべて通る
- [x] `npm run build` が通り、`npm run lint` で本 Issue 範囲の新規エラーがない

## 本番反映チェックリスト(人間の承認後に実施)

- [ ] **Firebase コンソール → Authentication → Settings → パスワードポリシー**を有効化し、
      「8 文字以上」「英小文字を含む」「数字を含む」を必須(強制モード)に設定する。
      無効な既存パスワードのユーザーへの影響(次回パスワード変更時のみ適用され、
      既存ログインは即座には影響を受けない)を確認のうえ設定する
- [ ] **Firebase コンソール → Authentication → Templates → メールアドレスの確認**の
      テンプレートを日本語化する(件名・本文)。差出人名も「そこねこ」に変更する
- [ ] `firebase deploy --only firestore:rules` で `firestore.rules`(email_verified 検証)を
      本番へデプロイする。既存の未確認メールユーザーが次回アクセス時に
      確認待ち画面へ遷移すること(想定どおりの挙動)を本番切替後に確認する
- [ ] 上記デプロイ後、実際にメール/パスワードで新規登録し、確認メールが日本語で届き、
      リンクを踏むとアプリに入れることを本番環境で目視確認する

## 将来スコープ(本 Issue に含めない)

- メールアドレス変更時の再確認フロー(`verifyBeforeUpdateEmail`)
- 確認リンクのカスタムランディングページ(`handleCodeInApp` / カスタム action URL)
- 既存ユーザーへの強制パスワードリセット
- Cloud Functions(blocking functions)による登録時ドメイン制限

## Open Questions

- ~~Auth エミュレータがコンソールのパスワードポリシー設定を再現できるか~~ →
  2026-07-19 実機検証で確認: Auth エミュレータはコンソールのパスワードポリシー設定を
  再現しない(サーバー側強制の検証はできない)。クライアント側バリデーション
  (`validatePasswordStrength`)のテストで代替し、サーバー側強制は本番プロジェクトでの
  手動確認とする(I15-T8 の本番反映チェックリストに記載)
- 確認メールの action URL はデフォルト(Firebase ホストの確認ページ)のままでよいか。
  カスタムページは将来スコープとする想定

## 実装中に判明した事項(2026-07-19)

- **firestore.rules の関数評価バグ**: `isBookMemberAfterWrite()` から独立した
  `isVerified()` 関数を呼び出す実装だと、1つのトランザクション内(`ensureBook` の
  members + categories 複数件書き込み)でこの関数が複数回評価された際、Firestore
  エミュレータが無関係な match ブロックの行を指す誤った `PERMISSION_DENIED` を返す
  不具合を実機 E2E 検証で発見した。`rules-unit-testing`(`npm run test:rules`)では
  再現せず、実クライアント SDK × 実エミュレータの E2E でのみ顕在化した。
  対応: 該当関数のみ email_verified チェックをインライン展開して回避(`firestore.rules`)
- **既存 E2E ヘルパーの追随**: `tests/e2e/testUtils.ts` の `signUp()` は Admin SDK で
  メール未確認のユーザーを作成していたため、email_verified 必須化により
  `deleteAccount.owner/member.e2e.test.ts` が回帰した。Admin SDK で
  `emailVerified: true` を設定後 `getIdToken(true)` でクライアント側トークンを
  更新するよう修正(メール確認自体を検証する新規シナリオではないため)
- **functions/ の未ビルド + Node バージョン不一致**: この worktree では
  `functions/node_modules` が未インストールで、`npm install && npm run build` 後も
  functions エミュレータが「Cannot determine backend specification. Timeout」で
  `deleteAccount` をロードできない(ホスト Node 25 vs functions 想定 Node 22 の不一致)。
  Issue #15 の変更とは無関係の既存環境制約のため本 Issue では未対応。
  `deleteAccount.owner/member.e2e.test.ts` は Callable 呼び出し部分のみこの制約で
  失敗する(signUp〜joinBook〜addPriceRecord までの Firestore 操作は本 Issue の
  修正で正常に通ることを個別検証済み)
