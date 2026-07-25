# 実装計画: 買い切り決済（Issue #37）

> Status: **Implemented** / 作成日: 2026-07-25 / 実装完了: 2026-07-25
> 対象仕様: `docs/spec-issue37.md`（Approved）
> タスク分解: `docs/tasks-issue37.md`
> デプロイ手順: `docs/deploy-issue37.md`
> 前提: #36（ライセンスガード・ミラー）がマージ済みであること。無料枠の再実装はしない

## 方針

- **付与ヘルパを最初に固める**（`grantLifetimeLicense`）。Webhook と将来の #38 が同じ入口を使う
- **秘密は Functions のみ**（`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID`）。クライアントは Callable で Session URL を貰うだけ
- **Checkout は Hosted**。成功・キャンセルとも設定へ戻し、UI の真実は Webhook 後の Firestore 購読
- **法務は縦スライス後半**でも、公開ブロックにならないよう特商法プレースホルダ＋規約改定を同 PR に含める
- 各タスク終了時に該当テスト（`npm run test` / `cd functions && npm test`）を通してから次へ

## スコープ境界

| 本 Issue | 含めない |
|---|---|
| Stripe Checkout Session 作成 | 無料枠・招待／CSV ガードの再実装（#36） |
| Webhook 署名検証 + 冪等 lifetime 付与 | プロモ（#38） |
| CTA → Checkout、購入済み表示 | Stripe Tax、埋め込み Payment Element |
| 特商法ページ＋導線、規約・ポリシー更新 | 独自領収 UI、返金自動化 |
| users + owner books ミラー＋Session 処理済みを同一 txn | `I36-BACKLOG-1` 件数サーバー強制 |

## アーキテクチャ上の決定

| 決定 | 理由 |
|---|---|
| `onCall` で Checkout Session 作成 | 既存 `deleteAccount` と同じ。Auth 必須を Functions が強制。同時／再試行は idempotency key または pending-purchase の原子作成で Session 二重化を防ぐ（購入済み拒否は維持） |
| Webhook は `onRequest`（raw body で署名検証） | Stripe 署名検証に raw body が必要。Callable では困難 |
| `grantLifetimeLicense(uid, source, …)` 共有 | #36 不変条件＋#38 再利用。Webhook 内にベタ書きしない |
| オーナー book の列挙は `ownerUid == uid` クエリ（現状 1 件） | 仕様どおり全オーナー帳ミラー更新 |
| **冪等判定と付与は同一 Firestore トランザクション**（下記） | 同時 Webhook・部分書き込み・別 Session 上書きを防ぐ |
| 価格表示「税込 ¥480」は UI 定数＋Stripe Price と一致させる運用 | Tax 無し固定。Price 変更は Ask first |
| 特商法実情報はプレースホルダ定数 | 本番課金公開前に差し替え（仕様） |

### データ更新（付与時）— 同一トランザクション＋ミラー同期

冪等チェックを付与と別処理にしない。Stripe 経路の**真理の確定**は次を **1 トランザクション**に統合する（全書込み成功時のみコミット＝Session／イベントの処理済みが確定）:

```
transaction（コア・必須アトミック）:
  1) stripeCheckoutSessions/{sessionId} を読取
     - 未処理なら作成予約: { uid, stripeEventId, processedAt }
     - 処理済みなら license は「修復のみ」へ（購入メタは触らない）
  2) users/{uid}.license
     - 未 lifetime: status=lifetime, purchasedAt, source, stripeCheckoutSessionId を設定
     - 既に lifetime: 購入メタは上書きしない（別 Session・同時 Webhook 防止）
```

続けて **ミラー同期**（`syncOwnerBookMirrors(uid)`。付与・再実行・運用修復の共通入口）:

```
query: books where ownerUid == uid
各 book:
  - ownerLicenseStatus == 'lifetime' → 書込スキップ（no-op）
  - 欠落 / 'free' / 不一致 → 'lifetime' に更新（不足分の検出・修復）
```

- `stripeEventId`（`evt_...`）はコア txn の Session 処理済み doc に書き、外部の「先にイベント確定→後から license」はしない
- プロモ（#38）等 Session 無し経路は `users` コア＋同じミラー同期

#### 付与後に作られた book / 作成時経路（必須）

現状 `ensureBook` は常に `ownerLicenseStatus: 'free'`、Rules も create 時 lifetime を禁止している。付与クエリ以降の新規帳が free のまま残るため、次を **両方**入れる:

1. **作成時経路**: 新規 book 作成時に `users/{uid}.license.status` を読み、ミラーを `free` / `lifetime` で初期化する（`ensureBook` 更新）。Rules は「`lifetime` での create は、認証 uid の `users.license.status == 'lifetime'` のときだけ許可」に緩和（自己付与は引き続き不可。update でのミラー変更は Admin のみ維持）
2. **再同期**: Webhook 再送・同一 Session 再処理・手動／運用呼び出しで `syncOwnerBookMirrors` を再実行し、no-op 対象以外の不足ミラーを検出・更新する

