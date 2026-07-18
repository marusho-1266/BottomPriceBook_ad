# 実装計画: エラー監視・分析機能 + CI 整備(Issue #18)

> Status: **Draft(承認待ち)** / 作成日: 2026-07-18
> 対象仕様: `docs/spec-issue18.md`
> タスク分解: `docs/tasks-issue18.md`(次フェーズで作成)

## 方針

- 3 本柱(CI / Sentry / Analytics)は**相互に依存しない独立ストリーム**。
  ただし **CI を最初に整備**する — 以降の Sentry / Analytics のタスクがすべて
  CI のグリーンで検証される状態を先に作る(以後のタスクの安全網になる)
- 高リスク要素は「GitHub Actions 上で Firebase Emulator(test:rules)が動くか」。
  これを Phase 1 で最初に潰す(fail fast)
- Sentry / Analytics とも「DSN・measurementId 未設定でもアプリが壊れない」ことを
  ラッパー層で保証し、環境変数が揃わないローカル・CI 環境でも全テストが通る状態を維持する
- 手動作業(Sentry アカウント/プロジェクト作成、Firebase Analytics 有効化)は
  ユーザーに依頼するタイミングを明示し、コード実装をブロックしない順序にする
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| CI は単一ジョブ(lint → build → test → test:rules → functions)で開始 | 現状の実行時間は数分程度で並列化の複雑さに見合わない。遅くなったら分割 |
| CI の単体テストは `VITE_FIREBASE_USE_EMULATORS: 'true'` で実行 | `.env.local` の無い環境では apiKey undefined で SettingsPage.test が落ちる既知事象の回避(spec 前提) |
| test:rules は `npx firebase emulators:exec` で実行 | エミュレータの起動・終了・失敗伝播を firebase-tools に任せる。devDependencies に既存 |
| Sentry 初期化は `src/lib/sentry.ts` / `functions/src/sentry.ts` に分離 | DSN 未設定時は no-op になるガードを 1 箇所に集約。main.tsx / functions からは 1 行呼ぶだけ |
| Functions 側は捕捉 → `Sentry.flush()` → re-throw のラッパー共通化 | Cloud Functions はレスポンス後にプロセス凍結されるため flush 必須(spec 記載) |
| Analytics は `src/lib/analytics.ts` の `logEvent` ラッパー経由のみ | エミュレータ/テスト/非対応環境(`isSupported()`)のガードを集約。api.ts から SDK を直接呼ばない既存方針を踏襲 |
| カスタムイベントは fire-and-forget(失敗しても機能を妨げない) | 計測はベストエフォート。Analytics 障害で価格記録が失敗してはならない |

## 主要コンポーネントと依存

```
Phase 1: CI
  package.json engines 追記 ──▶ .github/workflows/ci.yml(lint/build/test/test:rules/functions)
                                        │
                                        ▼ (以降の全タスクの検証基盤)
Phase 2: Sentry(CI と独立、コントラクトなし)
  src/lib/sentry.ts(init + ガード)──▶ main.tsx 組み込み + ErrorBoundary
  functions/src/sentry.ts(init + flush ラッパー)──▶ index.ts / deleteAccount.ts 適用
                                        │
Phase 3: Analytics
  src/lib/analytics.ts(init ガード + logEvent ラッパー)
        └──▶ features/*/api.ts へのカスタムイベント差し込み(価格記録・共有・退会)
                                        │
                                        ▼
Phase 4: 手動セットアップ・本番検証 + docs/spec.md 親仕様更新
```

## 実装順序(フェーズ)

### Phase 1: CI(安全網を先に張る・高リスクを先に潰す)

1. **Task 1: engines 追記 + CI ワークフロー(lint / build / test)** — ルート
   `package.json` に `engines.node: 22` を追記(functions と一本化)。
   `.github/workflows/ci.yml` を作成し `npm ci → lint → build → test` まで。
   `env: VITE_FIREBASE_USE_EMULATORS: 'true'` を設定。push して Actions 上のグリーンを確認
2. **Task 2: CI に test:rules + functions を追加** — `setup-java`(JDK 21)+
   `npx firebase emulators:exec --only firestore "npm run test:rules"`。
   続けて `functions/` の `npm ci && npm run build && npm test`。Actions 上で全ステップ通過を確認

#### Checkpoint 1
- PR を作成し、Actions が自動実行され全ステップ(lint / build / test / test:rules /
  functions build+test)がグリーンになることを GitHub 上で確認
- わざと失敗するコミットを積んで赤くなる(失敗が検知される)ことも 1 度確認して revert

### Phase 2: Sentry

