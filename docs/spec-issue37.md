# Spec: Issue #37 買い切り決済の実装（Stripe・ライセンス付与・法務）

> Status: **Approved** / 作成: 2026-07-25 / 承認: 2026-07-25
> 対象 Issue: [#37 買い切り決済の実装（Stripe・ライセンス付与・法務）](https://github.com/marusho-1266/BottomPriceBook_ad/issues/37)
> 親仕様: `docs/spec.md` / ライセンスモデル: `docs/spec-issue36.md`（Approved）/ 実装計画メモ: `docs/plan-issue36.md`
> 関連: 法務基盤 `docs/spec-issue14.md` / プロモ #38
> 前提: **#36（PR #39）のマージ**。無料枠・招待／CSV ガード・ミラーは再実装しない
> 実装計画: `docs/plan-issue37.md`（Approved / In Progress）/ タスク: `docs/tasks-issue37.md`（In Progress）

## ヒアリング結果（2026-07-25 確定）

1. **価格**: 税込 **¥480（JPY）**。Stripe Tax は使わず税込固定
2. **決済 UI**: **Stripe Checkout（Hosted）** の一回払い。アプリ内カードフォームは作らない
3. **返金**: 原則不可（デジタル・買い切り）。不具合時のみ個別対応。アプリ内返金 UI なし
4. **#36 との境界**: 無料枠・共有ゲスト制限の**再実装はしない**。決済・付与・法務・CTA 実接続に限定
5. **購入後**: 設定へ戻る（例: `/settings?purchase=success`）。付与の真実は **Webhook（冪等）**
6. **キャンセル**: 設定へ戻る。重いエラー表示はしない（短い案内は可）
7. **特商法**: ページ＋導線は本 Issue で用意。事業者の実値は差し替え前提（公開前に確定）
8. **購入済み**: Checkout を開かず、設定で **「買い切り済み」** 表示。CTA は出さない

## 前提（仮定 — 誤りがあれば指摘してください）

1. **#36 が main に入っていること**を実装開始条件とする（未マージなら本仕様のレビューのみ先行可）
2. ライセンス付与は `docs/plan-issue36.md` の不変条件どおり、`users/{uid}.license` とオーナーの全 `books/{id}.ownerLicenseStatus` を **同一バッチで更新**
3. Checkout Session 作成は **Cloud Functions（認証必須）**。`uid` を metadata / `client_reference_id` に載せる
4. Stripe Product/Price はダッシュボードで作成し、**Price ID は環境変数**（クライアントに秘密鍵を出さない）
5. Webhook は **署名検証必須**。同じ `checkout.session.id`（または payment intent）で二重付与しない
6. 領収は **Stripe の購入完了メール**に委ねる（独自領収 UI は本 Issue に含めない）
7. プライバシーポリシーは課金・決済代行（Stripe）へのデータ提供を必要最小限追記する
8. 利用規約から「無料サービスのみ」前提を改め、買い切り・無料枠の存在を反映する
9. テストは Stripe Test Mode + Emulator。本番鍵・Webhook エンドポイントはデプロイ手順で設定
10. #38（プロモ）は別経路で同じ `lifetime` を立てる。本 Issue は Stripe 経路のみ

## Objective

### 何を作るか

「そこねこ」の買い切り（lifetime）を、Stripe Checkout 一回払い（税込 480 円）で購入できるようにする。支払い成功後にアカウントへ利用権を付与し、#36 で入れた無料枠ガードが解除される。有料化に伴い利用規約を更新し、特定商取引法に基づく表記ページを追加する。

### 背景・課題

#36 でライセンスモデルとクライアント／Rules ガードは入ったが、lifetime への正規な昇格経路と法務表記が無い。現状のまま本番デプロイすると全ユーザーが free 扱いで招待・CSV が止まるため、**決済と法務を揃えてから公開する**必要がある。

### ユーザーストーリー

- 無料ユーザーとして、設定の CTA から税込 480 円で買い切りを購入したい
- 購入後、同じアカウントで再ログインすれば制限が解除された状態で使いたい
- 購入済みなら「買い切り済み」と分かり、誤って再購入したくない
- 購入前に特商法表記・利用規約を確認したい

## Tech Stack

- 既存: React 19 / Vite / Firebase Auth・Firestore / Cloud Functions
- 追加想定: `stripe`（Functions 側）、必要なら薄いクライアント呼び出しのみ（秘密鍵は Functions のみ）
- Stripe Checkout Session API + Webhook（`checkout.session.completed` を主）

## Commands

```
npm run lint
npm run test
npm run test:rules
npm run build
cd functions && npm test && npm run build
npm run emulators   # Auth / Firestore / Functions（Webhook ローカル検証は stripe listen 等）
```

## Project Structure（実装時の想定）

```
docs/spec-issue37.md              → 本仕様
functions/src/
  createCheckoutSession.ts        → 認証ユーザー向け Checkout Session 作成（新規）
  stripeWebhook.ts                → 署名検証・冪等ライセンス付与（新規）
  licenseGrant.ts                 → users + books ミラー同一バッチ更新（共有ヘルパ）
src/features/license/             → CTA を実 Checkout 起動に接続、購入済み表示
src/features/legal/
  TokushohoPage.tsx               → 特商法表記（新規）
  TermsPage.tsx / PrivacyPage.tsx → 有料化に合わせて更新
src/App.tsx                       → `/tokushoho`（または同等）ルート
```

## 決済・付与仕様

### 商品

| 項目 | 値 |
|---|---|
| 価格 | 税込 ¥480（JPY） |
| 種別 | 一回払い（lifetime） |
| Tax | Stripe Tax 不使用（税込固定） |

### フロー

1. 未購入ユーザーが設定等の CTA を押す
2. ログイン済みであること（未ログインならログイン誘導）
3. Callable / HTTPS Function が Checkout Session を作成し URL を返す（同時／再試行は idempotency key または pending-purchase 原子作成で二重 Session を防ぐ。購入済みは拒否）
4. Hosted Checkout へリダイレクト
5. 成功: `success_url` → 設定（`purchase=success` 可）。キャンセル: `cancel_url` → 設定
6. Stripe が Webhook を送信 → 署名検証 → **Session 検証**（下記）→ 合格時のみ `license.status = lifetime` + ミラー更新（同一バッチ）
7. クライアントは license 購読で UI を更新。「反映まで数秒」案内は可

### 冪等・安全

- クライアントは `lifetime` を書けない（#36 Rules 維持）
- Webhook は Session 処理済み記録＋license＋ミラーを**同一トランザクション**で冪等化（既存 lifetime でも欠落ミラーは修復。別 Session で購入メタを上書きしない）
- 購入済みユーザーには Checkout を開始させない（UI で「買い切り済み」）
- **付与前に対象 Checkout Session を検証する**（uid / Session ID の解決だけでは付与しない）。合格条件:

  | 検証項目 | 期待値 |
  |---|---|
  | `mode` | `payment` |
  | `payment_status` | `paid`（未払い・`unpaid` / `no_payment_required` 等は付与しない） |
  | line item の Price ID | 環境変数の想定 `STRIPE_PRICE_ID` と一致 |
  | 通貨・金額 | `JPY` かつ税込 **480**（`amount_total` 等。Session 作成時と同一） |
  | metadata / `client_reference_id` | 作成時に載せた `uid` と一致。欠落・不一致は付与しない |

- **遅延決済**: カード即時決済を主とする。遅延手段を有効化する場合でも、成功とみなすイベント（例: `checkout.session.completed` で既に `paid`、および `checkout.session.async_payment_succeeded`）は**同一の Session 検証経路**を通してから付与する。`completed` 時点で未払いの Session は付与せずログ／監視し、後続の成功イベントで再検証する
- 署名不正・検証不合格・未払い・uid 解決不可のイベントは **付与せずログ／監視**（Webhook 応答は Stripe 再送方針に合わせる。未知イベント種別は 200 で無視可）

### 返金

- 原則不可。特商法・利用規約に明記。アプリ内返金 UI なし
- 不具合・二重課金等は問い合わせ経由で個別対応（Stripe Dashboard で返金実行）

#### 返金後の license 状態（運用の単一ルール）

| ケース | license 状態 | ミラー |
|---|---|---|
| **付与元決済の全額返金**（誤購入・不具合による解約相当） | **取り消す（revoke）** → `status: 'free'` | オーナー帳の `ownerLicenseStatus` も `free` に戻す（付与と同じ同一バッチ） |
| **二重課金のうち余剰分のみ返金**（正規の1回分は残す） | **維持（retain）** → `lifetime` のまま | 変更なし |
| 部分返金・その他例外 | 問い合わせ記録に明示した方針に従う。未記載なら revoke 扱い | 上に合わせる |

- **停止（suspend）状態は導入しない**（`free` / `lifetime` の二値を維持）
- Stripe `charge.refunded` 等による**自動取り消しは本 Issue 必須にしない**（Ask first）。手動運用でも上表を一貫して適用する

#### 返金の識別子

運用・記録で必ず残す ID（Stripe Dashboard / サポート記録 / 可能なら `users/{uid}.license` メタ）:

| 識別子 | 用途 |
|---|---|
| `stripeRefundId`（`re_...`） | 返金そのものの一意キー。同一返金の二重適用防止 |
| `stripeCheckoutSessionId`（付与時に保存済みの `cs_...`） | どの購入を取り消したかの紐づけ |
| Firebase `uid` | 対象アカウント |

#### 運用手順（一貫適用）

1. 問い合わせ内容を確認し、上表のケース（revoke / retain）を決める
2. Stripe Dashboard で返金を実行し、`re_...` を控える
3. サポート記録（Issue／メールスレ等）に **uid・Session ID・Refund ID・決定（revoke/retain）・理由・実施日時** を残す
4. **revoke の場合のみ** Admin SDK（または将来の `revokeLifetimeLicense` ヘルパ）で `users/{uid}.license` を `free` にし、当該ユーザーがオーナーの全 book ミラーを同一バッチで `free` に戻す。`stripeRefundId` / `revokedAt` を license に記録してよい（スキーマ拡張は実装時に最小追加）
5. **retain の場合**は Firestore を触らず、記録のみで完了とする
6. 既に同じ `stripeRefundId` で処理済みなら no-op（手動でも二重取り消ししない）

## 法務仕様

### 特定商取引法に基づく表記

- 公開ルート（例: `/tokushoho`）を追加
- 導線: 設定・ログインフッター（既存 legal リンク列に追加）
- 記載項目（最低限）: 販売業者、運営責任者、所在地、連絡先（既存問い合わせフォーム可）、販売価格（税込 480 円・買い切り）、支払方法（クレジットカード等 Stripe 経由）、提供時期（決済完了後ただちに利用権付与）、返品・キャンセル（原則不可／不具合時は問い合わせ）
- **実の氏名・住所等はプレースホルダまたは確定文面。本番公開前に差し替え必須**

### 利用規約

- 「個人開発の無料サービス」のみの前提を改訂
- 無料枠と買い切り lifetime、決済は Stripe、返金方針を追記
- 制定日／改定日を更新

### プライバシーポリシー

- 決済処理のため Stripe に必要な情報が渡ること（カード情報は Stripe が処理し当方サーバーに保存しない旨）を追記
- 改定日を更新

## UX 仕様（#36 CTA の接続）

| 状態 | 表示 |
|---|---|
| 未購入 | 「税込 ¥480（買い切り）」を含む CTA → Checkout 開始 |
| 購入処理中／戻り直後 | 短い「反映中」案内可 |
| 購入済み | **「買い切り済み」**。購入 CTA なし |
| ゲストが free オーナー帳 | #36 どおり。ゲスト向け誤購入誘導はしない |

金額・決済の詳細 UI は Checkout 側に任せる。アプリ側は導線と状態表示に留める。

## Code Style

親仕様および #36 に従う。付与は共有関数に閉じる例:

```ts
/** Webhook / 将来のプロモ(#38) から呼ぶ */
export async function grantLifetimeLicense(params: {
  uid: string;
  source: 'stripe' | 'promo';
  purchasedAt: FirebaseFirestore.Timestamp;
  stripeCheckoutSessionId?: string;
  stripeEventId?: string;
}): Promise<void> {
  // 1) コア txn: Session 処理済み＋users.license（購入メタは既存 lifetime を上書きしない）
  // 2) syncOwnerBookMirrors: lifetime は no-op、欠落/free は修復（400 件チャンク・再試行）
  // 新規 book は ensureBook が users.license を反映（付与後作成の取りこぼし防止）
}
```

## Testing Strategy

| レベル | 対象 |
|---|---|
| 単体 | Session 作成の入力検証、冪等付与ヘルパ（モック Firestore） |
| Functions | Webhook 署名不正は拒否、検証合格で lifetime + ミラー、二重配信で二度書きしない。未払い・Price／金額不一致・metadata 欠落は付与しない |
| コンポーネント | 未購入 CTA 表示・購入済みで CTA 非表示、「買い切り済み」表示 |
| 手動 / Test Mode | Checkout 成功→数秒以内に制限解除、キャンセルで設定に戻る、特商法・規約の導線 |

## Boundaries

- **Always**
  - Webhook 署名検証・Session 検証（mode / paid / Price・金額 / metadata）と冪等付与
  - 秘密鍵・Webhook secret をクライアントに出さない
  - #36 のミラー不変条件（users + books。Stripe 経路は Session 処理済みと同一トランザクション）を守る
  - 特商法の実情報未確定のまま本番課金を公開しない
- **Ask first**
  - 価格変更、返金時の license 取り消し**自動化**（手動運用ルール自体は「返金」節で定義済み）
  - Stripe Tax / インボイス制度の本格対応
  - Payment Element 埋め込みへの変更
  - #36 未マージのまま本番 Functions だけ先に出すこと
- **Never**
  - クライアントだけで `lifetime` を永続化しない
  - 無料枠ロジックを #37 で作り直さない（#36 を前提）
  - プロモコード実装に手を出さない（#38）
  - サブスク化しない

## Success Criteria

- [ ] 未購入ユーザーが Checkout で税込 480 円を払い、同一アカウントで lifetime になる
- [ ] 付与後、#36 の制限（商品/店舗/招待/CSV）がオーナー帳で解除される
- [ ] 購入者の共有帳にいる無料ゲストは、その帳では制限なく使える（#36 回帰）
- [ ] 購入済み UI は「買い切り済み」で再購入導線がない
- [ ] Webhook は署名検証され、二重イベントでもライセンスが壊れない
- [ ] 特商法ページと設定／ログインからの導線がある（実情報は公開前差し替え）
- [ ] 利用規約が「無料のみ」前提のまま残っていない
- [ ] プライバシーに Stripe／決済関連の追記がある

## 非スコープ

- 無料枠・共有ルールの再実装（#36）
- 管理者プロモ（#38）
- サブスク、StoreKit、広告、iOS アプリ
- 独自領収書 UI、インボイス登録番号の本格対応（Ask first）
- `I36-BACKLOG-1`（件数のサーバー強制）

## Open Questions

なし（承認時に下記方針で確定）

## 解決済み事項（記録）

- 価格 → 税込 ¥480 / Stripe Tax なし（2026-07-25）
- 決済 → Stripe Checkout Hosted。Webhook は Session 検証（mode=payment / paid / Price・JPY480 / metadata）合格後のみ付与。遅延決済は同一検証経路（2026-07-25）
- 返金 → 原則不可。付与元全額返金は revoke（`free`+ミラー戻し）、二重課金の余剰返金は retain。識別子は `re_` + Session + uid。自動取り消しは Ask first（2026-07-25）
- スコープ → #36 再実装なし（2026-07-25）
- 成功戻り → 設定 + Webhook 付与（2026-07-25）
- 特商法 → ページ＋導線、実値は差し替え前提（2026-07-25）
- 購入済み → 「買い切り済み」、Checkout しない（2026-07-25）
- 特商法の実事業者情報 → **実装中はプレースホルダ可。本番課金公開前に必須差し替え**（2026-07-25 承認）
- デプロイ順 → **#36 の本番反映は決済準備（本 Issue）と同時、または招待・CSV 一斉停止を意図的に受け入れるまで待つ**（2026-07-25 承認）
