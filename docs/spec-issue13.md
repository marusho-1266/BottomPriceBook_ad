# Spec: Issue #13 アカウント削除(退会)機能

> Status: **Implemented(実装済み・2026-07-17。デプロイと Blaze プラン切替は未実施)** / 作成: 2026-07-17
> 対象 Issue: [#13 アカウント削除(退会)機能](https://github.com/marusho-1266/BottomPriceBook_ad/issues/13)
> 親仕様: `docs/spec.md` / 関連: `docs/spec-issue7.md`(共有機能のデータモデルを前提とする)

## ヒアリング結果(2026-07-17 確定)

1. **実装方式**: Cloud Functions(Callable)+ Blaze プラン切替。
   退会は低頻度操作のため無料枠(呼び出し 200 万回/月・Firestore 削除 2 万件/日)内で実質 0 円運用
2. **共有 book の扱い**: オーナーが退会したら **book ごと削除**。
   参加中だったメンバーは次回アクセス時に自分の book へ自動フォールバック(既存挙動)。
   退会確認ダイアログで「メンバーも使えなくなる」旨を警告表示する
3. **確認 UI**: 再認証 + 削除内容を列挙した確認ダイアログ(テキスト入力確認までは行わない)

## 前提(仮定 — 誤りがあれば指摘してください)

1. 削除は **Callable Function がサーバー側(Admin SDK)で実行**する。Admin SDK はセキュリティルールを
   バイパスするため、**削除処理自体に firestore.rules の変更は不要**(`books` の `allow delete: if false` は
   クライアント直接削除の禁止として維持する)。ただし `recursiveDelete` はサブコレクション横断で
   アトミックではなく、削除中に他メンバーが書き込んだドキュメントが親を失った孤児として残る
   競合があるため、`deleting: true` フラグ + firestore.rules 側の書き込み拒否を追加した(後述)
2. Admin SDK による Auth ユーザー削除は「直近ログイン」要件の対象外だが、
   誤操作・端末貸出時の悪用防止のため **クライアント側で再認証を必須**とする
3. 参加中の他人の book に自分が記録した価格データは**削除しない**(Issue #7 の方針
   「データは book に帰属」を踏襲)。退出処理(memberUids からの除去 + members/joinTokens doc 削除)のみ行う
4. 削除順序は **Firestore データ → Auth ユーザー** の順(途中失敗時に再ログイン → 再実行で
   リトライ可能な状態を保つ。Auth を先に消すと孤児データの回収手段が失われる)
5. Functions のランタイムは Node.js 22 / TypeScript / v2 API(`onCall`)。リージョンは
   Firestore と同じ `asia-northeast1` を想定
6. 削除完了メールや猶予期間(ソフトデリート)は設けない(即時・完全削除)

## Objective

### 何を作るか

ユーザーが自分の意思でアカウントを削除(退会)し、自分に帰属するデータを完全に消せるようにする。
一般公開の前提条件(ユーザーによるデータ削除経路の確保)を満たす。

### ユーザーストーリー

- ユーザーとして、設定画面から退会し、自分のアカウントと底値帳データを完全に削除したい
- ユーザーとして、退会で何が消えるのか(自分の book・共有メンバーへの影響)を実行前に理解したい
- 共有 book のメンバーとして、オーナーが退会した場合でも自分の book でアプリを使い続けたい

## 削除対象と処理フロー

### Callable Function `deleteAccount` が削除するもの(uid = 呼び出し元)

| 対象 | 処理 |
|---|---|
| `invites`(`createdBy == uid`) | 自分が発行した招待コードを削除 |
| 参加中の他人の book(`memberUids array-contains uid` かつ `ownerUid != uid`) | `memberUids` から uid を除去 + `members/{uid}` `joinTokens/{uid}` を削除(退出。価格記録は残す) |
| 自分の book `books/{uid}` | **サブコレクション込みで再帰削除**(`firestore.recursiveDelete`)。categories / members / joinTokens / stores / products / priceRecords すべて |
| Auth ユーザー | `admin.auth().deleteUser(uid)`(最後に実行) |

### クライアント側フロー(設定画面)

1. 「アカウントを削除(退会)」ボタン → 確認ダイアログを表示
   - 削除される内容を列挙(自分の底値帳・全記録・発行済み招待、参加中 book からの退出)
   - 共有メンバーがいる場合は「メンバーもこの底値帳を使えなくなります」と警告
2. 再認証(メール: パスワード再入力 / Google: `reauthenticateWithPopup`)
3. `deleteAccount` を呼び出し、処理中はボタンを無効化してスピナー表示
4. 成功: localStorage の currentBookId をクリア → サインアウト状態になりログイン画面へ
5. 失敗: エラーメッセージ表示。再ログイン後に再実行すればリトライ可能(冪等に設計)

### 冪等性・失敗時の扱い

- Function は各ステップを「存在すれば消す」で実装し、**途中失敗後の再実行で完走できる**こと
- Auth 削除まで到達すれば以後ログイン不可となり、データも消えている(完了状態)
- Firestore 削除の途中で失敗した場合、ユーザーはまだログイン可能なので再実行を案内する

## Tech Stack(追加分)

- `firebase-functions` v7(v2 API)/ `firebase-admin`(functions/ 配下の独立 npm パッケージ)
- クライアント: `firebase/functions` の `httpsCallable`(既存 firebase パッケージに同梱。新規依存なし)
- **Firebase プロジェクトを Blaze プランへ切替**(デプロイ前に手動作業。予算アラート設定を含む)

## Commands(追加分)

```
Functions ビルド:  cd functions && npm run build
Functions テスト:  cd functions && npm test        (導入する場合)
エミュレータ:      npm run emulators               (functions エミュレータを追加)
デプロイ:          firebase deploy --only functions
既存:              npm run test / npm run test:rules / npm run lint / npm run build
```

`firebase.json` に `functions` 設定と emulators の functions ポート(5001)を追加する。

## Project Structure(追加分)

```
functions/                     → Cloud Functions(独立パッケージ)
  src/index.ts                 → deleteAccount(Callable)
  package.json / tsconfig.json
src/features/account/          → 退会機能モジュール
  api.ts                       → 再認証 + deleteAccount 呼び出し
  DeleteAccountDialog.tsx      → 確認ダイアログ(再認証 UI 含む)
src/routes/SettingsPage.tsx    → 退会ボタン追加(拡張)
tests/features/account/        → クライアント側の単体・コンポーネントテスト
```

## Code Style

親仕様 `docs/spec.md` から変更なし。functions/ も同じ Prettier / ESLint 設定に揃える。

## Testing Strategy(本 Issue 分)

| レベル | 対象 |
|---|---|
| 単体 | 再認証プロバイダ分岐(メール/Google)、エラーメッセージのマッピング |
| コンポーネント | 確認ダイアログ(警告文言・共有メンバー有無での出し分け・処理中の無効化) |
| セキュリティルール | 既存テストの回帰(ルール変更なしのため。`books` delete 禁止が維持されること) |
| Functions | エミュレータでの手動 E2E(退会 → データ消失 → メンバーのフォールバック確認)を必須とする。firebase-functions-test による単体テストは規模を見て判断 |

## Boundaries(本 Issue 固有)

- **Always**
  - 削除順序は Firestore → Auth を守る(リトライ可能性の確保)
  - Function 冒頭で `request.auth` を検証し、**自分自身のデータのみ**削除する(uid をパラメータで受け取らない)
  - 参加中 book の価格記録は削除しない(退出のみ)
  - Blaze 切替時に予算アラート(例: 月 500 円)を設定する
- **Ask first**
  - firestore.rules のさらなる変更(削除中の書き込み拒否用に `deleting` フラグ判定を
    book 本体+5 サブコレクションへ追加済み。2026-07-18 コードレビュー対応)
  - functions/ への新規依存パッケージ追加
  - 削除対象コレクションの追加・変更
- **Never**
  - クライアントから books の削除を許可するルール変更をしない
  - 他ユーザーのデータ(共有 book の他人の記録・他人の book)を削除しない
  - 削除処理のログに個人情報(メールアドレス等)を出力しない

## Success Criteria

検証は 2026-07-17、エミュレータ(Firestore/Auth/Functions)+ 自動テストで実施。
「E2E」は `tests/e2e/deleteAccount.e2e.test.ts`(実クライアント API × 実エミュレータ)。

- [x] 設定画面に退会ボタンがあり、確認ダイアログ → 再認証 → 削除が完走する
      (SettingsPage/DeleteAccountDialog のコンポーネントテスト + E2E で確認)
- [x] 退会後、同じアカウントでログインできない(Auth ユーザーが消えている)
      (E2E: 削除後の signIn が reject、`adminAuth.getUser` も reject)
- [x] 自分の book とサブコレクション(価格記録・商品・店舗・カテゴリ・members・joinTokens)が
      すべて消えている(functions/deleteAccount.test.ts で recursiveDelete を確認。
      E2E ではオーナー退会で book 本体の消滅を確認)
- [x] 自分が発行した招待コードが消えている(functions テスト + E2E オーナー退会シナリオ)
- [x] 参加中だった他人の book から退出済み(memberUids に uid が残っていない)で、
      自分が記録した価格データは残っている(functions テスト + E2E メンバー退会シナリオ)
- [x] 自分の book のメンバーだったユーザーは、次回アクセス時に自分の book へフォールバックする
      (E2E: オーナー退会後、bob の `array-contains` クエリ結果 + `resolveCurrentBookId` で確認)
- [x] 再認証に失敗した場合、削除は実行されない
      (DeleteAccountDialog / account/api の単体テストで確認。E2E では未再検証)
- [x] Firestore 削除の途中で失敗しても、再実行で完走できる(冪等)
      (functions/deleteAccount.test.ts: 2 回実行しても失敗しないテストで確認)
- [x] 既存テスト(`npm run test` / `npm run test:rules`)がすべて通る
      (215/215・84/84 でグリーン。2026-07-17 時点)
- [x] `npm run build` が通る。`npm run lint` は本 Issue の変更範囲では新規エラーなし
      (`JoinPage.tsx` に無関係の pre-existing エラーが 1 件残存。Issue #13 のスコープ外)

## 将来スコープ(本 Issue に含めない)

- book の譲渡(オーナー交代)
- 退会前のデータエクスポート
- 猶予期間付きのソフトデリート・削除完了メール
- 参加中 book に残した自分の記録の一括削除オプション

## Open Questions

- Blaze プラン切替のタイミング(実装完了後のデプロイ直前でよいか、エミュレータ開発は Spark のまま可能)
- Functions のリージョンは `asia-northeast1` でよいか(現在の Firestore ロケーションに合わせる)
