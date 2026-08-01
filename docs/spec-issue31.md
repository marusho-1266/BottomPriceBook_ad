# Spec: 宣伝用 LP 作成(Issue #31)

> Status: **Approved** / 作成日: 2026-08-01 / Approved: 2026-08-01
>
> 対象: GitHub Issue [#31](https://github.com/marusho-1266/BottomPriceBook_ad/issues/31)
> 「LP作成」(宣伝用の LP を作成)
> このドキュメントは spec-driven development の Phase 1 (Specify) 成果物。
> プロジェクト全体の仕様(Tech Stack・Code Style・Testing Strategy・Boundaries 等)は
> `docs/spec.md`(Approved)を継承し、本ドキュメントでは本機能固有の差分のみを記述する。
> 実装計画: `docs/plan-issue31.md`

## 元 Issue

> 宣伝用のLPを作成

## ヒアリング結果(2026-08-01 確定)

1. **目的**: SNS / note / アプリ共有サイトへ公開し、集客する
2. **置き場所**: 既存 Firebase Hosting・同一 SPA に公開ルートを追加
3. **URL**: `/` はログイン画面のまま。LP は `/welcome`
4. **CTA**: メイン CTA は既存ログイン画面 `/` へ遷移するのみ(登録モード URL 化はしない)
5. **デザイン**: アプリ本体と同じトーン(`docs/design.md` のクリーム＋オレンジ)
6. **構成**: ヒーロー / できること / 利用イメージ / フッター(再 CTA + 規約リンク)
7. **OGP**: `title` / `description` / `og:image`(簡単なブランド画像で可)を初版に含める

## ASSUMPTIONS(ヒアリング確定 + 実装前提)

訂正があれば Plan 前に指摘すること。

1. **公開ルート**: `/welcome` は `/terms`・`/privacy` と同様、`Gate`(認証ガード)の外に置く。未ログインでも閲覧できる
2. **ログイン済み訪問**: `/welcome` を開いても LP を表示する。ホームへの強制リダイレクトはしない
3. **言語**: 日本語のみ
4. **モバイルファースト**: 第一ビューはスマホ幅を基準に設計し、PC でも破綻しない
5. **ヒーロー構成**: ブランド「そこねこ」をヒーロー級に置き、見出し 1・短い説明 1・CTA 群・視覚要素 1 を基本とする(情報過多にしない)
6. **OGP の実装方式**: SNS / note のクローラは SPA の JS を実行しないことが多いため、
   `index.html` に静的な meta を置く(サイト共通の既定値)。`og:url` は共有用に
   `https://<本番ホスト>/welcome` を指す。React 側だけの動的注入は初版では必須としない
7. **og:image**: `public/` に静的画像(例: `og-image.png`、推奨 1200×630 前後)を置く。
   既存 PWA アイコンの流用でもよいが、シェア向けに「そこねこ」ブランドが分かる簡易画像を新規用意する想定
8. **新規 npm 依存なし**: `react-helmet` 等は追加しない(静的 meta で足りる)
9. **Firestore / Functions / ルール変更なし**
10. **非対象**: 料金・買い切り説明、詳細機能一覧、大量スクショ、別ドメイン、
    登録モードの URL 化、新規アナリティクス導入、Modernist DS(`docs/claude design/_ds/`)の採用

## Objective

### 何を作るか

そこねこの価値を短く伝え、ログイン／登録へ誘導する**宣伝用ランディングページ**を
`/welcome` に公開する。SNS・note・アプリ共有サイトからの流入を受け止める。

### 誰のためか

- そこねこを知らない見込客(流入元: SNS / note / アプリ共有サイト)
- URL を貼って紹介したい既存利用者・運営者

### ユーザーストーリー

- 見込客として、共有リンクを開いただけで「何のアプリか」が分かる
- 見込客として、「無料で始める」等の CTA からログイン画面へ進める
- 運営者として、SNS・note に貼ったときタイトル・説明・画像プレビューが出る
- 見込客として、利用規約・プライバシーポリシーへ辿れる

## Tech Stack

`docs/spec.md` / `docs/design.md` を継承。

- React 19 + React Router + Tailwind CSS v4 + Lucide
- 公開ルートの置き方は既存の `TermsPage` / `PrivacyPage` に倣う
- OGP は `index.html` + `public/og-image.png`(ファイル名は Plan で確定可)

## Commands

`docs/spec.md` の Commands をそのまま使用(`npm run dev / build / test / lint` 等)。

## Project Structure(追加・変更分)

```
src/App.tsx                         → /welcome を Gate 外の公開ルートに追加
src/routes/WelcomePage.tsx          → LP 本体(新規)
public/og-image.png                 → OGP 用ブランド画像(新規)
index.html                          → title / description / og:* / twitter:* meta 追加
tests/routes/WelcomePage.test.tsx   → CTA・主要セクション・規約リンクのテスト
docs/spec-issue31.md                → 本仕様
```

Hosting rewrite は既存の SPA fallback で `/welcome` が `index.html` に落ちる想定(変更不要)。

## 画面仕様

### ルート

| パス | 認証 | 内容 |
|---|---|---|
| `/welcome` | 不要 | 宣伝 LP |
| `/` | 未ログイン時 LoginScreen | CTA の着地(変更なし) |
| `/terms` `/privacy` | 不要 | フッターからリンク(既存) |

### セクション構成

1. **ヒーロー**
   - ブランド名「そこねこ」を最優先の視覚信号にする
   - 一言ヘッドライン(例: 「店頭で、その場で底値がわかる」— 文言は実装時に確定可)
   - 短いサポート文 1 文
   - メイン CTA(例: 「無料で始める」) → `Link` または遷移で `/`
   - 視覚要素: 既存猫アイコン / 簡易イラスト / ブランドマーク程度。実写スクショ大量は不要

2. **できること**(3 点程度)
   - 価格を記録する
   - 商品ごとの底値・店舗を確認する
   - 内容量違いを単価で比較する
   - アイコン + 短い見出し + 1 行説明。カード過多にしない

3. **利用イメージ**
   - 店頭スマホ利用を中心にした短い説明(1 段落〜数行)
   - オフライン記録など差別化ポイントを 1〜2 点触れてよい

4. **フッター**
   - 再 CTA → `/`
   - `利用規約`(`/terms`)・`プライバシーポリシー`(`/privacy`)へのリンク
   - 「そこねこ運営者」等の既存表記に合わせてよい

### デザイン

- `docs/design.md` のトークン・タイポ(M PLUS Rounded 1c、クリーム＋オレンジ)に従う
- hex の直書きを避け、既存 CSS 変数 / Tailwind テーマを使う
- Modernist DS は採用しない(`docs/design.md` 実装方針どおり)
- PC 幅では読みやすい最大幅に収める。PC 専用シェルやサイドナビは付けない

### OGP / メタ

`index.html` に少なくとも以下を置く(文言は実装時に日本語で確定。趣旨は固定):

| タグ | 方針 |
|---|---|
| `<title>` | 既存「そこねこ — 底値帳」を維持、または LP 向けに短い説明を足す |
| `meta name="description"` | 底値帳であることの 1〜2 文 |
| `og:title` / `og:description` | 上記と整合 |
| `og:type` | `website` |
| `og:url` | 本番の `/welcome` 絶対 URL |
| `og:image` | `/og-image.png` の絶対 URL |
| `twitter:card` | `summary_large_image`(推奨) |

本番ホスト名は既存 Firebase Hosting ドメインに合わせる(Plan / 実装時に確認)。

**検証**: デプロイ後、OGP デバッガまたは実際の SNS プレビューで画像・文言が出ることを手動確認する。

## Code Style

```tsx
/** 宣伝用 LP。未ログインでも閲覧可。CTA はログイン画面へ */
export function WelcomePage() {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      {/* ヒーロー: ブランド → 見出し → 一文 → CTA */}
      {/* できること / 利用イメージ / フッター */}
      <Link to="/">無料で始める</Link>
    </main>
  );
}
```

- named export
- UI 文言は日本語
- ルーティング追加は `App.tsx` の公開ルート群に揃える

## Testing Strategy

`docs/spec.md` の Testing Strategy を継承。本機能では以下を追加する:

| レベル | 対象 |
|---|---|
| コンポーネント | `/welcome` 相当の描画でヒーロー・できること・利用イメージ・フッターが見える |
| コンポーネント | メイン CTA が `/` へリンクしている |
| コンポーネント | フッターから `/terms`・`/privacy` へリンクしている |
| 手動 | 未ログインで `/welcome` が開ける |
| 手動 | CTA でログイン画面に遷移する |
| 手動 | デプロイ後の OGP プレビュー(title / description / image) |

OGP のクローラ挙動は自動テスト対象外(手動)。

## Boundaries

- **Always**
  - コミット前に `npm run lint` と `npm run test` を通す
  - `/welcome` を認証ガードの外に置く
  - デザイントークンは `docs/design.md` / 既存 CSS 変数に従う
  - OGP 用 meta は静的 HTML に置く
- **Ask first**
  - 新規 npm 依存
  - `/` を LP に差し替える案への変更
  - 登録モードの URL 化(`?mode=signup` 等)
  - 本番ホスト名・og:url の扱いが既存ドメイン方針と食い違う場合
  - LP 専用の計測イベント追加
- **Never**
  - Modernist DS の本番採用
  - 料金・買い切り機能の実装や LP 上での有料訴求(Issue #36–38 の先取り)
  - シークレットのコミット、失敗テストの無断スキップ

## Success Criteria

- [ ] 未ログインで `https://<host>/welcome` が開き、ヒーロー〜フッターの 4 セクションがある
- [ ] ブランド「そこねこ」がヒーローで一目で分かる
- [ ] メイン CTA およびフッター再 CTA からログイン画面 `/` へ進める
- [ ] フッターから利用規約・プライバシーポリシーへ辿れる
- [ ] `index.html` に description / og:* / (推奨) twitter:card があり、`public` に og:image がある
- [ ] 見た目がアプリ本体と同トーンである
- [ ] 関連テストがグリーン、`npm run lint` / `npm run test` が通る

## Out of Scope

- `/` を LP に変更すること
- サインアップモード固定の導線
- 料金・買い切り・プロモコードの説明(Issue #36–38)
- 機能の網羅リスト、多数の実機スクショ、動画
- 別ドメイン / 別リポジトリの静的サイト
- サーバーサイドレンダリング・プリレンダー基盤の導入
- 新規アナリティクス基盤
- Firestore / Functions / セキュリティルール変更

## Open Questions

なし(ヒアリングで確定済み)。

Plan で確定する実装詳細:

- ヘッドライン等の最終コピー
- og:image のサイズ・作成方法(画像生成 / 既存アイコン加工)
- 本番絶対 URL のホスト文字列の出典(ハードコード vs 既存定数)

## 次のフェーズ

この Spec の承認後 → Phase 2: Plan(`docs/plan-issue31.md`) → Phase 3: Tasks → Phase 4: Implement
