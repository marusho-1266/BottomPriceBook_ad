# 実装計画: 宣伝用 LP(Issue #31)

> Status: **Implemented** / 作成日: 2026-08-01 / Approved: 2026-08-01 / 実装完了: 2026-08-01
> 対象仕様: `docs/spec-issue31.md`(Implemented)
> タスク分解: `docs/tasks-issue31.md`(Done)

## 方針

- **公開ルートは既存パターンに揃える**: `/terms`・`/privacy` と同じく `App.tsx` の
  `Gate` 外に `/welcome` を置く。認証・Book・AppShell に触れない
- **LP は 1 コンポーネントに閉じる**: `WelcomePage` にヒーロー〜フッターをまとめる。
  セクション分割は可読性のためファイル内関数でもよいが、初版は単一ファイルで足りる
- **OGP は静的 HTML + 静的画像**: クローラ向けに `index.html` と `public/og-image.png` のみ。
  `react-helmet` 等は入れない
- **デザイントークンは既存のみ**: LoginScreen のオレンジヘッダー／クリーム地／丸ゴシックに寄せる
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| `WelcomePage` を `src/routes/WelcomePage.tsx` に新設 | 他ルートページと同列。公開 LP は legal 配下に寄せない |
| `App.tsx` の外側 `Routes` に `path="welcome"` を追加 | Gate 外公開。ログイン済みでも LP 表示(spec ASSUMPTION 2) |
| CTA は `<Link to="/">` | 登録モード URL 化はしない(spec)。未ログインなら LoginScreen |
| og:url / og:image は本番絶対 URL を `index.html` にハードコード | SPA にホスト定数が無い。Hosting 既定は `sokoneko-2e8b7.web.app` |
| og:image は 1200×630 の PNG を `public/og-image.png` に配置 | SNS 推奨サイズ。簡単なブランド画像で可(spec) |
| コピーは Plan で仮確定し実装時に微調整可 | Spec Open Questions の解消 |
| 新規 npm 依存なし | spec Boundaries |
| Firestore / Functions / Hosting rewrite 変更なし | 既存 `** → index.html` で `/welcome` が届く |

## 主要コンポーネントと依存

```
App.tsx(外側 Routes)
  ├── /terms → TermsPage(既存)
  ├── /privacy → PrivacyPage(既存)
  ├── /welcome → WelcomePage(新規)
  └── * → Gate(既存。未ログイン時 LoginScreen)

WelcomePage
  ├── ヒーロー(ブランド・見出し・一文・CTA・視覚)
  ├── できること(3 点)
  ├── 利用イメージ
  └── フッター(再 CTA・規約リンク)

index.html + public/og-image.png
  └── SNS / note クローラ向け meta
```

## コピー(Plan 確定案)

実装時に語感だけ直してよいが、趣旨は固定する。

| 箇所 | 文言 |
|---|---|
| ブランド | そこねこ |
| ヒーロー見出し | 店頭で、その場で底値がわかる |
| ヒーロー一文 | スーパーやドラッグストアで見かけた価格を記録して、商品ごとの底値と店舗を一目で確認できる底値帳アプリです。 |
| メイン CTA | 無料で始める |
| できること 1 | 価格を記録 — 店頭でその場入力。オフラインでも書けます |
| できること 2 | 底値を確認 — 商品ごとの最安値と店舗が一覧でわかります |
| できること 3 | 単価で比較 — 内容量が違っても 100g あたり等で比べられます |
| 利用イメージ | 買い物中にスマホでサッと記録。帰宅後や次の買い物前に、底値と特売を見比べて「今は買いか」を判断できます。 |
| フッター再 CTA | 無料で始める |
| OGP title | そこねこ — 底値帳 |
| OGP / meta description | 店頭で価格を記録して、商品ごとの底値と店舗を一目で確認できる底値帳アプリ「そこねこ」。 |

## OGP / ホスト(Plan 確定)

