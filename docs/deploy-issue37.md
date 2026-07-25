# デプロイ手順メモ: 買い切り決済（Issue #37）

> Status: **Ready for deploy prep** / 作成: 2026-07-25  
> 前提: #36（ライセンスガード・ミラー）と **同時デプロイ**すること。#36 だけ先に出すと無料ユーザーの招待・CSV が止まる。

## Functions 環境変数

`functions/.env.<Firebase プロジェクト ID>`（コミットしない）に設定:

| 変数 | Test Mode | Live（本番課金 ON） |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` または Dashboard の Test endpoint secret | Live endpoint secret |
| `STRIPE_PRICE_ID` | 税込 ¥480 の Test Price | 税込 ¥480 の Live Price |
| `APP_BASE_URL` | ローカル/プレビュー URL | 本番 Hosting オリジン（末尾スラッシュなし） |
| `SENTRY_DSN` | （任意） | 既存どおり |

ローカル Webhook 転送例:

```bash
stripe listen --forward-to http://127.0.0.1:5001/<project>/asia-northeast1/stripeWebhook
```

本番 Webhook エンドポイント（Functions デプロイ後）:

`https://asia-northeast1-<project>.cloudfunctions.net/stripeWebhook`

イベント: `checkout.session.completed`（遅延決済を有効にする場合は `checkout.session.async_payment_succeeded` も）

## 公開前チェックリスト

- [ ] PR #39（#36）が main にマージ済み、または本 PR と同時にマージする
- [ ] 特商法ページ（`/tokushoho`）の事業者実情報を差し替え済み（`【公開前差し替え】` が残っていない）
- [ ] Live 鍵・Live Price・本番 Webhook URL を設定済み
- [ ] Test Mode で Checkout → Webhook → 「買い切り済み」＋制限解除を手動確認済み
- [ ] `npm run test && npm run test:rules && npm run lint && npm run build`
- [ ] `cd functions && npm test && npm run build`
- [ ] Hosting + Functions + Rules をまとめてデプロイ（#36 と同時）

## ロールバックメモ

- Functions / Rules / Hosting は通常の Firebase デプロイ履歴から戻せる
- 既に付与された `lifetime` は自動では戻らない（返金運用は `docs/spec-issue37.md` の返金節）
