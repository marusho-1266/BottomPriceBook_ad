# タスク分解: エラー監視・分析機能 + CI 整備(Issue #18)

> Status: **Draft(承認待ち)** / 作成日: 2026-07-18
> 対象: `docs/spec-issue18.md` / 計画: `docs/plan-issue18.md`
> 実装は 1 タスク = 1 コミット。各タスクの Verify を通してから次へ進む。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase 1: CI(安全網を先に張る)

- [x] **I18-T1: engines 追記 + CI ワークフロー(lint / build / test)**
  - 内容: ルート `package.json` に `engines: { "node": "22" }` を追記
    (functions/package.json と参照元を一本化)。
    `.github/workflows/ci.yml` を新規作成:
    - トリガー: `push`(main)+ `pull_request`(全ブランチ)
    - `actions/checkout` → `actions/setup-node`(Node 22・npm キャッシュ有効)→
      `npm ci` → `npm run lint` → `npm run build` → `npm run test`
    - ジョブの `env:` に `VITE_FIREBASE_USE_EMULATORS: 'true'` を設定
      (`.env.local` の無い CI では apiKey undefined → `auth/invalid-api-key` で
      SettingsPage.test 等が落ちる既知事象の回避)
  - Acceptance: ブランチを push すると Actions が起動し、
    lint / build / test の全ステップがグリーンになる
  - Verify: ローカルで `npm run lint && npm run build && npm run test` +
    GitHub Actions の実行結果を目視確認
  - Files: `.github/workflows/ci.yml`, `package.json`
  - 依存: なし / 規模: S

- [x] **I18-T2: CI に test:rules + functions ビルド/テストを追加**
  - 内容: ci.yml に以下のステップを追加:
    - `actions/setup-java`(Temurin JDK 21。Firestore Emulator 用)
    - `npx firebase emulators:exec --only firestore --project demo-sokoneko
      "npm run test:rules"`(firebase-tools は devDependencies に既存。追加不要)
    - `cd functions && npm ci && npm run build && npm test`
      (型エラー検知 + deleteAccount 等のサーバー側テスト)
    - エミュレータ初回ダウンロードの分だけ実行時間が延びるため、
      `~/.cache/firebase/emulators` のキャッシュ(`actions/cache`)を検討・導入
  - Acceptance: Actions 上で test:rules(84 件)と functions のビルド・テストが
    グリーンになる。全体の実行時間が 10 分以内に収まる
  - Verify: GitHub Actions の実行結果を目視確認 +
    ローカルで `npm run test:rules` の回帰確認
  - Files: `.github/workflows/ci.yml`
  - 依存: I18-T1 / 規模: S

### Checkpoint 1(= plan の Phase 1 完了)
- [ ] PR を作成し、全ステップ(lint / build / test / test:rules / functions)が
  自動実行されグリーンになることを PR 画面で確認
- [ ] わざと失敗するコミットで CI が赤くなる(失敗が検知される)ことを 1 度確認して revert

## Phase 2: Sentry

- [x] **I18-T3: フロントエンド Sentry(init + ErrorBoundary)**
  - 内容: `@sentry/react` を依存に追加。`src/lib/sentry.ts` に `initSentry()` を実装:
    - `VITE_SENTRY_DSN` 未設定、またはエミュレータ利用時
      (`VITE_FIREBASE_USE_EMULATORS === 'true'`)は **no-op**(init しない)
    - `sendDefaultPii: false` / `environment: 'production'` /
      `tracesSampleRate` は控えめな値(例: 0.1)
    - `beforeSend` フックで PII(メールアドレスパターン等)の最終防御マスク
    - `main.tsx` の先頭で `initSentry()` を呼び、アプリを
      `Sentry.ErrorBoundary`(日本語のフォールバック UI)でラップ
  - Acceptance: 単体テストで「DSN 未設定でも init がクラッシュしない」
    「エミュレータ時は init されない」「beforeSend がメールアドレスをマスクする」が
    グリーン。既存テスト全通過(jsdom 環境で Sentry が邪魔をしない)
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/lib/sentry.ts`, `src/main.tsx`,
    `tests/lib/sentry.test.ts`, `package.json`
  - 依存: なし(CI 完了後を推奨)/ 規模: M

- [x] **I18-T4: Cloud Functions Sentry(init + flush ラッパー)**
  - 内容: `@sentry/node` を `functions/` の依存に追加。
    `functions/src/sentry.ts` を実装:
    - `SENTRY_DSN`(`functions/.env` または `functions:secrets`)未設定時は no-op
    - `withSentry(handler)` ラッパー: 例外を `captureException` →
      `Sentry.flush(timeout)` で送信完了を待つ → **例外は必ず re-throw**
      (クライアントへのエラー返却を変えない)
    - `index.ts` の Callable(deleteAccount)にラッパーを適用
    - ログ・イベントに uid 以外の個人情報を含めない(既存方針の踏襲)
  - Acceptance: functions の単体テストで「DSN 未設定時 no-op」
    「例外時に capture + flush が呼ばれ、例外が再スローされる」がグリーン。
    既存の deleteAccount テストが回帰しない
  - Verify: `cd functions && npm run build && npm test` +
    ルート `npm run test && npm run lint`
  - Files: `functions/src/sentry.ts`, `functions/src/index.ts`,
    `functions/src/sentry.test.ts`, `functions/package.json`
  - 依存: なし(I18-T3 と並行可)/ 規模: M

### Checkpoint 2(= plan の Phase 2 完了)
- [ ] `npm run test` / `npm run test:rules` / functions `npm test` / CI がすべてグリーン
- [ ] エミュレータ起動時に Sentry へイベントが送信されないことを確認(環境分離)

## Phase 3: Analytics

- [x] **I18-T5: Analytics 基盤(init ガード + logEvent ラッパー)**
  - 内容:
    - `src/lib/firebase.ts` の本番用 firebaseConfig に
      `measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID` を追加
      (エミュレータ用 demo config には追加しない)
    - `src/lib/analytics.ts` を新設:
      - エミュレータ利用時・`measurementId` 未設定時は初期化しない
      - `isSupported()` で対応環境か確認してから `getAnalytics()`
        (jsdom 等の非対応環境でのクラッシュ防止)
      - `trackEvent(name, params?)` ラッパー: 未初期化なら黙って何もしない。
        例外は握りつぶす(fire-and-forget。計測失敗が機能を妨げない)
  - Acceptance: 単体テストで「未初期化時に trackEvent がクラッシュしない」
    「エミュレータ時は初期化されない」がグリーン。既存テスト全通過
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/lib/firebase.ts`, `src/lib/analytics.ts`,
    `tests/lib/analytics.test.ts`
  - 依存: なし(Phase 2 と独立)/ 規模: S

