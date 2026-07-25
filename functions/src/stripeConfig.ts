/** 買い切り税込価格（JPY）。Stripe Price と一致させること */
export const LIFETIME_PRICE_AMOUNT_JPY = 480;

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
  /** success / cancel URL のオリジン（末尾スラッシュなし想定） */
  appBaseUrl: string;
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is not set`);
  }
  return value;
}

/**
 * Stripe 用の設定を process.env（または差し替え env）から読む。
 * `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` は本番では defineSecret 経由で
 * Secret Manager からランタイム env にマウントされる（クライアントには出さない）。
 * `STRIPE_PRICE_ID` / `APP_BASE_URL` は秘密ではないので通常の Functions env でよい。
 */
export function getStripeConfig(env: NodeJS.ProcessEnv = process.env): StripeConfig {
  return {
    secretKey: requiredEnv(env, 'STRIPE_SECRET_KEY'),
    webhookSecret: requiredEnv(env, 'STRIPE_WEBHOOK_SECRET'),
    priceId: requiredEnv(env, 'STRIPE_PRICE_ID'),
    appBaseUrl: requiredEnv(env, 'APP_BASE_URL').replace(/\/$/, ''),
  };
}
