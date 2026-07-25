export interface StripeConfig {
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
 * Stripe 用の秘密設定を process.env（または差し替え env）から読む。
 * 秘密鍵は Functions 側のみ。クライアントバンドルには載せない。
 */
export function getStripeConfig(env: NodeJS.ProcessEnv = process.env): StripeConfig {
  return {
    secretKey: requiredEnv(env, 'STRIPE_SECRET_KEY'),
    webhookSecret: requiredEnv(env, 'STRIPE_WEBHOOK_SECRET'),
    priceId: requiredEnv(env, 'STRIPE_PRICE_ID'),
  };
}