- [x] **I18-T6: カスタムイベント差し込み(価格記録・共有・退会)**
  - 内容: `features/*/api.ts` の成功パスに `trackEvent` を追加(fire-and-forget):
    - 価格記録の追加(prices/api.ts): `record_price`
    - 招待コード発行(sharing/api.ts): `create_invite`
    - book への参加(sharing/api.ts): `join_book`
    - 退会実行(account/api.ts): `delete_account`
    - パラメータには **PII・自由入力値(商品名・価格・店舗名等)を含めない**
      (含めるなら isSale 等の boolean / enum 程度に留める)
    - 確定したイベント名・パラメータを `docs/spec-issue18.md` に追記
  - Acceptance: 各 api の既存テストが回帰しない(trackEvent は no-op のため)。
    イベント名・パラメータ一覧が spec に記載されている
  - Verify: `npm run test && npm run lint && npm run build`
  - Files: `src/features/prices/api.ts`, `src/features/sharing/api.ts`,
    `src/features/account/api.ts`, `docs/spec-issue18.md`
  - 依存: I18-T5 / 規模: S

### Checkpoint 3(= plan の Phase 3 完了)
- [ ] 全テスト + lint + build + CI グリーン
- [ ] 送信イベントに PII・自由入力値が含まれないことをコードレビューで確認

## Phase 4: 手動セットアップ・本番検証

- [ ] **I18-T7: 手動セットアップ手順の文書化 + ユーザー作業依頼**
  - 内容: セットアップ手順を docs(または README)に記載し、ユーザーに依頼する:
    1. Sentry アカウント・組織・プロジェクト作成(フロント/Functions の構成は
       このタイミングで決定)、DSN 発行、メールアラートの確認
    2. Firebase コンソールで Analytics(GA4)を有効化し `measurementId` を取得
    3. `.env.local` に `VITE_SENTRY_DSN` / `VITE_FIREBASE_MEASUREMENT_ID` を追記、
       `functions/.env`(または `firebase functions:secrets:set`)に `SENTRY_DSN` を設定
  - Acceptance: 手順が人間だけで実行できる粒度で書かれており、
    ユーザーが設定値の投入を完了している
  - Verify: ドキュメント目視 + `.env.local` 設定後に `npm run build` が通る
  - Files: `README.md`(または `docs/` 配下のセットアップ手順)
  - 依存: I18-T3, I18-T4, I18-T5(必要な環境変数名の確定)/ 規模: S

- [ ] **I18-T8: デプロイ + 本番動作確認 + 親仕様更新**
  - 内容:
    - デプロイ(`npm run deploy` / `firebase deploy --only functions`)は
      ユーザー承認のうえ実施
    - Sentry: 本番でテスト例外を意図的に発生させ、ダッシュボード記録と
      メール通知の到達を確認。イベントに PII が無いことも実物で確認
    - Analytics: GA4 DebugView で page_view とカスタムイベントの記録を確認
    - `docs/spec.md` に Issue #18 を反映(Tech Stack / Commands /
      Testing Strategy / 将来スコープ)。spec / plan / tasks の Status を更新し、
      `docs/spec-issue18.md` の Success Criteria にチェックを記入
  - Acceptance: Success Criteria の全項目にチェックが付く
    (未達があれば修正タスクを起票)
  - Verify: 手動検証チェックリストの完了 + `npm run test && npm run lint`
  - Files: `docs/spec.md`, `docs/spec-issue18.md`,
    `docs/plan-issue18.md`, `docs/tasks-issue18.md`(Status 更新)
  - 依存: I18-T7 + Checkpoint 1〜3 完了 / 規模: S

### Checkpoint: 完了
- [ ] Success Criteria 全項目チェック済み・全 Verify グリーン
- [ ] 本番デプロイは**人間の承認後**に実施

---

## 依存関係まとめ

```
T1 ──→ T2 ─(Checkpoint 1)─┐
                           │
T3(フロント Sentry)──┐    │
T4(Functions Sentry)─┼────┼──→ T7 ──→ T8
T5 ──→ T6 ────────────┘    │
                           └(CI は T3〜T6 の検証基盤)
```

- T3 / T4 / T5 は互いに独立(並行可)。単独セッションでは T3 → T4 → T5 → T6 の順で直列に進める
- T1・T2(CI)を最初に完了させ、以降のタスクはすべて CI グリーンを Verify に含める
- T7(手動セットアップ)は環境変数名が確定する T3〜T5 完了後
