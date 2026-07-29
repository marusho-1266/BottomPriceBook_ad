# デプロイ手順メモ: 買い切り決済（Issue #37）

> Status: **Ready for deploy prep** / 作成: 2026-07-25  
> 前提: #36（ライセンスガード・ミラー）と **同時デプロイ**すること。#36 だけ先に出すと無料ユーザーの招待・CSV が止まる。

## Functions 環境変数 / Secret

### Secret Manager（必須・Live 鍵投入前）

決済秘密は平文の `functions/.env.*` に置かない。`defineSecret` 経由:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

ローカル Emulator は `functions/.secret.local`（コミットしない）に同名で書く。

| Secret | Test Mode | Live（本番課金 ON） |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` または Dashboard の Test endpoint secret | Live endpoint secret |

### 通常 env（秘密ではない）

`functions/.env.<Firebase プロジェクト ID>`（コミットしない）:

| 変数 | 内容 |
|---|---|
| `STRIPE_PRICE_ID` | 税込 ¥480 の Price ID（Test / Live それぞれ） |
| `APP_BASE_URL` | Hosting オリジン（末尾スラッシュなし） |
| `SENTRY_DSN` | （任意・既存どおり平文で可） |

ローカル Webhook 転送例:

```bash
stripe listen --forward-to http://127.0.0.1:5001/<project>/asia-northeast1/stripeWebhook
```

本番 Webhook エンドポイントは **`firebase deploy` の出力に表示された実 URL** を使うこと。  
Gen2 では `https://asia-northeast1-<project>.cloudfunctions.net/stripeWebhook` エイリアスに加え `*.run.app` も存在する。

イベント: `checkout.session.completed`（遅延決済を有効にする場合は `checkout.session.async_payment_succeeded` も）

## 価格変更時（Ask first）

税込 ¥480 は次の **3 箇所を同時更新**:

1. Stripe Dashboard の Price（新 Price ID → `STRIPE_PRICE_ID`）
2. `functions/src/stripeConfig.ts` の `LIFETIME_PRICE_AMOUNT_JPY`（Webhook 金額検証）
3. `src/features/license/pricing.ts` の `LIFETIME_PRICE_JPY`（UI 表示）

## 公開前チェックリスト

- [ ] PR #39（#36）が main にマージ済み、または本 PR と同時にマージする
- [ ] 特商法ページ（`/tokushoho`）の事業者実情報を差し替え済み（`【公開前差し替え】` が残っていない）
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` を Secret Manager に設定済み（平文 env に Live 鍵を置いていない）
- [ ] Live Price・本番 Webhook の**デプロイ出力 URL**を Stripe に登録済み
- [ ] Test Mode で Checkout → Webhook → 「買い切り済み」＋制限解除を手動確認済み
- [ ] `npm run test && npm run test:rules && npm run lint && npm run build`
- [ ] `cd functions && npm test && npm run build`
- [ ] Hosting + Functions + Rules をまとめてデプロイ（#36 と同時）

## ロールバックメモ

- Functions / Rules / Hosting は通常の Firebase デプロイ履歴から戻せる
- 既に付与された `lifetime` は自動では戻らない（返金運用は `docs/spec-issue37.md` の返金節）
