# TODO: Issue #7 底値帳の共有機能

詳細: `tasks/plan.md` / 仕様: `docs/spec-issue7.md`

## Phase 1: セキュリティルール(TDD・直列)

- [x] T1: invites コレクションのルール(M)— `firestore.rules`, `tests/rules/invites.rules.test.ts`
- [x] T2: join バッチ + members サブコレクションのルール(M・最重要スパイク)— `firestore.rules`, `tests/rules/join.rules.test.ts`
- [x] T3: 退出・メンバー削除ルール(S)— `firestore.rules`, `tests/rules/leave.rules.test.ts`
- [x] ✅ チェックポイント 1: `npm run test:rules` 全 green(64 件)

## Phase 2: データ層(T4 ∥ T5)

- [x] T4: 型定義 + `src/features/sharing/api.ts`(M)
- [x] T5: ensureBook 拡張 — オーナー members doc の冪等補完(S)

## Phase 3: 切替基盤

- [x] T6: BookProvider の currentBookId 対応(M)— 既存テスト無修正 green が条件(App.test は firestore モックに where 追加のみ)
- [ ] ✅ チェックポイント 2: test / test:rules / lint / build 全 green + 手動スモーク

## Phase 4: UI(T7 ∥ T8 ∥ T10、T9 は T8 の後)

- [x] T7: JoinPage + `/join/:inviteCode` ルート(M)
- [x] T8: 共有設定(自分の book): 招待発行・メンバー一覧・削除 + ConfirmDialog 新規(M)
- [x] T9: 共有設定(参加中の book): 退出 + オーナー限定編集(S)
- [ ] T10: ホームの book 切替 UI(M)

## Phase 5: 統合検証

- [ ] T11: E2E 手動検証(2 アカウント)+ 最終回帰(S)
- [ ] ✅ チェックポイント 3(リリース): rules 先行デプロイ → アプリデプロイ → 本番で join を 1 回確認
