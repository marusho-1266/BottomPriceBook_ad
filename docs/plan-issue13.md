# 実装計画: アカウント削除(退会)機能(Issue #13)

> Status: **実装完了(2026-07-17)** / 作成日: 2026-07-17
> 対象仕様: `docs/spec-issue13.md`
> タスク分解: `docs/tasks-issue13.md`(次フェーズで作成)

## 方針

- **Functions のコントラクト(呼び出し名・リージョン・入出力)を最初に確定**し、
  サーバー実装とクライアント実装を独立に進められるようにする
- 削除ロジックは Callable `deleteAccount` にすべて集約。クライアントは
  「再認証 → 呼び出し → サインアウト後処理」のみを持つ
- firestore.rules は**変更しない**(Admin SDK がバイパス。ルールテストは回帰確認のみ)
- 高リスク要素(Functions エミュレータでの動作・recursiveDelete)を最初のフェーズで
  検証し、UI は動く土台の上に積む(fail fast)
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| Callable(v2 `onCall`)+ Admin SDK | ルール変更なしで安全にサブコレクション込み削除ができる唯一の経路 |
| uid はパラメータで受け取らず `request.auth.uid` のみ使用 | 他人のアカウント削除を構造的に不可能にする |
| 削除順序: invites → 参加 book 退出 → 自 book 再帰削除 → Auth 削除 | 途中失敗時もログイン可能なまま残り、再実行でリトライできる(冪等) |
| リージョン `asia-northeast1` | Firestore と同一リージョンでレイテンシ・egress を最小化 |
| functions/ は独立 npm パッケージ | Firebase 標準構成。ルートの vite ビルドと分離 |

## 主要コンポーネントと依存

```
firebase.json + functions/ scaffold(エミュレータ起動まで)
        │
        ▼
deleteAccount 実装(invites 掃除 → 退出 → recursiveDelete → Auth 削除)
        │                                    │
        ▼                                    │(コントラクト確定後は並行可)
src/lib/firebase.ts(functions インスタンス + エミュレータ接続)
        │
        ▼
src/features/account/api.ts(再認証 + httpsCallable + 後処理)
        │
        ▼
DeleteAccountDialog(確認・警告・再認証 UI・処理中状態)
        │
        ▼
SettingsPage(退会ボタン設置)
        │
        ▼
エミュレータ E2E 手動検証 + docs/spec.md 親仕様更新
```

## 実装順序(フェーズ)

### Phase 1: Functions 基盤(高リスクを先に潰す)

1. **functions/ scaffold + firebase.json 設定** — TypeScript 雛形、emulators に
   functions(5001)追加、`npm run emulators` で空の Callable が呼べるまで
2. **deleteAccount 本体** — 4 ステップの削除ロジック。冪等(「存在すれば消す」)に実装。
   エミュレータ上でシードデータを作り、手動呼び出しで全削除を確認

### Checkpoint 1
- エミュレータで deleteAccount を直接呼び、book 配下・invites・参加 book の
  memberUids・Auth ユーザーがすべて期待どおり消える/残ることを確認

### Phase 2: クライアント API

3. **src/lib/firebase.ts 拡張** — `getFunctions(app, 'asia-northeast1')` +
   `connectFunctionsEmulator`(useEmulators 時)
4. **src/features/account/api.ts** — 再認証(メール: credential 再入力 / Google:
   `reauthenticateWithPopup`)、`httpsCallable('deleteAccount')`、
   localStorage の currentBookId クリア。エラー → 日本語メッセージのマッピング。
   単体テストを同タスク内で TDD

### Phase 3: UI

5. **DeleteAccountDialog** — 削除内容の列挙、共有メンバーがいる場合の警告出し分け、
   再認証フォーム、処理中の無効化・スピナー。コンポーネントテスト
6. **SettingsPage への組み込み** — ログアウトの下に退会ボタン(危険色)を追加

### Checkpoint 2
- `npm run test` / `npm run test:rules` / `npm run lint` / `npm run build` グリーン

### Phase 4: 検証・ドキュメント

7. **エミュレータ E2E 手動検証** — Success Criteria の全項目を通し(退会完走、
   再ログイン不可、メンバーのフォールバック、途中失敗 → 再実行)
8. **親仕様・README 更新** — `docs/spec.md` に退会機能とデータ削除ポリシーを反映。
   Blaze 切替・デプロイ手順(`firebase deploy --only functions`)を記録

### Checkpoint: 完了
- Success Criteria 全項目にチェック。デプロイと Blaze 切替は人間の承認後に実施

## リスクと緩和

| リスク | 影響 | 緩和 |
|---|---|---|
| Functions エミュレータが JDK/環境依存で動かない | 高 | Phase 1 の最初に検証(fail fast)。Firestore エミュレータは JDK 21 で稼働実績あり |
| recursiveDelete の途中失敗で部分削除状態 | 中 | 冪等設計 + Auth 削除を最後にしてリトライ可能を保証。E2E で途中失敗 → 再実行を検証 |
| 再認証の UX(Google ポップアップブロック等) | 中 | エラーを握りつぶさず日本語メッセージで再試行を案内 |
| functions/ と ルートで TypeScript/ESLint 設定が乖離 | 低 | ルートの Prettier 設定を流用。lint はルート `eslint .` の対象外なら functions 側で最小構成 |
| Blaze 未切替のままデプロイして失敗 | 低 | デプロイは最終フェーズで人間の承認後。手順書に切替 + 予算アラートを明記 |

## 検証チェックポイント(要約)

| 時点 | 確認内容 |
|---|---|
| Phase 1 完了後 | エミュレータで削除の全ステップが期待どおり(消えるもの/残るもの) |
| Phase 2 完了後 | 再認証分岐・エラーマッピングの単体テストがグリーン |
| Phase 3 完了後 | ダイアログの警告出し分け・処理中状態のコンポーネントテストがグリーン |
| 全体 | Success Criteria 全項目 + 既存テスト回帰(`test` / `test:rules`)+ lint / build |

## 並行作業

- コントラクト確定後、**Task 2(Functions 本体)と Task 3-4(クライアント API)は並行可**
  (クライアント側はエミュレータの空実装に対して先に組める)
- Task 5(ダイアログ)は api.ts のインターフェースが決まれば モック注入で並行可
- Task 7-8 は直列(実装完了が前提)

## Open Questions(spec から継続)

- Blaze 切替のタイミング(提案: 実装・E2E 完了後、デプロイ直前に手動で切替)
- Functions リージョン `asia-northeast1` の最終確認
