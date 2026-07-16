# 実装計画: Issue #7 底値帳の共有機能

## Context

Issue #7「複数ユーザー間での共有機能が欲しい」に対し、`docs/spec-issue7.md`(ヒアリング済みドラフト)で仕様を確定した:
**招待コード/リンク方式(サーバーレス・Firestore ルールのみ)/ 全メンバー読み書き可 / 自分の book に招待(book 切替 UI 追加)/ オーナー削除+本人退出対応**。
既存データモデル(`books/{bookId}` + `memberUids`)は当初から共有を見据えた設計のため移行は不要。本計画はその実装手順。

承認後、この計画を `tasks/plan.md`(計画全文)と `tasks/todo.md`(チェックリスト)としてリポジトリに保存してから実装に入る。

## アーキテクチャ上の重要判断

1. **book 切替は `key={currentBookId}` によるサブツリー再マウント**で実現。
   `src/lib/firestoreHooks.ts` の購読は `[query === null]` 依存で query 変更では再購読されないため、フック改修(全 feature 回帰リスク)を避け、既存の `<BookProvider key={user.uid}>` と同じ再マウントパターンを踏襲する。
2. **現在の book はリストクエリ由来にする**: `query(books, where('memberUids','array-contains', uid))` を購読し、`currentBookId`(localStorage キー `sokoneko:currentBookId:${uid}`)がリストに無ければ自 book(uid)へフォールバック。メンバー削除時は「クエリ結果から消える→フォールバック→key 変更で再マウント」となり、onSnapshot の permission-denied ハンドリング(現状エラーコールバック無し)に依存しない。
3. **join は 1 バッチ書き込み**: ① `books/{bookId}/members/{uid}` create(inviteCode 格納)② `books/{bookId}` update(memberUids に arrayUnion(自uid))。ルールは `getAfter()` で members doc のコードを読み `get(invites/{code})` で bookId 一致+期限内を検証。
   - フォールバック案(T2 で emulator 挙動が期待と異なる場合): invite 検証を members create ルール側に寄せ、book update 側は「getAfter で自分の members doc が存在」の検証に緩める(バッチは全承認/全拒否なので安全性は同等)。
4. **`useBook()` は後方互換で拡張**: `{ bookId, book }` はそのまま、`books` / `isOwner` / `setCurrentBookId` を追加 → 既存消費側は無修正。
5. **`/join/:inviteCode` は Gate → BookProvider 配下、AppShell の兄弟 Route**(タブバー無し)。未ログイン時は URL がアドレスバーに保持され、ログイン後に自然に join 画面へ戻る(Gate は Router 外で LoginScreen を出すため)。
6. **expiresAt はクライアント計算(now + 7日)**、create ルールで「未来かつ +8 日以内」を検証(時計ずれ許容)。参加可否の最終判定は常にルール側 `request.time < expiresAt`。

## タスク一覧

依存グラフ: T1 → T2 → T3 → (T4 ∥ T5) → T6 → (T7 ∥ T8 ∥ T10), T8 → T9 → T11

### Phase 1: セキュリティルール(TDD — テスト先行。`npm run emulators` を起動して作業)

- [ ] **T1: invites コレクションのルール**(M)
  - `tests/rules/invites.rules.test.ts` を先に書く → `firestore.rules` に `match /invites/{inviteCode}` 追加
  - create: 対象 book のオーナーのみ + bookId/createdBy/expiresAt 整合検証。get: 認証済のみ可。**list 不可**。delete: 発行者のみ。update: 不可
  - 受け入れ: 新規+既存の `npm run test:rules` 全 green
  - ファイル: `firestore.rules`, `tests/rules/invites.rules.test.ts`

- [ ] **T2: join バッチ + members サブコレクションのルール**(M)⚠️ 最重要スパイク
  - `tests/rules/join.rules.test.ts` 先行 → `match /members/{memberUid}` + books update に「自分自身の参加」分岐
  - members create: 本人 + (有効 invite を持つ or 既にメンバー[T5 補完用])。delete: 本人 or オーナー。update: 不可
  - 参加分岐: memberUids 差分が「自 uid 追加のみ」+ getAfter/get 検証 + 他フィールド不変
  - テスト: 有効コード join 成功 / コード無し・期限切れ・他 book・存在しないコード拒否 / 他人 uid 追加拒否 / 同時の name 変更拒否 / **array-contains リストクエリが通る** / 非メンバー読み取り不可の回帰
  - getAfter が期待通り動かない場合は上記フォールバック案へ(タイムボックス)
  - ファイル: `firestore.rules`, `tests/rules/join.rules.test.ts`

- [ ] **T3: 退出・メンバー削除ルール**(S)
  - 「自分自身の退出」分岐(自 uid 除去のみ + 非オーナー + 他フィールド不変)。オーナー削除は既存ルールをテストで固定化
  - ファイル: `firestore.rules`, `tests/rules/leave.rules.test.ts`

**✅ チェックポイント 1**: `npm run test:rules` 全 green(ルールのデプロイはまだしない)

### Phase 2: データ層(T4 ∥ T5 並列可)

