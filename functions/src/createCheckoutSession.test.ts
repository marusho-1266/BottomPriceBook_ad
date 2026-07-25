import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';
import {
  handleCreateCheckoutSession,
  type CreateCheckoutSessionDeps,
  type StripeCheckoutCreator,
} from './createCheckoutSession.js';

const PROJECT_ID = 'demo-checkout-session';
const FIRESTORE_HOST = '127.0.0.1:8080';

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

let app: App;
let firestore: Firestore;

before(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'checkout-session-test');
  firestore = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

async function clearFirestore(): Promise<void> {
  const response = await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  assert.equal(response.ok, true);
}

beforeEach(async () => {
  await clearFirestore();
});

function authRequest(uid: string): CallableRequest {
  return { auth: { uid, token: {} } } as unknown as CallableRequest;
}

function makeDeps(overrides: Partial<CreateCheckoutSessionDeps> = {}): CreateCheckoutSessionDeps {
  const createStripeCheckoutSession: StripeCheckoutCreator = async () => ({
    id: 'cs_test_created',
    url: 'https://checkout.stripe.com/c/pay/cs_test_created',
  });
  return {
    firestore,
    appBaseUrl: 'https://app.example.com',
    priceId: 'price_test_480',
    createStripeCheckoutSession,
    now: () => Date.parse('2026-07-25T00:00:00.000Z'),
    sleep: async () => undefined,
    ...overrides,
  };
}

test('未認証は拒否する', async () => {
  await assert.rejects(
    () => handleCreateCheckoutSession({ auth: undefined } as unknown as CallableRequest, makeDeps()),
    (error: unknown) =>
      error instanceof Error && 'code' in error && (error as { code: string }).code === 'unauthenticated',
  );
});

test('lifetime 済みは Checkout を作らず失敗する', async () => {
  await firestore.collection('users').doc('alice').set({
    license: { status: 'lifetime', source: 'stripe' },
  });
  let created = 0;
  await assert.rejects(
    () =>
      handleCreateCheckoutSession(
        authRequest('alice'),
        makeDeps({
          createStripeCheckoutSession: async () => {
            created += 1;
            return { id: 'cs', url: 'https://checkout.stripe.com/x' };
          },
        }),
      ),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'failed-precondition',
  );
  assert.equal(created, 0);
});

test('未購入は Checkout URL を返す', async () => {
  const result = await handleCreateCheckoutSession(authRequest('alice'), makeDeps());
  assert.equal(result.url, 'https://checkout.stripe.com/c/pay/cs_test_created');

  const pending = await firestore.collection('pendingCheckouts').doc('alice').get();
  assert.equal(pending.data()?.sessionId, 'cs_test_created');
  assert.equal(pending.data()?.url, result.url);
});

test('有効な未完了 Session があれば新規作成せず同じ URL を返す', async () => {
  await firestore.collection('pendingCheckouts').doc('alice').set({
    sessionId: 'cs_existing',
    url: 'https://checkout.stripe.com/c/pay/cs_existing',
    status: 'ready',
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs: Date.parse('2026-07-26T00:00:00.000Z'),
  });
  let created = 0;
  const result = await handleCreateCheckoutSession(
    authRequest('alice'),
    makeDeps({
      createStripeCheckoutSession: async () => {
        created += 1;
        return { id: 'cs_new', url: 'https://checkout.stripe.com/new' };
      },
    }),
  );
  assert.equal(result.url, 'https://checkout.stripe.com/c/pay/cs_existing');
  assert.equal(created, 0);
});

test('並行呼び出しでも Stripe Session 作成は 1 回', async () => {
  let created = 0;
  const createStripeCheckoutSession: StripeCheckoutCreator = async (_params, opts) => {
    created += 1;
    // 作成中に並行側が wait に入れるよう少し待つ
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 40);
    });
    assert.match(opts.idempotencyKey, /^checkout_alice_price_test_480_attempt-1$/);
    return {
      id: 'cs_parallel_1',
      url: 'https://checkout.stripe.com/c/pay/cs_parallel_1',
    };
  };

  const deps = makeDeps({
    createStripeCheckoutSession,
    createAttemptId: () => 'attempt-1',
    sleep: async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
    },
  });
  const [a, b] = await Promise.all([
    handleCreateCheckoutSession(authRequest('alice'), deps),
    handleCreateCheckoutSession(authRequest('alice'), deps),
  ]);

  assert.equal(created, 1);
  assert.equal(a.url, b.url);
  assert.equal(a.url, 'https://checkout.stripe.com/c/pay/cs_parallel_1');
});

test('期限切れ pending は新規試行 ID で Session を作り直す', async () => {
  await firestore.collection('pendingCheckouts').doc('alice').set({
    sessionId: 'cs_dead',
    url: 'https://checkout.stripe.com/c/pay/cs_dead',
    status: 'ready',
    attemptId: 'old-attempt',
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs: Date.parse('2026-07-24T00:00:00.000Z'),
  });

  let seenKey = '';
  let seenExpiresAt = 0;
  const result = await handleCreateCheckoutSession(
    authRequest('alice'),
    makeDeps({
      createAttemptId: () => 'new-attempt',
      createStripeCheckoutSession: async (params, opts) => {
        seenKey = opts.idempotencyKey;
        seenExpiresAt = params.expiresAtUnix;
        return { id: 'cs_fresh', url: 'https://checkout.stripe.com/c/pay/cs_fresh' };
      },
    }),
  );

  assert.equal(result.url, 'https://checkout.stripe.com/c/pay/cs_fresh');
  assert.equal(seenKey, 'checkout_alice_price_test_480_new-attempt');
  assert.equal(seenExpiresAt, Math.floor(Date.parse('2026-07-25T00:00:00.000Z') / 1000) + 24 * 60 * 60);

  const pending = await firestore.collection('pendingCheckouts').doc('alice').get();
  assert.equal(pending.data()?.attemptId, 'new-attempt');
  // pending 再利用は Stripe 期限(24h)より短い 23h
  assert.equal(
    pending.data()?.expiresAtMs,
    Date.parse('2026-07-25T00:00:00.000Z') + 23 * 60 * 60 * 1000,
  );
});
