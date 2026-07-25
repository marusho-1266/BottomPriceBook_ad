# タスク分解: 買い切り決済（Issue #37）

> Status: **In Progress** / 作成日: 2026-07-25
> 対象: `docs/spec-issue37.md`（Approved）/ 計画: `docs/plan-issue37.md`
> 前提: #36 マージ済み。1 タスク = 1 コミット相当。Verify を通してから次へ
> 凡例は `docs/tasks.md` と同じ（受け入れ / Verify / 依存 / 規模）

---

## Phase 0: 準備（チェックリスト）

- [ ] **I37-T0a: #36 が main にマージされていることを確認**
  - Acceptance: ライセンスガード・ミラー・Rules が main にある
  - Verify: `git log main --oneline` / PR #39 merged
  - 依存: なし / 規模: —（人間）

- [ ] **I37-T0b: Stripe Test Mode で Product/Price（税込 ¥480）を作成**
  - Acceptance: `STRIPE_PRICE_ID` が控えてある。Test 鍵が Functions に渡せる
  - Verify: Stripe Dashboard（Test）
  - 依存: なし / 規模: —（人間）

---

## Phase 1: 付与基盤

- [x] **I37-T1: Functions に stripe 依存と設定読み出し**
  - 内容: `functions` に `stripe` 追加。秘密鍵・Webhook secret・Price ID を env / params から読む薄いモジュール
  - Acceptance: ビルド成功。秘密がクライアントバンドルに出ない
  - Verify: `cd functions && npm run build`
  - Files: `functions/package.json`, `functions/src/stripeConfig.ts`（名称可）, `.env.example` 相当のドキュメント更新
  - 依存: T0b（Price ID）/ 規模: S
  - 完了: 2026-07-25 — Price ID 実値は T0b（人間）。env 名・読み出しモジュールのみ先行

- [x] **I37-T2: `grantLifetimeLicense`＋ミラー同期（同一 txn コア・分割・作成時）**
  - 内容: コア txn で Session 処理済み＋`users.license`。続けて `syncOwnerBookMirrors`（lifetime は no-op、欠落/free は修復、400 件チャンク・失敗時最大 3 回再試行）。`ensureBook` は `users.license` に合わせてミラー初期化。Rules は create 時 lifetime を owner の license が lifetime のときだけ許可
  - Acceptance: コア冪等・別 Session 非上書き・book 0 件でも users 更新・不足ミラー修復・チャンク分割・lifetime ユーザーの新規帳が lifetime
  - Verify: `cd functions && npm test` および Rules / `ensureBook` 関連テスト
  - Files: `functions/src/licenseGrant.ts`, テスト, `src/features/books/api.ts`, `firestore.rules`, 関連テスト
  - 依存: I37-T1 / 規模: M
  - 完了: 2026-07-25

### Checkpoint A
- [x] grant ヘルパのテストが green

---

## Phase 2: Stripe 接続 + UI

- [x] **I37-T3: `createCheckoutSession` Callable**
  - 内容: 認証必須。既に lifetime なら失敗（専用エラー可）。mode=payment・Price ID・success/cancel URL（設定）・metadata に uid。URL を返す。**同時／再試行の認証済み呼び出しで Session が二重に作られない**よう、購入単位の idempotency key、または Firestore に原子的に作る pending-purchase 記録のいずれか（または併用）で直列化し、適用可能な場合は Stripe `Idempotency-Key`（または同等）に渡す。未完了の有効 Session があれば新規作成せずその URL を返してよい
  - Acceptance: 未購入は URL 返却、購入済みは Checkout を作らない（拒否維持）、未認証は拒否。並行呼び出しでも Stripe Session 作成は実質 1 回（同時実行テストで検証）
  - Verify: `cd functions && npm test`（lifetime 拒否＋**並行 create で Session 1 件**のテスト必須）
  - Files: `functions/src/createCheckoutSession.ts`, テスト, `functions/src/index.ts`
  - 依存: I37-T1, I37-T2 / 規模: M
  - 完了: 2026-07-25