- [ ] **T4: 型定義 + sharing/api.ts**(M)
  - `Invite` / `Member` 型追加。`createInvite`(自動ID・7日期限・`INVITE_TTL_DAYS` 定数)/ `fetchInvite`(**getDocFromServer** — オフラインキャッシュの stale invite 防止)/ `isInviteValid`(純関数)/ `joinBook`(writeBatch)/ `leaveBook` / `removeMember`(members doc 掃除込み)/ `buildInviteUrl`
  - テスト: 単体(`tests/features/sharing/api.test.ts`)+ 実 API をエミュレータで通す統合(`tests/rules/sharingApi.rules.test.ts`、ensureBook.test.ts と同パターン)
  - 招待コードを console.log しない(Boundaries)
  - ファイル: `src/types/models.ts`, `src/features/sharing/api.ts`, テスト2本

- [ ] **T5: ensureBook 拡張 — オーナー members doc の冪等補完**(S)
  - 新規作成時に members doc 同時 set / 既存 book はログイン時補完(上書きしない)。シグネチャに displayName(`user.displayName ?? user.email`)追加、Gate から渡す
  - ファイル: `src/features/books/api.ts`, `src/App.tsx`, `tests/rules/ensureBook.test.ts`

### Phase 3: 切替基盤(回帰リスク最大 — 単独で慎重に)

- [ ] **T6: BookProvider の currentBookId 対応**(M)
  - array-contains 購読 + `resolveCurrentBookId(books, storedId, uid)` 純関数 + localStorage + `<Fragment key={currentBookId}>` + `{ books, isOwner, setCurrentBookId }` 追加(後方互換)
  - 受け入れ: 新テスト green + **既存 `npm run test` が無修正で green** + `npm run dev` 手動スモーク
  - ファイル: `src/features/books/BookProvider.tsx`, `tests/features/books/BookProvider.test.tsx`

**✅ チェックポイント 2**: `npm run test` / `npm run test:rules` / `npm run lint` / `npm run build` 全 green + 既存機能スモーク

### Phase 4: UI 垂直スライス(T7 ∥ T8 ∥ T10 並列可)

- [ ] **T7: JoinPage + `/join/:inviteCode` ルート**(M)
  - AppShell の兄弟 Route。book 名・期限表示 → 参加 → `setCurrentBookId` + `navigate('/')`。無効/期限切れエラー表示、オフライン時は参加ボタン無効化、参加済みなら切替導線のみ
  - ファイル: `src/features/sharing/JoinPage.tsx`, `src/App.tsx`, `tests/features/sharing/JoinPage.test.tsx`

- [ ] **T8: 共有設定(自分の book)**(M)
  - `ConfirmDialog` 新規作成(既存に無し)。ShareSettings: 招待リンク発行(clipboard コピー・期限表示)+ メンバー一覧(memberUids 基準で行を作り members doc 突合、無ければ「(名前未設定)」)+ 削除(確認ダイアログ)
  - ファイル: `src/components/ConfirmDialog.tsx`, `src/features/sharing/ShareSettings.tsx`, `src/routes/SettingsPage.tsx`, `tests/features/sharing/ShareSettings.test.tsx`

- [ ] **T9: 共有設定(参加中の book)+ オーナー限定編集**(S)
  - 非オーナー分岐: 一覧閲覧 + 退出。SettingsPage の book 名・底値期間編集を isOwner 時のみ表示
  - ファイル: `src/features/sharing/ShareSettings.tsx`, `src/routes/SettingsPage.tsx`, テスト

- [ ] **T10: ホームの book 切替 UI**(M)
  - HomePage ヘッダーの `<h1>そこねこ</h1>` を book 名+切替トリガーに置換、`PickerSheet` 流用。1 冊のみなら従来表示
  - ファイル: `src/features/sharing/BookSwitcher.tsx`, `src/routes/HomePage.tsx`, テスト

### Phase 5: 統合検証

- [ ] **T11: E2E 手動検証 + 最終回帰**(S)
  - emulator + 2 アカウントで Success Criteria を全件実施(発行→参加→切替→参加先で記録→削除→フォールバック→退出→期限切れエラー)
  - `npm run test` / `test:rules` / `lint` / `build` 全 green

**✅ チェックポイント 3(リリース)**: rules を**アプリより先に**デプロイ(`firebase deploy --only firestore:rules` → その後 `npm run deploy`)。本番 Firestore でも join を 1 回手動確認(emulator と getAfter の挙動差ケア)

## リスクと対策(要点)

| リスク | 対策 |
|---|---|
| join の getAfter+get ルールが emulator/本番で動かない | T2 を最初期スパイク化。フォールバック案(invite 検証を members create 側へ)を用意。本番でも 1 回手動確認 |
| BookProvider 拡張の既存回帰 | useBook 後方互換 + 既存テスト無修正 green を受け入れ基準に + key 再マウント方式でフック無改修 |
| 削除されたメンバーの permission-denied | 現在 book をリストクエリ由来に(エラーでなく結果から消える)。console 警告は許容、T11 で実挙動確認 |
| オフラインでの join / stale invite | getDocFromServer + navigator.onLine でボタン無効化 |
| firestore.rules が T1-T3+T5 のホットスポット | Phase 1 は直列実行 |

## 検証方法

- ルール: `npm run emulators`(別ターミナル)+ `npm run test:rules`
- 単体/コンポーネント: `npm run test`(既存パターン: useBook 等を vi.mock、MemoryRouter)
- E2E: `npm run dev` + emulator、2 ブラウザプロファイルで招待→参加→記録→削除/退出を実操作
- 最終: `npm run lint` / `npm run build`
