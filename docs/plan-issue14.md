# 実装計画: 利用規約・プライバシーポリシー(Issue #14)

> Status: **Draft(承認待ち)** / 作成日: 2026-07-18
> 対象仕様: `docs/spec-issue14.md`
> チェックリスト: `tasks/todo.md`

## 方針

- 最大のリスクは **`BrowserRouter` を `App` 直下へ移動するルーティング再構成**
  (既存全ページ+`/join`+`App.test` に影響しうる)。これを **Phase 1 で最初に**行い、
  既存テスト全 green を確認してから上に積む(fail fast)
- 文面ドラフト(利用規約・プライバシーポリシー)は**コード実装と独立**。
  Phase 1 と並行してドラフトを提示し、ユーザーレビューを実装をブロックしない位置に置く
- Google フォームの作成はユーザーの手動作業。URL 確定までは定数をプレースホルダ
  (`CONTACT_FORM_URL`)にして実装を進め、最後に差し替える
- 各タスク終了時に `npm run test && npm run lint` を通してから次へ進む

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| `BrowserRouter` を `App` 直下に移動し、`/terms` `/privacy` を公開ルート、`path="*"` で既存 `Gate` に委譲 | 未ログインでもポリシーを閲覧可能にする(spec 必須要件)。`Gate` 内は入れ子 `<Routes>` として既存構成を維持し、変更範囲を App.tsx に閉じる |
| 文面は `src/features/legal/` 配下の TSX(JSX 直書き)で保持 | Markdown レンダラ等の新規依存を増やさない(spec 方針)。見出し・リストのスタイルも既存 Tailwind トーンで統一できる |
| ページヘッダーは既存 `SubPageHeader` を再利用(`backTo` 指定) | `Link` ベースで認証非依存。Router 直下移動後は未ログインでも動作する |
| 問い合わせフォーム URL は `src/features/legal/` の定数 1 箇所に集約 | 公開情報のため env 不要(spec 前提 3)。差し替え箇所を 1 つにする |
| LoginScreen のリンクは `<Link>`(react-router) | BrowserRouter 直下に入るため使用可能になる。`<a href>` のフルリロードを避ける |

## 主要コンポーネントと依存

```
T1: App.tsx ルーティング再構成(公開ルート + 仮ページ)
      │
      ├──▶ T3: PrivacyPage(文面組み込み・戻る導線・フォームリンク)
      ├──▶ T4: TermsPage(同上)
      ├──▶ T5: LoginScreen フッターリンク
      └──▶ T6: SettingsPage メニュー行
T2: 文面ドラフト(コード非依存・T1 と並行、ユーザーレビューで確定)──▶ T3/T4 に反映
手動: Google フォーム作成(ユーザー)──▶ T7 で URL 差し替え
```

## 実装順序(フェーズ)

### Phase 1: ルーティング基盤(高リスクを先に潰す)

1. **Task 1: BrowserRouter の移動 + 公開ルート枠(M)**
   `src/App.tsx` で `BrowserRouter` を `AuthProvider` 直下へ移動。
   `/terms` `/privacy` に仮ページ(見出しのみの `TermsPage` / `PrivacyPage`)を公開ルートとして追加し、
   `path="*"` で `Gate` へ委譲。`Gate` 内の `BrowserRouter` は撤去し入れ子 `<Routes>` に変更。
   - 受け入れ: 未ログインで `/privacy` `/terms` がログイン画面にならず表示される。
     ログイン後の既存ルート(`/` `/record` `/compare` `/settings` 系 `/products/:id` `/join`)が従来通り
   - 検証: 新規テスト(未ログインでの公開ルート表示)+ 既存テスト全 green(`npm run test`)
   - Files: `src/App.tsx`, `src/features/legal/TermsPage.tsx`, `src/features/legal/PrivacyPage.tsx`,
     `tests/App.test.tsx`(必要なら調整), `tests/features/legal/publicRoutes.test.tsx`(新規)

2. **Task 2: 文面ドラフト作成 → ユーザーレビュー依頼(S・T1 と並行可)**
   利用規約・プライバシーポリシーの日本語ドラフトを spec の節構成
   (収集情報: メールアドレス/入力データ/GA4/Sentry/Cookie、退会によるデータ削除等)で作成し、
   ユーザーに提示する。**確定は Ask first**(spec Boundaries)。
   - 受け入れ: 両文面のドラフトが提示され、レビュー中または確定済み
   - 検証: 実装(収集している情報)と記載が一致していることをセルフチェック
   - Files: ドラフト提示(確定後 T3/T4 でコード化)

**✅ チェックポイント 1**: 既存テスト全 green・未ログインで公開ルート表示・文面ドラフト提示済み

