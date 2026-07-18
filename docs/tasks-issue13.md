# タスク分解: アカウント削除(退会)機能(Issue #13)

> Status: **I13-T1〜T8 完了(2026-07-17)。本番デプロイと Blaze 切替は未実施(人間の承認待ち)** / 作成日: 2026-07-17
> 対象: `docs/spec-issue13.md` / 計画: `docs/plan-issue13.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase 1: Functions 基盤

- [x] **I13-T1: functions/ scaffold + firebase.json 設定**
  - 内容: `functions/` を独立 npm パッケージとして新設
    (`package.json` / `tsconfig.json` / `src/index.ts`)。
    `firebase-functions` v7(v2 API)と `firebase-admin` を導入し、
    リージョン `asia-northeast1` で**空の Callable `deleteAccount`**
    (auth 検証のみ → `{ ok: true }` を返す)をエクスポートする。
    `firebase.json` に `functions` 設定と emulators の functions ポート(5001)を追加。
    ここでコントラクト(関数名・リージョン・入力なし・出力 `{ ok: boolean }`)を確定する
  - Acceptance: `npm run emulators` で functions エミュレータが起動し、
    空の deleteAccount がエミュレータ UI / curl 相当で呼び出せる。
    未認証呼び出しは `unauthenticated` エラーになる
  - Verify: `cd functions && npm run build` + エミュレータ起動確認 +
    ルートの `npm run test && npm run lint`(回帰)
  - Files: `functions/package.json`, `functions/tsconfig.json`,
    `functions/src/index.ts`, `firebase.json`, `.gitignore`(functions/lib 等)
  - 依存: なし / 規模: M

- [x] **I13-T2: deleteAccount 本体(削除ロジック 4 ステップ)**
  - 内容: `request.auth.uid` を起点に以下を順に実行する(uid は引数で受け取らない):
    1. `invites` の `createdBy == uid` を全削除
    2. `memberUids array-contains uid` かつ `ownerUid != uid` の book すべてから退出
       (`memberUids` から uid を除去 + `members/{uid}` `joinTokens/{uid}` を削除)
    3. `books/{uid}` を `firestore.recursiveDelete` でサブコレクション込み削除
    4. `admin.auth().deleteUser(uid)`(最後。冪等のため user-not-found は握りつぶす)
    全ステップを「存在すれば消す」で実装し、途中失敗後の再実行で完走できること。
    ログに uid 以外の個人情報(メール等)を出さない
  - Acceptance: エミュレータにシードデータ
    (自 book + 全サブコレクション、発行済み invite、参加中の他人 book)を用意し、
    手動呼び出しで「消えるもの」がすべて消え、
    「残るもの」(参加先 book 本体・自分が参加先に記録した priceRecords)が残る。
    2 回目の呼び出しもエラーにならない(冪等)
  - Verify: 上記のエミュレータ手動検証(Checkpoint 1)+
    `cd functions && npm run build` + ルート `npm run test && npm run lint`
  - Files: `functions/src/index.ts`(必要なら `functions/src/deleteAccount.ts` に分離)
  - 依存: I13-T1 / 規模: M

### Checkpoint 1(= plan の Phase 1 完了)
- [x] エミュレータで削除の全ステップが期待どおり(消えるもの/残るもの/冪等性)

## Phase 2: クライアント API

- [x] **I13-T3: src/lib/firebase.ts に functions インスタンス追加**
  - 内容: `getFunctions(app, 'asia-northeast1')` を export し、
    `useEmulators` 時は `connectFunctionsEmulator(functions, '127.0.0.1', 5001)` を接続する
  - Acceptance: 既存の auth / db の初期化に影響がない(全既存テストが通る)
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/lib/firebase.ts`
  - 依存: I13-T1(ポート・リージョンのコントラクト)/ 規模: XS

