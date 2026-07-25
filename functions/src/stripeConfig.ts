/** 買い切り税込価格（JPY）。Stripe Price と一致させること */
export const LIFETIME_PRICE_AMOUNT_JPY = 480;

export interface CheckoutConfig {
  secretKey: string;
  priceId: string;
  /** success / cancel URL のオリジン（末尾スラッシュなし想定） */
  appBaseUrl: string;
}

export interface WebhookConfig {
  secretKey: string;
  webhookSecret: string;
  priceId: string;
}

function requiredEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is not set`);
  }
  return value;
}

/**
 * Checkout Session 作成に必要な設定だけを読む。
 * `STRIPE_WEBHOOK_SECRET` は要求しない（Callable には bind されないため）。
 */
export function getCheckoutConfig(env: NodeJS.ProcessEnv = process.env): CheckoutConfig {
  return {
    secretKey: requiredEnv(env, 'STRIPE_SECRET_KEY'),
    priceId: requiredEnv(env, 'STRIPE_PRICE_ID'),
    appBaseUrl: requiredEnv(env, 'APP_BASE_URL').replace(/\/$/, ''),
  };
}

/**
 * Webhook 検証・付与に必要な設定だけを読む。
 * `APP_BASE_URL` は要求しない。
 */
export function getWebhookConfig(env: NodeJS.ProcessEnv = process.env): WebhookConfig {
  return {
    secretKey: requiredEnv(env, 'STRIPE_SECRET_KEY'),
    webhookSecret: requiredEnv(env, 'STRIPE_WEBHOOK_SECRET'),
    priceId: requiredEnv(env, 'STRIPE_PRICE_ID'),
  };
}
