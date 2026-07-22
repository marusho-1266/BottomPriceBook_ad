# Spec: Issue #22 アカウント連携(メール → Google)

> Status: **実装完了(手動スモーク待ち)** / 作成: 2026-07-22
> 計画: `docs/plan-issue22.md` / タスク: `docs/tasks-issue22.md`
> 対象 Issue: [#22 アカウント連携](https://github.com/marusho-1266/BottomPriceBook_ad/issues/22)
> 親仕様: `docs/spec.md`

## ヒアリング結果(2026-07-21〜22 確定)

1. **課題**: メール登録した人が、あとからログイン画面で Google を押すと**別アカウント・空の底値帳**になるのを防ぎたい
2. **導線**: **設定画面**に「Google アカウントを連携」を置く。ログイン画面での事後マージ UI は作らない
3. **メール不一致**: ログイン中のメールと Google のメールが異なっても**連携を許可**する
4. **衝突**: Google が既に別 Firebase ユーザーに紐づいている場合は**マージしない**。分かりやすいエラー案内のみ
5. **スコープ**: メール → Google の一方向のみ。Google→メール追加・連携解除・既存2アカウント統合は含めない

## 前提(仮定 — 誤りがあれば指摘してください)

1. **実装 API**: Firebase Auth の `linkWithPopup(user, new GoogleAuthProvider())` を使う。同一 `uid` に `google.com` プロバイダを追加する。Firestore / Cloud Functions / セキュリティルールの変更は不要
2. **表示条件**: `providerData` に `password` があり、かつ `google.com` が**無い**ユーザーにのみ「Google アカウントを連携」ボタンを出す。Google のみ、または既に Google 連携済みのユーザーにはボタンを出さない(連携済みなら状態表示のみ可)
3. **連携後もパスワードログインは残る**(Firebase のデフォルトどおり両プロバイダが有効)。解除 UI は作らない
4. **確認ダイアログ**: 連携ボタン押下時に、メール不一致でもよい旨を説明する確認を出す。※Google ポップアップ前には選択先メールを取得できないため、ダイアログでは具体的な `xxx@gmail.com` は出せない。連携成功後に設定画面で連携済み Google のメールを表示する
5. **再認証**: 通常は Google ポップアップ自体が認証になる。`auth/requires-recent-login` の場合のみ、既存の退会フローと同様にパスワード再入力を求めてから再試行する
6. **配置**: 設定画面のログアウトボタン付近(アカウント操作セクション)に置く
7. **Analytics**(PII なし): `account_link_google`(成功時)。失敗は必須としない(必要なら `account_link_google_failed` に error code のみ可)
8. **親仕様の「匿名認証 → アカウント連携」とは別物**。本 Issue はメール/パスワード登録済みユーザーへの Google 追加のみ
9. **ログイン画面の挙動は変えない**: 未連携のまま Google ログインすると、従来どおり別アカウントになり得る。本 Issue の対策は「設定から先に連携する」導線

## Objective

### 何を作るか

メール/パスワードで登録済みのユーザーが、設定画面から Google アカウントを同一 Firebase ユーザーに連携できる機能を追加する。連携後は Google ログインでも同じ `uid`・同じ底値帳に入れる。

### 背景・課題

Issue より:「メール登録した人が後から Google ログインに統合する導線」。
現状は Google とメールが別プロバイダの別ユーザーとして作られるため、Google ボタンを押すと空の帳面になる。設定から `linkWithPopup` で紐づければ事故を防げる。

### ユーザーストーリー

- メール登録ユーザーとして、設定から Google を連携し、次回から Google でも同じ底値帳を使いたい
- 登録メールと別の Google メールでも連携したい
- その Google が既に別アカウントで使われている場合は、データが勝手に混ざらず、理由が分かるエラーが欲しい

## Tech Stack

追加の依存パッケージなし。既存の `firebase/auth`(`linkWithPopup` / `GoogleAuthProvider`)と設定画面 UI のみ。

## Commands

既存: `npm run lint` / `npm run test` / `npm run build`(追加コマンドなし)

## Project Structure(追加・変更分)

```
src/features/auth/api.ts              → linkGoogleAccount() 等を追加
src/features/auth/LinkGoogleButton.tsx → 設定用の連携 UI(確認ダイアログ・エラー表示)
  または src/features/account/ 配下     → 退会(DeleteAccount)と並べてアカウント操作として置く場合

src/routes/SettingsPage.tsx           → 連携導線の組み込み
tests/features/auth/api.test.ts       → link 成功・衝突・キャンセル等の単体テスト
```

## Code Style

親仕様 `docs/spec.md` から変更なし。エラー文言マッピングは `LoginScreen` / `account/api.ts` と同様に `auth/*` code → 日本語メッセージへ変換する。

```ts
// features/auth/api.ts(例)
import { GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export async function linkGoogleAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('未ログインです');
  await linkWithPopup(user, new GoogleAuthProvider());
}

export function hasGoogleProvider(user: { providerData: { providerId: string }[] }): boolean {
  return user.providerData.some((p) => p.providerId === 'google.com');
}

export function hasPasswordProvider(user: { providerData: { providerId: string }[] }): boolean {
  return user.providerData.some((p) => p.providerId === 'password');
}
```

主なエラー文言(案):

| code | 表示 |
|---|---|
| `auth/credential-already-in-use` | この Google アカウントは既に別のユーザーで使われています。そのアカウントでログインするか、別の Google を選んでください |
| `auth/provider-already-linked` | すでに Google アカウントが連携されています |
| `auth/popup-closed-by-user` / `auth/cancelled-popup-request` | 連携がキャンセルされました |
| `auth/requires-recent-login` | セキュリティのため再認証が必要です。パスワードを入力してから再度お試しください |
| `auth/network-request-failed` | ネットワークエラーが発生しました。もう一度お試しください |
| その他 | 連携に失敗しました。時間をおいて再度お試しください |

## Testing Strategy

| レベル | 対象 |
|---|---|
| 単体 | `linkGoogleAccount` が `linkWithPopup` を呼ぶこと。`hasGoogleProvider` / `hasPasswordProvider`。エラー code → 文言マッピング |
| コンポーネント | 未連携(password のみ)でボタン表示、連携済みで非表示または「連携済み」、確認キャンセルで API 未呼び出し、衝突エラー表示 |
| 手動 | メール登録 → 設定で Google 連携 → ログアウト → Google ログインで同じ底値帳に戻る。別メール Google でも可。既に別 uid で使っている Google ではエラーのみ |

## Boundaries

- **Always**
  - 同一 `uid` へのプロバイダ追加のみ行う(データ移行・マージを書かない)
  - Analytics / ログにメールアドレス等の PII を載せない
  - 既存の Google ログイン・メールログイン・退会フローを壊さない
- **Ask first**
  - ログイン画面側で「この Google は別アカウントです。マージしますか？」等の事後統合 UI を足す場合
  - 連携解除・Google→メール/パスワード追加をスコープに入れる場合
  - `auth/credential-already-in-use` 時に `fetchSignInMethodsForEmail` 等で誘導を強化する場合
- **Never**
  - 別 `uid` の Firestore データを自動マージしない
  - 匿名認証からの昇格フローを本 Issue で実装しない

## Success Criteria

- [x] メール/パスワードのみのユーザーの設定画面に「Google アカウントを連携」が表示される
- [ ] 確認 → Google ポップアップ → 成功後、`providerData` に `google.com` が含まれる(手動)
- [ ] 登録メールと異なる Google メールでも連携できる(手動)
- [ ] 連携後、ログアウトして Google ログインすると同じ `uid`・同じ底値帳に入れる(手動)
- [ ] 連携後もメール/パスワードでログインできる(手動)
- [x] 既に別ユーザーで使われている Google ではマージされず、上記の衝突メッセージが出る(単体/コンポーネント)
- [x] Google のみ、または既連携ユーザーには連携ボタンが出ない(または連携済み表示のみ)
- [x] 既存テスト(`npm run lint` / `npm run test` / `npm run build`)が通る

## 将来スコープ(本 Issue に含めない)

- Google → メール/パスワード追加
- 連携解除
- 既存2アカウントの自動マージ・データ移行
- ログイン画面での衝突検知・統合ウィザード
- 匿名認証 → アカウント連携(親仕様の将来スコープ)

## Open Questions

なし(ヒアリングにより主要な論点は確定済み。上記「前提」の誤り指摘があれば更新する)