- [x] **I13-T4: src/features/account/api.ts(再認証 + 呼び出し + 後処理)**
  - 内容: 以下を提供する(TDD: テストを先に書く):
    - `reauthenticate(password?)`: プロバイダ判定。メール/パスワードは
      `reauthenticateWithCredential`、Google は `reauthenticateWithPopup`
    - `deleteAccount()`: `httpsCallable('deleteAccount')` 呼び出し →
      成功時に localStorage の currentBookId をクリア
    - エラー → 日本語メッセージのマッピング
      (`wrong-password` / `popup-closed-by-user` / `unauthenticated` /
      ネットワークエラー / その他)
  - Acceptance: 再認証のプロバイダ分岐、成功時の localStorage クリア、
    エラーマッピングが単体テスト(Firebase モック)でグリーン
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/account/api.ts`, `tests/features/account/api.test.ts`
  - 依存: I13-T3 / 規模: M

## Phase 3: UI

- [x] **I13-T5: DeleteAccountDialog(確認 + 再認証 UI)**
  - 内容: 確認ダイアログコンポーネントを新設:
    - 削除される内容の列挙(自分の底値帳と全記録・発行済み招待・参加中 book からの退出)
    - 自 book に自分以外のメンバーがいる場合のみ
      「メンバーもこの底値帳を使えなくなります」警告を表示
    - 再認証フォーム(メール: パスワード入力欄 / Google: 再認証ボタン)
    - 実行中はボタン無効化 + スピナー。エラーは日本語で表示し再試行可能
    - 既存ダイアログ(ShareSettings の確認ダイアログ)のフォーカス処理・
      スタイルパターンを踏襲する
  - Acceptance: コンポーネントテストで「警告の出し分け(メンバー有無)」
    「再認証失敗時は削除 API を呼ばない」「実行中の無効化」「エラー表示」がグリーン
  - Verify: `npm run test && npm run lint`
  - Files: `src/features/account/DeleteAccountDialog.tsx`,
    `tests/features/account/DeleteAccountDialog.test.tsx`
  - 依存: I13-T4(api のインターフェース。モック注入で並行着手可)/ 規模: M

- [x] **I13-T6: SettingsPage への退会ボタン組み込み**
  - 内容: ログアウトボタンの下に「アカウントを削除(退会)」ボタン(危険色)を追加し、
    DeleteAccountDialog を開く。削除成功後は Auth 状態変化により
    ログイン画面へ遷移する(既存の auth guard 挙動を利用)。
    SettingsPage のテストにボタン表示・ダイアログ起動を追加
  - Acceptance: 設定画面から退会フローが起動できる。
    既存の SettingsPage テストが回帰しない
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/routes/SettingsPage.tsx`,
    `tests/routes/SettingsPage.test.tsx`(既存テストの場所に合わせる)
  - 依存: I13-T5 / 規模: S

### Checkpoint 2(= plan の Phase 3 完了)
- [x] `npm run test` / `npm run test:rules` / `npm run lint` / `npm run build` すべてグリーン

## Phase 4: 検証・ドキュメント

- [x] **I13-T7: エミュレータ E2E 手動検証(Success Criteria 通し)**
  - 内容: エミュレータ環境で spec の Success Criteria を通しで検証する:
    退会フロー完走 / 再ログイン不可 / データ消失(book 配下全サブコレクション・invites)/
    参加先の記録は残る / メンバーのフォールバック / 再認証失敗時は削除されない /
    途中失敗 → 再実行の冪等性。結果を spec の Success Criteria にチェックとして記録
  - Acceptance: Success Criteria の全項目にチェックが付く(未達があれば修正タスクを起票)
  - Verify: 手動検証チェックリストの完了 + 既存テスト回帰
  - Files: `docs/spec-issue13.md`(チェック記入)
  - 依存: I13-T2, I13-T6 / 規模: S

- [x] **I13-T8: 親仕様・デプロイ手順の更新**
  - 内容: `docs/spec.md` に退会機能とデータ削除ポリシー
    (book ごと削除・参加先の記録は残る)を反映。
    README または docs にデプロイ手順(Blaze 切替 + 予算アラート設定 →
    `firebase deploy --only functions`)を記録。
    spec / plan / tasks の Status を実装完了に更新
  - Acceptance: 親仕様と issue13 仕様が矛盾しない。
    Blaze 切替を含むデプロイ手順が人間だけで実行できる粒度で書かれている
  - Verify: ドキュメント差分の目視 + `npm run test && npm run lint`
  - Files: `docs/spec.md`, `README.md`(または docs 配下)、
    `docs/spec-issue13.md`, `docs/plan-issue13.md`, `docs/tasks-issue13.md`(Status 更新)
  - 依存: I13-T7 / 規模: S

### Checkpoint: 完了
- [x] Success Criteria 全項目チェック済み・全 Verify グリーン
- [ ] 本番デプロイと Blaze 切替は**人間の承認後**に実施(タスク外・未実施)

---

## 依存関係まとめ

```
T1 ──→ T2 ──────────────┐
 └──→ T3 ──→ T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8
```

- T2(Functions 本体)と T3〜T5(クライアント側)はコントラクト確定後に並行可
- T7 は T2 と T6 の両方が前提