#### 分割単位・サイズ制約・失敗時再試行

| 項目 | 方針 |
|---|---|
| Firestore 上限 | 1 batch / 1 txn あたり最大 **500** 書込。コア txn（Session＋users）は常にこの内に収める |
| ミラー分割 | 対象 book をクエリ後、**最大 400 書込／チャンク**（余裕を残す）に分割して順次 `writeBatch`（または同等）。現状 1 帳運用でも分割ロジックは実装しておく |
| コアとミラーの順序 | 先にコア txn をコミット（lifetime 真理を確定）→ 続けてチャンク同期。ミラー未完了でも Session は処理済みとし、再同期で完了させる |
| 失敗時 | チャンク失敗は指数バックオフで **最大 3 回**再試行。なお不足があればログ／監視し、次の Webhook 再送または明示的な `syncOwnerBookMirrors` 再実行で収束させる（購入メタの上書きはしない） |
| 検証 | 「lifetime 済み book は no-op」「free／欠落だけ更新」「複数チャンク」「作成時に lifetime ユーザーの新規帳が lifetime」をテストする |

クライアントからのミラー **update** は引き続き不可（#36）。create 時の lifetime は上記 Rules 条件付きのみ。

### 環境変数（Functions）

| 変数 | 用途 |
|---|---|
| `STRIPE_SECRET_KEY` | Session 作成 |
| `STRIPE_WEBHOOK_SECRET` | 署名検証 |
| `STRIPE_PRICE_ID` | 税込 480 円の Price |
| （既存）アプリの公開 URL 系 | success / cancel URL 組み立て |

ローカル: Stripe CLI `stripe listen --forward-to ...` + Test Mode 鍵。

## 主要コンポーネントと依存

```
licenseGrant.ts（純ロジック + Admin Firestore）
    │
    ├── stripeWebhook.ts（署名検証・Session 検証 → grantLifetimeLicense）
    │
    └── createCheckoutSession.ts（未購入チェック → Session URL）
            │
            └── クライアント startCheckout() → location.href = url

legal: TokushohoPage + Terms/Privacy 更新 + 導線
settings: CTA 接続 / 買い切り済み / purchase=success 案内
```

## 実装順序（フェーズ）

### Phase 0: 準備（人間作業含む）
- Stripe テスト Product/Price（¥480）作成、Price ID 控える
- #36 マージ確認

### Phase 1: 付与基盤
1. I37-T1: `stripe` 依存 + env 読み出し
2. I37-T2: `grantLifetimeLicense` + 単体／Functions テスト（冪等・ミラー）

### Phase 2: Stripe 接続
3. I37-T3: `createCheckoutSession` Callable
4. I37-T4: `stripeWebhook` onRequest
5. I37-T5: クライアント CTA 接続・購入済み UI・success クエリ

### Phase 3: 法務
6. I37-T6: 特商法ページ＋導線
7. I37-T7: 利用規約・プライバシー更新

### Phase 4: 仕上げ
8. I37-T8: 回帰・docs・デプロイ手順メモ

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| #36 未マージで本番に出す | High | 実装開始条件・デプロイは決済と同時（仕様） |
| Webhook 未到達で購入済みに見えない | Med | success 画面で「数秒かかる」案内。購読で自動更新。必要なら後続で Session 再取得 Ask first |
| raw body 破損で署名失敗 | Med | Firebase の rawBody / 推奨パターンをソース確認して実装（source-driven） |
| Price ID と UI 表示の不一致 | Low | 仕様に 480 固定。変更は Ask first |
| 特商法プレースホルダのまま公開 | High | Boundaries: 本番課金前に差し替え必須と tasks に明記 |

## Verification Checkpoints

- **A（Phase 1）**: コア txn（Session＋users）＋チャンクミラー同期。二重／同時で壊れない。lifetime 済みは no-opでも不足分は再同期で修復。作成時経路で lifetime ユーザーの新規帳が lifetime。別 Session で購入メタを上書きしない
- **B（Phase 2）**: Test Mode で Checkout → Webhook → lifetime。購入済みは CTA なし
- **C（Phase 3）**: `/tokushoho`・規約・ポリシー導線。無料のみ文言が消えている
- **D**: `npm run test && npm run test:rules && npm run lint && npm run build` + `cd functions && npm test && npm run build`

## Out of Scope

プロモ、サブスク、Tax、件数サーバー強制、返金自動化、独自領収、#36 ガードの作り直し

## 人間レビューで確認してほしい点

1. Callable（Session）+ onRequest（Webhook）の二本立てでよいか
2. ~~冪等キーの置き場~~ → **確定**: `stripeCheckoutSessions/{sessionId}`＋`users.license`＋ミラーを同一トランザクション。license にも付与元 Session ID を残すが、冪等の正は Session 処理済み doc
3. 本計画を Approved にして実装に進めてよいか