### Phase 2: ページ実装(縦切り: 1 ページずつ完結)

3. **Task 3: PrivacyPage 本実装(M)**
   確定文面(未確定ならドラフト)を組み込み。`SubPageHeader` で戻る導線
   (未ログイン時 `/`、ログイン時は遷移元)、「お問い合わせ」節に `CONTACT_FORM_URL` への
   外部リンク(`target="_blank"` + `rel="noopener noreferrer"`)。
   - 受け入れ: 制定日・収集情報・問い合わせ節を含む本文が表示される。戻る導線が両状態で機能
   - 検証: `tests/features/legal/PrivacyPage.test.tsx`(見出し・フォームリンク・rel 属性)+ lint
   - Files: `src/features/legal/PrivacyPage.tsx`, `src/features/legal/contact.ts`(URL 定数),
     `tests/features/legal/PrivacyPage.test.tsx`

4. **Task 4: TermsPage 本実装(S)**
   T3 と同構成で利用規約を実装。
   - 受け入れ: 規約本文(免責・禁止事項・規約変更等)が表示される
   - 検証: `tests/features/legal/TermsPage.test.tsx` + lint
   - Files: `src/features/legal/TermsPage.tsx`, `tests/features/legal/TermsPage.test.tsx`

**✅ チェックポイント 2**: `/terms` `/privacy` が本文付きで表示・テスト全 green

### Phase 3: リンク設置

5. **Task 5: LoginScreen フッターリンク(S)**
   ログイン画面下部に「利用規約」「プライバシーポリシー」(`<Link>`)と
   「お問い合わせ」(外部リンク)を追加。
   - 受け入れ: 3 リンクが表示され、規約・ポリシーへ遷移できる
   - 検証: LoginScreen のテスト(リンク存在・href)+ 既存テスト green
   - Files: `src/features/auth/LoginScreen.tsx`, `tests/features/auth/LoginScreen.test.tsx`(新規 or 追記)

6. **Task 6: SettingsPage メニュー行(S)**
   既存 `SettingsLink` 形式で「利用規約」「プライバシーポリシー」行+「お問い合わせ」
   (外部リンクのため `<a>` 版の行を追加)。
   - 受け入れ: 設定画面に 3 行が表示され遷移できる
   - 検証: `tests/routes/SettingsPage.test.tsx` に追記 + 既存テスト green
   - Files: `src/routes/SettingsPage.tsx`, `tests/routes/SettingsPage.test.tsx`

**✅ チェックポイント 3**: ログイン前後の両導線からページへ到達できる・テスト/lint/build 全 green

### Phase 4: 確定・手動作業

7. **Task 7: 文面確定反映 + フォーム URL 差し替え(XS〜S)**
   ユーザーレビューで確定した文面・制定日・事業者表記を反映。
   ユーザー作成の Google フォーム URL を `CONTACT_FORM_URL` に設定。
   - 受け入れ: spec の Success Criteria(文面確定済み・記載内容一致)を満たす
   - 検証: `npm run test && npm run lint && npm run build` 全 green + 手動スモーク
     (未ログイン/ログイン両状態でページ表示・フォーム到達)
   - Files: `src/features/legal/*`(文面・定数)

**✅ 最終チェックポイント**: spec-issue14.md の Success Criteria 全項目を満たす

## 並行可能性

- T2(文面ドラフト)は T1 と並行可能(コード非依存)
- T3 と T4、T5 と T6 はそれぞれ独立(直列でも十分小さい)
- ユーザーの手動作業(文面レビュー・Google フォーム作成)は T2 提示時点で依頼し、
  T7 までに揃えばよい(実装をブロックしない)

## リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| BrowserRouter 移動で既存テスト(App.test 等)が壊れる | 高 | Phase 1 で最初に実施し、既存テスト全 green を T1 の完了条件にする |
| `Gate` 内入れ子 `<Routes>` のパス解決の想定違い | 中 | T1 で全既存ルートの表示をテストで確認(`path="*"` 配下でも入れ子 Routes は URL 全体で再マッチする想定を検証) |
| 文面レビューの遅延 | 低 | ドラフトのまま実装を進め、T7 で確定文面に差し替える構成にして直列依存を切る |
| フォーム URL 未確定 | 低 | プレースホルダ定数 1 箇所に集約し T7 で差し替え |

## Open Questions(ユーザー作業・判断)

- 事業者(運営者)表記名・制定日(T2 のレビューで確定)

## 確定済み

- Google フォーム URL(2026-07-18 共有済み): `https://forms.gle/CmpLMKN9XWkxirNDA`
  → プレースホルダ不要。T3 で最初から `CONTACT_FORM_URL` に実 URL を設定する
