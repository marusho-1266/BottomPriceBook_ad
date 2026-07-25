import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getStripeConfig } from './stripeConfig.js';

const ENV_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID'] as const;

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

test('設定済みなら secretKey / webhookSecret / priceId を返す', () => {
  process.env.STRIPE_SECRET_KEY = ' sk_test_xxx ';
  process.env.STRIPE_WEBHOOK_SECRET = ' whsec_yyy ';
  process.env.STRIPE_PRICE_ID = ' price_zzz ';

  const config = getStripeConfig();

  assert.deepEqual(config, {
    secretKey: 'sk_test_xxx',
    webhookSecret: 'whsec_yyy',
    priceId: 'price_zzz',
  });
});

test('STRIPE_SECRET_KEY 未設定ならエラー', () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_yyy';
  process.env.STRIPE_PRICE_ID = 'price_zzz';

  assert.throws(() => getStripeConfig(), /STRIPE_SECRET_KEY/);
});

test('STRIPE_WEBHOOK_SECRET 未設定ならエラー', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
  process.env.STRIPE_PRICE_ID = 'price_zzz';

  assert.throws(() => getStripeConfig(), /STRIPE_WEBHOOK_SECRET/);
});

test('STRIPE_PRICE_ID 未設定ならエラー', () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_yyy';

  assert.throws(() => getStripeConfig(), /STRIPE_PRICE_ID/);
});

test('空文字や空白のみは未設定扱い', () => {
  process.env.STRIPE_SECRET_KEY = '   ';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_yyy';
  process.env.STRIPE_PRICE_ID = 'price_zzz';

  assert.throws(() => getStripeConfig(), /STRIPE_SECRET_KEY/);
});
