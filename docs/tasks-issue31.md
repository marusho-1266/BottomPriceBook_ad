# タスク分解: 宣伝用 LP(Issue #31)

> Status: **Done** / 作成日: 2026-08-01 / Approved: 2026-08-01 / 実装完了: 2026-08-01
> 対象: `docs/spec-issue31.md`(Implemented) / 計画: `docs/plan-issue31.md`(Implemented)
> 実装は 1 タスク = 1 コミット相当で進める。各タスクの Verify を通してから次へ。
> 凡例は `docs/tasks.md` と同じ(受け入れ / Verify / 依存 / 規模)。

---

## Phase A: ルートと LP UI

- [x] **I31-T1: `WelcomePage` + 公開ルート配線 + テスト**
  - 内容:
    - `src/routes/WelcomePage.tsx` を新設。構成は Plan どおり:
      1. ヒーロー(ブランド「そこねこ」・見出し・一文・メイン CTA・Cat 等の視覚)
      2. できること(3 点)
      3. 利用イメージ
      4. フッター(再 CTA・`/terms`・`/privacy`)
    - コピーは `docs/plan-issue31.md` の表を初期値とする(語感の微調整可)
    - メイン CTA / 再 CTA は `<Link to="/">`、ラベル「無料で始める」
    - デザイントークンは既存(`bg-cream` / `bg-primary` / `rounded-b-[28px]` 等)。
      LoginScreen のトーンに寄せる。DesktopShell は使わない
    - `src/App.tsx` の外側 `Routes` に
      `<Route path="welcome" element={<WelcomePage />} />` を追加
      (`/terms`・`/privacy` と同列。`Gate` の外)
    - `tests/routes/WelcomePage.test.tsx` を新設し、少なくとも以下を検証:
      - 「そこねこ」およびヒーロー見出しが見える
      - 「できること」相当の 3 点(価格を記録 / 底値を確認 / 単価で比較)が見える
      - 利用イメージの文言が見える
      - メイン CTA が `href="/"`(または React Router の `/`)
      - フッターから利用規約・プライバシーへのリンクがある
  - Acceptance: 未認証でも描画できる LP が `/welcome` で公開され、CTA・規約導線が仕様どおり
  - Verify: `npm run test && npm run lint`
  - Files: `src/routes/WelcomePage.tsx`, `src/App.tsx`,
    `tests/routes/WelcomePage.test.tsx`
  - 依存: なし / 規模: M

### Checkpoint A
- [x] WelcomePage のテストがグリーン。`/welcome` が Gate 外にある

---

## Phase B: OGP

- [x] **I31-T2: og:image + `index.html` meta**
  - 内容:
    - `public/og-image.png` を新設(1200×630)。クリーム＋オレンジ＋「そこねこ」の簡易ブランド画像
    - `index.html` に以下を追加(ホストは Plan 確定値):
      - `meta name="description"`
      - `og:title` / `og:description` / `og:type` / `og:url` / `og:image`
      - `twitter:card` = `summary_large_image`(および必要なら twitter:title/description/image)
      - `og:url` = `https://sokoneko-2e8b7.web.app/welcome`
      - `og:image` = `https://sokoneko-2e8b7.web.app/og-image.png`
    - `<title>` は「そこねこ — 底値帳」を維持(または Plan の OGP title と整合)
    - description 文言は Plan の表に従う
  - Acceptance: 静的 HTML と画像だけで SNS クローラが読める OGP が揃う
  - Verify: `npm run build` で `dist/index.html` に meta があり `dist/og-image.png` が出力される。
    `npm run test && npm run lint` も通す
  - Files: `public/og-image.png`, `index.html`
  - 依存: なし(T1 と並列可だが、順序は T1 → T2 を推奨) / 規模: S

### Checkpoint B
- [x] `dist` に OGP meta と og-image が含まれる

---

## Phase C: 仕上げ

- [x] **I31-T3: 仕様の Success Criteria 更新 + 回帰**
  - 内容:
    - `docs/spec-issue31.md` の Success Criteria を達成状況に合わせて更新し、
      Status を Implemented(または相当)にする
    - `docs/plan-issue31.md` / `docs/tasks-issue31.md` の Status を完了にする
    - 手動確認チェックリストを docs かタスク末尾に残す:
      - 未ログインで `/welcome` が開く
      - CTA でログイン画面 `/` へ進む
      - デプロイ後の OGP プレビュー(運用手順。コミット完了条件にはファイル設置まで)
  - Acceptance: Spec の Success Criteria と実装が整合し、回帰テストがグリーン
  - Verify: `npm run test && npm run lint`
  - Files: `docs/spec-issue31.md`, `docs/plan-issue31.md`, `docs/tasks-issue31.md`
  - 依存: I31-T1, I31-T2 / 規模: XS

### Checkpoint C(最終)
- [x] lint / test グリーン
- [x] Spec Success Criteria を満たす(OGP 実プレビューはデプロイ後手動)

---

## 手動スモーク(実装後・デプロイ後)

- [ ] 未ログインで `/welcome` 表示
- [ ] 「無料で始める」→ ログイン画面
- [ ] フッターから規約・プライバシーへ遷移
- [ ] デプロイ後、SNS / OGP デバッガで title・description・image を確認