3. **Task 3: フロントエンド Sentry** — `@sentry/react` 追加。`src/lib/sentry.ts` に
   `initSentry()`(DSN 未設定 or エミュレータ時は no-op、`sendDefaultPii: false`、
   `environment` タグ、`beforeSend` での PII 最終防御)。`main.tsx` で呼び出し +
   `Sentry.ErrorBoundary`(または既存構成に合わせた ErrorBoundary 連携)。
   「DSN 未設定でもアプリが起動しテストが全通過」を単体テストで担保
4. **Task 4: Cloud Functions Sentry** — `@sentry/node` を `functions/` に追加。
   `functions/src/sentry.ts` に init + `captureAndFlush` ラッパー(捕捉 → flush → re-throw)。
   `deleteAccount` 等の Callable に適用。既存 functions テストの回帰確認 +
   ラッパーの単体テスト(DSN 未設定時 no-op / 例外が呼び出し元へ再スローされること)

#### Checkpoint 2
- `npm run test` / `npm run test:rules` / functions `npm test` / CI がすべてグリーン
- エミュレータ起動時に Sentry へイベントが**送信されない**ことを確認(環境分離)

### Phase 3: Analytics

5. **Task 5: Analytics 基盤** — `src/lib/firebase.ts` の本番 config に
   `measurementId: VITE_FIREBASE_MEASUREMENT_ID` を追加。`src/lib/analytics.ts` に
   `isSupported()` + エミュレータ/テスト環境ガード付きの初期化と `logEvent` ラッパー。
   jsdom(テスト環境)でクラッシュしないことを単体テストで担保
6. **Task 6: カスタムイベント差し込み** — 価格記録の追加(prices/api.ts)、
   共有の招待発行・参加(sharing/api.ts)、退会実行(account/api.ts)に
   fire-and-forget で `logEvent` を追加。イベント名・パラメータは実装時に確定し
   spec に追記。既存テストの回帰確認

#### Checkpoint 3
- 全テスト + lint + CI グリーン
- イベントに PII・価格記録の内容(商品名・価格等の自由入力値)が含まれていないことをコードレビューで確認

### Phase 4: 手動セットアップ・本番検証(ユーザー作業を含む)

7. **Task 7: 手動セットアップ(ユーザー依頼)** — Sentry 組織/プロジェクト作成と
   DSN 発行、Firebase コンソールで Analytics 有効化と `measurementId` 取得、
   `.env.local` / `functions/.env`(または `functions:secrets`)への設定。
   手順は README または docs に記載する
8. **Task 8: デプロイ + 本番動作確認 + 親仕様更新** — デプロイ後、意図的なテスト例外で
   Sentry 記録とメール通知を確認、GA4 DebugView でイベント記録を確認。
   `docs/spec.md` に Issue #18 の反映(Tech Stack / Commands / 将来スコープ)、
   `docs/spec-issue18.md` の Status を Implemented へ更新

#### Checkpoint: 完了
- `docs/spec-issue18.md` の Success Criteria が全項目チェック済み

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| GitHub Actions 上で Firebase Emulator が起動しない/不安定 | 高 | Phase 1 で最初に検証。`emulators:exec` 使用でリトライ・タイムアウトを制御。JDK 21 を明示 |
| CI で単体テストが env 不足で落ちる(auth/invalid-api-key) | 中 | 既知事象。`VITE_FIREBASE_USE_EMULATORS: 'true'` を workflow の env に設定(Task 1 に織り込み済み) |
| Sentry flush 漏れで Functions のイベントが欠落 | 中 | ラッパーに flush を組み込み、単体テストで flush 呼び出しを検証 |
| Analytics が jsdom / 非対応ブラウザでクラッシュ | 中 | `isSupported()` + 環境ガードをラッパーに集約し、テストで担保 |
| PII の意図しない送信 | 高 | `sendDefaultPii: false` + `beforeSend` フック + Checkpoint 3 でのレビュー項目化 |
| 手動作業(Sentry/GA 設定)待ちで停滞 | 低 | コード実装(Phase 1〜3)は DSN 無しで完結する設計。手動作業は Phase 4 に隔離 |

## 並列化の余地

- Phase 2(Sentry)と Phase 3(Analytics)は互いに独立しており並行可能。
  ただし単独セッションでは記載順(Sentry → Analytics)で直列に進める
- Task 3(フロント Sentry)と Task 4(Functions Sentry)も独立(別パッケージ)

## Open Questions

- Sentry のプロジェクト構成: フロントと Functions で 2 プロジェクトに分けるか、
  1 プロジェクト + タグ分離か(spec 前提 1。Task 7 の手動セットアップ時に決定でよい)
- カスタムイベントの命名規則(GA4 推奨の snake_case を想定。Task 6 で確定し spec に追記)
