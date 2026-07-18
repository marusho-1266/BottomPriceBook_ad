# Spec: Issue #18 エラー監視・分析機能 + CI 整備

> Status: **Draft(ヒアリング確定・実装前)** / 作成: 2026-07-18
> 対象 Issue: [#18 エラー監視・分析機能](https://github.com/marusho-1266/BottomPriceBook_ad/issues/18)
> 親仕様: `docs/spec.md` / 関連: `docs/spec-issue13.md`(Cloud Functions 基盤を前提とする)

## ヒアリング結果(2026-07-18 確定)

1. **対象スコープ**: エラートラッキング(Sentry)+ Analytics(Firebase Analytics)+ CI(GitHub Actions)の 3 本すべてを本 Issue に含める
2. **エラートラッキング**: Sentry を採用。フロントエンド(React)と Cloud Functions(`deleteAccount` 等)の両方を対象とする
3. **通知方法**: メール通知のみ。Slack 等の追加連携は今回スコープ外
4. **PII 方針**: Sentry の PII 送信はマスクする(`sendDefaultPii: false`。メールアドレス等の個人情報は送信しない)
5. **Analytics ツール**: Firebase Analytics(GA4 基盤)。既存 Firebase プロジェクトとの統合が容易なため
6. **Analytics 計測対象**: アクセス数・アクティブユーザー数(自動収集イベント)+ 主要機能(価格記録・共有・退会等)の利用状況(カスタムイベント)
7. **同意バナー**: 不要(現状は本人+知り合いの少人数利用のため見送り。将来の一般公開時に再検討)
8. **CI 対象**: `build`(`tsc -b && vite build`)+ `lint` + `test`(単体)+ `test:rules`(ルールテスト)。`test:e2e` は時間がかかるため CI スコープ外(手動 or 将来検討)
9. **CI トリガー**: `main` への push + すべての Pull Request

## 前提(仮定 — 誤りがあれば指摘してください)

1. Sentry は無料枠(Developer プラン: 5,000 エラー/月・1 メンバー)内での運用を前提とする。
   組織作成・プロジェクト作成(フロントエンド用・Functions 用の 2 プロジェクト、または 1 プロジェクトで
   環境タグ分離)は事前に手動で行い、DSN を発行する
2. DSN(Sentry の送信先 URL)は秘密情報ではない(公開されても送信専用で読み取りには使えない)ため、
   フロントエンドは Vite の `VITE_` プレフィックス環境変数としてビルドに埋め込んでよい。
   ただし `.env.local` 等で管理し、リポジトリにはコミットしない(既存の Firebase 設定と同様の扱い)
3. Cloud Functions 側の Sentry DSN は `functions/.env`(ローカル)/
   `functions/.env.<Firebase プロジェクト ID>`(本番。デプロイ時に Firebase Functions v2 が
   自動で読み込む)で管理する。DSN は送信専用で読み取りには使えず機密情報ではないため
   Secret Manager(`firebase functions:secrets`)は使わない(前提 2 と同じ理由。
   `secrets:` バインディングを使うと Secret 未作成時にデプロイ自体が失敗し、
   「DSN 未設定でも動作する」設計と相性が悪いことが実装時に判明したため見送った)。
   `functions/.env*` はリポジトリにコミットしない(既存 `.gitignore` の `.env` パターンで除外)
4. 開発(エミュレータ)環境では Sentry 送信を無効化する(ローカル開発時のノイズ防止)。
   `environment` タグで `development` / `production` を区別し、`development` はイベント送信しないか
   Sentry 側でフィルタする
5. Firebase Analytics は Firebase コンソールで有効化済みの GA4 プロパティに自動連携される
   (Firebase プロジェクトの Analytics 有効化は無料の設定作業。追加課金なし)
6. GitHub Actions の `test:rules` 実行には Firebase Emulator(Firestore/Auth)+ JDK が必要。
   `actions/setup-java`(JDK 21。`docs/spec.md` のローカル開発と同じバージョン)を CI ワークフローに含める
7. GitHub Actions は public/private リポジトリ問わず無料枠(2,000 分/月、public は無制限)内に収まる想定
   (現状の `test` + `test:rules` + `lint` + `build` は数分程度)
8. Cloud Functions の Sentry SDK(`@sentry/node` 等)導入は `functions/` の独立 npm パッケージへの
   新規依存追加となる(`docs/spec.md` の Boundaries「依存パッケージの追加は Ask first」に該当。
   本 Issue のヒアリングで承認済みとして扱う)

## Objective

### 何を作るか

- 本番環境で発生したフロントエンド・Cloud Functions のエラーを **開発者が能動的に調べなくても検知**できるようにする(Sentry)
- アクセス数・アクティブユーザー数・主要機能の利用状況を **可視化**できるようにする(Firebase Analytics)
- push / PR のたびに lint・テスト・ビルドを **自動実行**し、壊れたコードが `main` に混入するのを防ぐ(GitHub Actions)

### 背景・課題

一般公開前提条件の一つとして、「公開後に動いていないことを開発者が知る手段がユーザーからの連絡しかない」
状態を解消する。あわせて CI 未整備により、レビュー時に手元でテストを再実行する運用になっている点を解消する。

### ユーザーストーリー

- 開発者として、本番でエラーが発生したらメールで気づきたい(ユーザーからの連絡を待たずに)
- 開発者として、どの程度のユーザーが使っていて、どの機能がよく使われているかを把握したい
- 開発者として、PR を出したら自動でテスト・lint・ビルドが走り、緑になったことを確認してからマージしたい

## 実装内容

### 1. エラートラッキング(Sentry)

| 対象 | 内容 |
|---|---|
| フロントエンド | `@sentry/react` を導入。`main.tsx` で `Sentry.init()`(DSN・`environment`・`tracesSampleRate` は控えめな値、`sendDefaultPii: false`)。React の Error Boundary と連携し、未捕捉例外・Promise rejection を送信 |
| Cloud Functions | `@sentry/node`(または Sentry の GCP Functions 向け SDK)を `functions/` に導入。`deleteAccount` 等の関数内で例外発生時に `Sentry.captureException` するラッパーを共通化。Cloud Functions はレスポンス返却後にプロセスが凍結されイベントが送信前に欠落しうるため、ラッパー内で `Sentry.flush()` による送信完了待ちを必ず行う |
| 環境分離 | `environment` タグで `development`(エミュレータ)/ `production` を分離。開発環境では送信しない、または Sentry 側でフィルタ |
| PII | `sendDefaultPii: false`。`beforeSend` フックでメールアドレス等が紛れ込んでいないか最終防御を入れる |
| 通知 | Sentry のメールアラート(デフォルトのプロジェクトアラートルールを使用) |

### 2. Analytics(Firebase Analytics)

| 対象 | 内容 |
|---|---|
| 自動収集イベント | `firebase/analytics` の `getAnalytics()` を初期化するだけで得られる `page_view`・`session_start`・DAU/MAU 等(GA4 標準機能) |
| 設定値の追加 | 現行の `src/lib/firebase.ts` の firebaseConfig には `measurementId` が無い(エミュレータ用 demo config には `appId` も無い)ため、`VITE_FIREBASE_MEASUREMENT_ID` を `.env.local` に追加し本番 config に含める |
| 初期化ガード | エミュレータ環境(`VITE_FIREBASE_USE_EMULATORS=true`)およびテスト環境では Analytics を初期化しない。あわせて `isSupported()` で実行環境の対応可否を確認してから初期化する(jsdom 等の非対応環境でのクラッシュ防止) |
| カスタムイベント | 主要機能の利用状況として以下を `logEvent` で送信(確定):`record_price`(価格記録の追加。パラメータ: `isSale: boolean`)/ `create_invite`(招待コード発行。パラメータなし)/ `join_book`(book への参加。パラメータなし)/ `delete_account`(退会実行。パラメータなし)。いずれも PII・自由入力値(商品名・価格・店舗名等)は含めない |
| 実装場所 | `src/lib/analytics.ts` に薄いラッパーを作り、`features/*/api.ts` から呼び出す(Firestore アクセスと同様に集約する方針を踏襲) |
| 同意バナー | 実装しない(前提 7 参照) |

### 3. CI(GitHub Actions)

`.github/workflows/ci.yml` を新規作成。

```
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    - checkout
    - setup-node (Node 22。functions/package.json の engines.node に合わせる。
      ルート package.json には engines フィールドが無いため、実装時に engines を追記して参照元を一本化する)
    - setup-java (JDK 21。test:rules 用)
    - npm ci
    - npm run lint
    - npm run build
    - npm run test
    - npm run test:rules (Firebase Emulator 起動が前提。firebase-tools は既に devDependencies に
      含まれているため追加インストール不要。`npx firebase emulators:exec` で実行)
    - cd functions && npm ci && npm run build && npm test (型エラー検知 + deleteAccount 等のサーバー側テスト)
```

- `functions/` はビルド(型エラー検知)に加え、既存テスト(`npm test`。`deleteAccount.test.ts` /
  `index.test.ts`)も CI で実行する
- `test:e2e` は含めない(スコープ外。将来検討)
- **単体テストは環境変数なしでは失敗する**点に注意:`src/lib/firebase.ts` は
  `VITE_FIREBASE_USE_EMULATORS` が `'true'` でない限り `VITE_FIREBASE_API_KEY` 等を参照するため、
  `.env.local` の無い CI 環境では apiKey が undefined になり `auth/invalid-api-key` で
  `SettingsPage.test` 等が失敗する(worktree 環境で再現済みの既知事象)。
  ワークフローの `env:` に `VITE_FIREBASE_USE_EMULATORS: 'true'` を設定して実行する
- 本番の Sentry DSN・Firebase 設定値は CI では参照しない(テストはエミュレータ向け設定を使用)

## Tech Stack(追加分)

| 領域 | 技術 | 理由 |
|---|---|---|
| エラートラッキング | Sentry(`@sentry/react` / `@sentry/node`) | 無料枠あり、導入実績が豊富、フロント/サーバー両対応 |
| Analytics | Firebase Analytics(GA4 基盤) | 既存 Firebase プロジェクトと統合が容易、無料 |
| CI | GitHub Actions | リポジトリが GitHub 上にあり追加費用なし |

## Commands(追加分)

```
既存: npm run lint / npm run test / npm run test:rules / npm run build
CI:   .github/workflows/ci.yml が push(main)/PR で上記を自動実行
```

## Project Structure(追加分)

```
.github/workflows/ci.yml   → CI ワークフロー
src/lib/sentry.ts          → Sentry 初期化(DSN・environment 設定)
src/lib/analytics.ts       → Firebase Analytics 初期化 + logEvent ラッパー
functions/src/sentry.ts    → Cloud Functions 用 Sentry 初期化 + captureException ラッパー
```

## Code Style

親仕様 `docs/spec.md` から変更なし。

## Testing Strategy(本 Issue 分)

| レベル | 対象 |
|---|---|
| 単体 | `analytics.ts` / `sentry.ts` ラッパーが未初期化時にクラッシュしないこと(DSN 未設定でもアプリが起動すること) |
| CI 自体の検証 | ワークフローを実際に push/PR して GitHub Actions 上でグリーンになることを確認 |
| 手動 | Sentry: 意図的に例外を発生させてダッシュボード・メール通知に届くことを確認。Analytics: DebugView でイベントが記録されることを確認 |

## Boundaries(本 Issue 固有)

- **Always**
  - Sentry の `sendDefaultPii` は無効化し、PII(メールアドレス等)を送信しない
  - Sentry DSN・Firebase 設定はソースコードにハードコードせず環境変数経由で注入する
  - `.env.local` / `functions/.env` はコミットしない(既存 `.gitignore` を確認・踏襲)
  - CI が失敗する状態で `main` にマージしない
- **Ask first**
  - Sentry / Firebase Analytics のプロジェクト作成・組織設定(アカウント作成が必要な場合)
  - Sentry の有料プランへのアップグレード判断(無料枠超過時)
  - GitHub Actions のシークレット(Secrets)追加が必要になった場合の実際の登録操作
- **Never**
  - Sentry / GA4 にユーザーの個人情報(メールアドレス・入力した価格記録の内容等)を送信しない
  - CI のテストを `--no-verify` 相当でスキップする設定にしない

## Success Criteria

- [ ] フロントエンドで未捕捉エラーが発生すると Sentry に記録され、メール通知が届く
- [ ] Cloud Functions(`deleteAccount` 等)で例外が発生すると Sentry に記録される
- [ ] Sentry に送信されるイベントに PII(メールアドレス等)が含まれていないことを確認済み
- [ ] Firebase Analytics でページビュー・アクティブユーザー数が確認できる
- [ ] 主要機能(価格記録・共有・退会)のカスタムイベントが記録される
- [ ] GitHub Actions で `main` push / PR ごとに lint・build・test・test:rules が自動実行され、結果が PR に表示される
- [ ] CI が失敗した場合、GitHub 上で失敗ステップが分かる
- [ ] 既存テスト(`npm run test` / `npm run test:rules` / `functions` の `npm test`)がすべて通る

## 将来スコープ(本 Issue に含めない)

- Cookie 同意バナー等のプライバシー対応(一般公開時に再検討)
- Slack 等への Sentry アラート連携
- CI への `test:e2e` 追加
- CI でのデプロイ自動化(CD)
- Analytics ダッシュボードの自作(BigQuery エクスポート等)

## Open Questions

- Sentry プロジェクトの作成(アカウント登録・組織作成)は誰が行うか(ユーザー本人による手動作業が必要)
- GitHub Actions の Secrets 登録(必要になった場合)の実施者
