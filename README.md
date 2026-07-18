# そこねこ — 底値帳 PWA

スーパー・ドラッグストア等で見かけた商品価格を記録し、「どの店でいくらが底値か」を
一目で確認できる底値帳アプリ。仕様は `docs/spec.md`、実装計画は `docs/plan.md` を参照。

## セットアップ

```bash
npm install
cp .env.example .env.local   # デフォルトはエミュレータ接続
```

## 開発

```bash
npm run emulators   # Firebase エミュレータ(Auth/Firestore/UI)を起動
npm run dev         # 開発サーバー(別ターミナルで)
```

- エミュレータ UI: http://localhost:4000
- **Firebase エミュレータには Java 21 以上が必要**。システムに無い場合は
  ポータブル JRE を `.tools/` に置き、`JAVA_HOME` と `PATH` を通して起動する:

```bash
JAVA_HOME="$(pwd)/.tools/jdk-21.0.11+10-jre" PATH="$(pwd)/.tools/jdk-21.0.11+10-jre/bin:$PATH" npm run emulators
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + 本番ビルド |
| `npm run preview` | ビルドのプレビュー |
| `npm run test` | テスト実行 |
| `npm run test:watch` | テスト(watch) |
| `npm run test:rules` | セキュリティルールテスト(Firestore エミュレータが前提) |
| `npm run test:e2e` | アカウント削除等の E2E テスト(Firestore/Auth/Functions エミュレータが前提) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run emulators` | Firebase エミュレータ起動(Auth/Firestore/Functions/UI) |
| `npm run deploy` | ビルド + Firebase デプロイ |

Cloud Functions(`functions/`)は独立 npm パッケージ。エミュレータ起動前にビルドが必要:

```bash
cd functions && npm install && npm run build
```

## 本番環境

`.env.local` で `VITE_FIREBASE_USE_EMULATORS=false` にし、
Firebase コンソールの設定値(`.env.example` 参照)を設定する。

### デプロイ(Cloud Functions を含む場合。Issue #13〜)

アカウント削除(退会)機能は Cloud Functions を使うため、**Blaze プラン(従量課金)への
切替が必須**。無料枠(呼び出し 200 万回/月・GB-秒 40 万/月など)の範囲では実質無料。

1. Firebase コンソール > 使用量と請求 で Blaze プランに切替
2. 同画面で**予算アラート**を設定する(想定外の課金に気づけるように。例: 月 500 円)
3. `cd functions && npm run build`
4. `firebase deploy --only functions`(Functions のみ)、または
   `npm run deploy`(Hosting も含めて一括デプロイ)

Firestore セキュリティルール(`firestore.rules`)はアカウント削除機能のために
変更していない(Cloud Functions は Admin SDK でルールをバイパスするため)。

### エラートラッキング・Analytics のセットアップ(Issue #18)

本番運用前に、以下を**手動で**セットアップする(アカウント作成を伴うため自動化していない)。
コード側は DSN・測定 ID が未設定でも no-op で動作するため、この手順を飛ばしてもアプリは壊れない。

#### 1. Sentry(エラートラッキング)

1. https://sentry.io でアカウント・組織を作成(無料の Developer プラン: 5,000 エラー/月・1 メンバー)
2. プロジェクトを作成する。**フロントエンド用(Platform: React)** と
   **Cloud Functions 用(Platform: Node.js)** の 2 プロジェクトを作る
   (1 プロジェクト + `environment` タグ分離でも可。運用しやすい方でよい)
3. 各プロジェクトの Settings > Client Keys (DSN) から DSN をコピーする
4. フロントエンド用 DSN を `.env.local` の `VITE_SENTRY_DSN` に設定
5. Cloud Functions 用 DSN は `functions/.env.<Firebase プロジェクト ID>`
   (例: `functions/.env.sokoneko-prod`)に `SENTRY_DSN=` を設定する。
   Firebase Functions v2 はデプロイ時にこのファイルを自動で読み込み、
   関数の環境変数として反映する(`firebase functions:secrets` は使わない。
   DSN は送信専用の URL で読み取りには使えないため Secret Manager は不要。
   前提 2 と同じ理由)。このファイルはコミットしない
   (`functions/.env*` は `.gitignore` の `.env` パターンで除外済み)。
   ローカルのエミュレータ動作確認だけなら `functions/.env` に設定してもよい
6. Sentry の Alerts 設定でデフォルトのメールアラートルールが有効になっていることを確認
   (プロジェクト作成時のデフォルトルールで通常は自動有効)

#### 2. Firebase Analytics(GA4)

1. Firebase コンソール > 該当プロジェクト > Analytics で有効化する(無料)
2. プロジェクトの設定 > 全般 の「Google アナリティクス」欄に表示される
   **測定 ID(`G-XXXXXXXXXX`)** をコピーする
3. `.env.local` の `VITE_FIREBASE_MEASUREMENT_ID` に設定する

設定後、`npm run build` が通ることを確認する(DSN・測定 ID は任意項目のため、
未設定でもビルド・テストは通る)。
