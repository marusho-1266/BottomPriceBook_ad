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
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run emulators` | Firebase エミュレータ起動 |
| `npm run deploy` | ビルド + Firebase デプロイ |

## 本番環境

`.env.local` で `VITE_FIREBASE_USE_EMULATORS=false` にし、
Firebase コンソールの設定値(`.env.example` 参照)を設定する。
