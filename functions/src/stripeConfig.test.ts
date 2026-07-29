import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getCheckoutConfig, getWebhookConfig } from './stripeConfig.js';

const ENV_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID',
  'APP_BASE_URL',
] as const;

function setCheckoutEnv(): void {
  process.env.STRIPE_SECRET_KEY = ' sk_test_xxx ';
  process.env.STRIPE_PRICE_ID = ' price_zzz ';
  process.env.APP_BASE_URL = ' https://app.example.com/ ';
}

function setWebhookEnv(): void {
  process.env.STRIPE_SECRET_KEY = ' sk_test_xxx ';
  process.env.STRIPE_WEBHOOK_SECRET = ' whsec_yyy ';
  process.env.STRIPE_PRICE_ID = ' price_zzz ';
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

test('Checkout に必要な env だけ揃っていれば成功する（WEBHOOK_SECRET 不要）', () => {
  setCheckoutEnv();

  const config = getCheckoutConfig();

  assert.deepEqual(config, {
    secretKey: 'sk_test_xxx',
    priceId: 'price_zzz',
    appBaseUrl: 'https://app.example.com',
  });
});

test('Checkout: STRIPE_SECRET_KEY 未設定ならエラー', () => {
  setCheckoutEnv();
  delete process.env.STRIPE_SECRET_KEY;

  assert.throws(() => getCheckoutConfig(), /STRIPE_SECRET_KEY/);
});

test('Checkout: STRIPE_PRICE_ID 未設定ならエラー', () => {
  setCheckoutEnv();
  delete process.env.STRIPE_PRICE_ID;

  assert.throws(() => getCheckoutConfig(), /STRIPE_PRICE_ID/);
});

test('Checkout: APP_BASE_URL 未設定ならエラー', () => {
  setCheckoutEnv();
  delete process.env.APP_BASE_URL;

  assert.throws(() => getCheckoutConfig(), /APP_BASE_URL/);
});

test('Checkout: WEBHOOK_SECRET が無くても成功する（本番 Callable bind 相当）', () => {
  setCheckoutEnv();
  delete process.env.STRIPE_WEBHOOK_SECRET;

  assert.doesNotThrow(() => getCheckoutConfig());
});

test('Webhook に必要な env だけ揃っていれば成功する（APP_BASE_URL 不要）', () => {
  setWebhookEnv();

  const config = getWebhookConfig();

  assert.deepEqual(config, {
    secretKey: 'sk_test_xxx',
    webhookSecret: 'whsec_yyy',
    priceId: 'price_zzz',
  });
});

test('Webhook: STRIPE_WEBHOOK_SECRET 未設定ならエラー', () => {
  setWebhookEnv();
  delete process.env.STRIPE_WEBHOOK_SECRET;

  assert.throws(() => getWebhookConfig(), /STRIPE_WEBHOOK_SECRET/);
});

test('空文字や空白のみは未設定扱い', () => {
  setCheckoutEnv();
  process.env.STRIPE_SECRET_KEY = '   ';

  assert.throws(() => getCheckoutConfig(), /STRIPE_SECRET_KEY/);
});
