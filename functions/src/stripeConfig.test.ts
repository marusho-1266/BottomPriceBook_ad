import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getStripeConfig } from './stripeConfig.js';

const ENV_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID',
  'APP_BASE_URL',
] as const;

function setValidEnv(): void {
  process.env.STRIPE_SECRET_KEY = ' sk_test_xxx ';
  process.env.STRIPE_WEBHOOK_SECRET = ' whsec_yyy ';
  process.env.STRIPE_PRICE_ID = ' price_zzz ';
  process.env.APP_BASE_URL = ' https://app.example.com/ ';
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

test('設定済みなら secretKey / webhookSecret / priceId / appBaseUrl を返す', () => {
  setValidEnv();

  const config = getStripeConfig();

  assert.deepEqual(config, {
    secretKey: 'sk_test_xxx',
    webhookSecret: 'whsec_yyy',
    priceId: 'price_zzz',
    appBaseUrl: 'https://app.example.com',
  });
});

test('STRIPE_SECRET_KEY 未設定ならエラー', () => {
  setValidEnv();
  delete process.env.STRIPE_SECRET_KEY;

  assert.throws(() => getStripeConfig(), /STRIPE_SECRET_KEY/);
});

test('STRIPE_WEBHOOK_SECRET 未設定ならエラー', () => {
  setValidEnv();
  delete process.env.STRIPE_WEBHOOK_SECRET;

  assert.throws(() => getStripeConfig(), /STRIPE_WEBHOOK_SECRET/);
});

test('STRIPE_PRICE_ID 未設定ならエラー', () => {
  setValidEnv();
  delete process.env.STRIPE_PRICE_ID;

  assert.throws(() => getStripeConfig(), /STRIPE_PRICE_ID/);
});

test('APP_BASE_URL 未設定ならエラー', () => {
  setValidEnv();
  delete process.env.APP_BASE_URL;

  assert.throws(() => getStripeConfig(), /APP_BASE_URL/);
});

test('空文字や空白のみは未設定扱い', () => {
  setValidEnv();
  process.env.STRIPE_SECRET_KEY = '   ';

  assert.throws(() => getStripeConfig(), /STRIPE_SECRET_KEY/);
});