- [ ] **I37-T4: `stripeWebhook` onRequest**
  - 内容: raw body で署名検証。`checkout.session.completed`（および遅延決済有効時は `async_payment_succeeded`）で Session 検証（mode / payment_status=paid / Price ID / JPY 480 / metadata uid）→ 合格時のみ `grantLifetimeLicense`。不正署名は 400。未検証・未払いは付与せずログ。未知イベントは 200 で無視可
  - Acceptance: 正当かつ検証合格で lifetime+ミラー。二重配信で壊れない。署名不正・金額／Price 不一致・未払いは付与しない
  - Verify: `cd functions && npm test`（署名は Stripe のテストヘルパ／固定ペイロード）。手動は `stripe listen` 任意
  - Files: `functions/src/stripeWebhook.ts`, テスト, `functions/src/index.ts`
  - 依存: I37-T1, I37-T2 / 規模: M

- [ ] **I37-T5: クライアント — Checkout 起動・購入済み・success 案内**
  - 内容: 設定等の CTA を Callable 接続。「税込 ¥480（買い切り）」表示。lifetime は「買い切り済み」で CTA なし。`?purchase=success` で短い反映待ち案内。キャンセル戻りは静か
  - Acceptance: 仕様 UX 表どおり。ゲスト向け誤購入誘導なし（#36 ctaCopy 維持）
  - Verify: `npm run test` && `npm run lint`
  - Files: `src/features/license/*`, `src/routes/SettingsPage.tsx`, 関連テスト, 必要なら薄い `api.ts`
  - 依存: I37-T3 / 規模: M

### Checkpoint B
- [ ] Test Mode で Checkout → Webhook → 制限解除（手動）
- [ ] 購入済み UI の自動テスト green

---

## Phase 3: 法務

- [ ] **I37-T6: 特商法ページ＋導線**
  - 内容: `/tokushoho`（名称可）と LegalLayout。設定・ログインフッターからリンク。価格・支払・返品方針は仕様どおり。事業者実値はプレースホルダ＋「公開前差し替え」コメント
  - Acceptance: 公開ルートで閲覧可。導線 2 箇所以上
  - Verify: `npm run test`（ルート／リンク）
  - Files: `src/features/legal/TokushohoPage.tsx`, `src/App.tsx`, `LoginScreen` / `SettingsPage`, テスト
  - 依存: なし（Phase 2 と並行可）/ 規模: M

- [ ] **I37-T7: 利用規約・プライバシー更新**
  - 内容: 無料のみ前提の削除。無料枠・買い切り・Stripe・返金方針。プライバシーに決済代行の記載。改定日更新
  - Acceptance: 「無料サービス」のみの断定が残っていない。課金関連が読める
  - Verify: 文面レビュー（人間）+ 既存 legal テスト更新
  - Files: `TermsPage.tsx`, `PrivacyPage.tsx`, テスト
  - 依存: なし（T6 と並行可）/ 規模: M

### Checkpoint C
- [ ] 特商法・規約・ポリシーの導線と文言が揃っている

---

## Phase 4: 仕上げ

- [ ] **I37-T8: 回帰・docs・デプロイ手順**
  - 内容: 全テスト。`plan`/`tasks`/`spec` Status 更新。README または docs に Test/Live 鍵・Webhook エンドポイント・特商法差し替え・**#36 と同時デプロイ**を短く記載
  - Acceptance: Checkpoint D のコマンド成功。公開前チェックリストが docs にある
  - Verify: `npm run test && npm run test:rules && npm run lint && npm run build` && `cd functions && npm test && npm run build`
  - Files: `docs/plan-issue37.md`, `docs/tasks-issue37.md`, `docs/spec-issue37.md`, 必要なら `README.md`
  - 依存: T3〜T7 / 規模: S

### Checkpoint D
- [ ] 上記コマンドすべて green
- [ ] 本番課金 ON の前に: 特商法実情報差し替え済み / Live 鍵 / Webhook 本番 URL

---

## 明示的に後続へ送るもの

| 項目 | 送り先 |
|---|---|
| 管理者プロモ | #38 |
| 件数サーバー強制 | I36-BACKLOG-1 |
| 返金時の license 取り消し自動化（手動ルールは spec「返金」節） | Ask first |
| Webhook 遅延時の Session 再検証 | Ask first |