- 本番ホスト: `https://sokoneko-2e8b7.web.app` (`.firebaserc` の default `sokoneko-2e8b7`)
- `og:url`: `https://sokoneko-2e8b7.web.app/welcome`
- `og:image`: `https://sokoneko-2e8b7.web.app/og-image.png`
- カスタムドメインを後から付ける場合は Ask first で meta を更新する

### og:image の作り方

- サイズ: **1200×630**
- 内容: クリーム地(`#FBF6ED`)＋オレンジ(`#E8823C`)の帯またはアクセント、
  大きく「そこねこ」、小さく「底値帳」程度。猫モチーフは控えめ(Login の Cat アイコン相当で可)
- 配置: `public/og-image.png`
- 手段: 画像生成または簡易グラフィック編集。SVG のみだと一部 SNS で弱いため **PNG を正**とする

## UI 詳細(Plan 確定)

### ヒーロー

- 背景: クリーム全体。上部に LoginScreen に近いオレンジのラウンド帯(`rounded-b-[28px] bg-primary`)を置いてブランドをヒーロー級にする
- 帯内: Cat アイコン + 「そこねこ」(大きく) + 見出し + 短い一文(白 / 白半透明)
- CTA: 白ボタンまたは帯直下の primary ボタン「無料で始める」→ `/`
- 第一ビューに機能一覧・規約・統計を詰め込まない

### できること

- 縦 3 ブロック。Lucide アイコン(例: `Pencil` / `Trophy` / `Scale`) + 見出し + 1 行
- 枠線や薄い区切りは可。カード影の積み重ねは避ける

### 利用イメージ

- 見出し 1 + 段落 1。オフラインに一言触れてよい

### フッター

- 再 CTA
- `Link` で `/terms`・`/privacy`
- 補足: 「そこねこ運営者」程度(legal 表記に合わせる)

### レイアウト幅

- `max-w-md`〜`max-w-lg` 中央寄せでモバイルファースト。PC でも読みやすくするだけ(DesktopShell は使わない)

## 実装順序(フェーズ)

### Phase A: ルートと LP UI
1. **I31-T1**: `WelcomePage` + コンポーネントテスト + `App.tsx` 配線

### Phase B: OGP
2. **I31-T2**: `public/og-image.png` + `index.html` meta

### Phase C: 仕上げ
3. **I31-T3**: 手動確認観点の整理 + `docs/spec-issue31.md` Success Criteria 更新 + 回帰
   (`npm run test && npm run lint`)

OGP の SNS 実プレビューはデプロイ後の手動確認(本 Issue のコミット完了条件には「ファイル設置と meta 記述」までを含め、クローラキャッシュ更新は運用手順とする)。

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Gate 内に誤配置し未ログインで見られない | High | 外側 Routes に追加。テストで未認証描画を確認 |
| CTA の `to="/"` がログイン済みでホームに飛ぶ | Low | 仕様どおり許容。未ログイン時のみ LoginScreen |
| OGP が相対 URL だと SNS で欠ける | Med | 絶対 URL を `index.html` に書く |
| og:image 未デプロイ / キャッシュ | Med | `public/` 配置を Verify。プレビューはデプロイ後手動 |
| LP が情報過多になる | Med | ヒーロー予算を守り、セクションは 4 つのみ |

## 検証チェックポイント

| 時点 | 確認 |
|---|---|
| T1 後 | 未ログイン相当で WelcomePage 描画・CTA/規約リンクのテストグリーン |
| T2 後 | `index.html` に meta、`public/og-image.png` 存在、`npm run build` で dist に含まれる |
| T3 後 | lint/test グリーン。手動で `/welcome` → CTA → `/` |

## Out of Scope

`/` の LP 化、signup モード URL、料金訴求、スクショ大量、SSR/プリレンダー、
新規計測イベント、Modernist DS、Hosting 設定変更、Firestore/Functions

## 次のフェーズ

Phase 2〜4 完了(2026-08-01)。
