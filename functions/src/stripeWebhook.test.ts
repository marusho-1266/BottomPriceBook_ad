import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { handleStripeWebhook, type StripeWebhookDeps } from './stripeWebhook.js';

const PROJECT_ID = 'demo-stripe-webhook';
const FIRESTORE_HOST = '127.0.0.1:8080';
const WEBHOOK_SECRET = 'whsec_test_secret';
const PRICE_ID = 'price_test_480';

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

let app: App;
let firestore: Firestore;

before(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'stripe-webhook-test');
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

function paidSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: 'cs_test_1',
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    currency: 'jpy',
    amount_total: 480,
    metadata: { uid: 'alice' },
    client_reference_id: 'alice',
    ...overrides,
  } as Stripe.Checkout.Session;
}

function makeEvent(
  type: string,
  session: Stripe.Checkout.Session,
): { payload: string; signature: string; eventId: string } {
  const eventId = `evt_${type.replace(/\./g, '_')}_${session.id}`;
  const event = {
    id: eventId,
    object: 'event',
    type,
    data: { object: session },
  };
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return { payload, signature, eventId };
}

function mockRes() {
  let statusCode = 200;
  let body: unknown;
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    send(value: unknown) {
      body = value;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
    get result() {
      return { statusCode, body };
    },
  };
}

function makeDeps(overrides: Partial<StripeWebhookDeps> = {}): StripeWebhookDeps {
  return {
    firestore,
    webhookSecret: WEBHOOK_SECRET,
    priceId: PRICE_ID,
    retrieveCheckoutSession: async (sessionId) => ({
      ...paidSession({ id: sessionId }),
      line_items: {
        data: [{ price: { id: PRICE_ID } }],
      },
    }),
    ...overrides,
  };
}

test('不正署名は 400 で付与しない', async () => {
  const { payload } = makeEvent('checkout.session.completed', paidSession());
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': 'invalid' },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps(),
  );
  assert.equal(res.result.statusCode, 400);
  assert.equal((await firestore.collection('users').doc('alice').get()).exists, false);
});

test('正当な checkout.session.completed で lifetime とミラーを付与する', async () => {
  await firestore.collection('books').doc('alice').set({
    name: '帳',
    ownerUid: 'alice',
    memberUids: ['alice'],
    bottomWindowMonths: 6,
    createdAt: FieldValue.serverTimestamp(),
    ownerLicenseStatus: 'free',
  });
  const { payload, signature } = makeEvent('checkout.session.completed', paidSession());
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps(),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).data()?.license?.status, 'lifetime');
  assert.equal(
    (await firestore.collection('books').doc('alice').get()).data()?.ownerLicenseStatus,
    'lifetime',
  );
});

test('二重配信でも壊れない', async () => {
  const session = paidSession();
  const { payload, signature } = makeEvent('checkout.session.completed', session);
  const deps = makeDeps();
  const req = {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    rawBody: Buffer.from(payload),
  };
  await handleStripeWebhook(req, mockRes(), deps);
  await handleStripeWebhook(req, mockRes(), deps);
  const user = await firestore.collection('users').doc('alice').get();
  assert.equal(user.data()?.license?.stripeCheckoutSessionId, 'cs_test_1');
});

test('未払い Session は付与しない', async () => {
  const { payload, signature } = makeEvent(
    'checkout.session.completed',
    paidSession({ payment_status: 'unpaid' }),
  );
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps({
      retrieveCheckoutSession: async () => ({
        ...paidSession({ payment_status: 'unpaid' }),
        line_items: { data: [{ price: { id: PRICE_ID } }] },
      }),
    }),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).exists, false);
});

test('Price ID 不一致は付与しない', async () => {
  const { payload, signature } = makeEvent('checkout.session.completed', paidSession());
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps({
      retrieveCheckoutSession: async () => ({
        ...paidSession(),
        line_items: { data: [{ price: { id: 'price_other' } }] },
      }),
    }),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).exists, false);
});

test('金額不一致は付与しない', async () => {
  const { payload, signature } = makeEvent(
    'checkout.session.completed',
    paidSession({ amount_total: 999 }),
  );
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps({
      retrieveCheckoutSession: async () => ({
        ...paidSession({ amount_total: 999 }),
        line_items: { data: [{ price: { id: PRICE_ID } }] },
      }),
    }),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).exists, false);
});

test('metadata / client_reference_id 欠落は付与しない', async () => {
  const session = paidSession({
    metadata: {},
    client_reference_id: null,
  });
  const { payload, signature } = makeEvent('checkout.session.completed', session);
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps({
      retrieveCheckoutSession: async () => ({
        ...session,
        line_items: { data: [{ price: { id: PRICE_ID } }] },
      }),
    }),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).exists, false);
});

test('mode が payment 以外なら付与しない', async () => {
  const session = paidSession({ mode: 'subscription' });
  const { payload, signature } = makeEvent('checkout.session.completed', session);
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps({
      retrieveCheckoutSession: async () => ({
        ...session,
        line_items: { data: [{ price: { id: PRICE_ID } }] },
      }),
    }),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).exists, false);
});

test('async_payment_succeeded でも検証合格なら lifetime を付与する', async () => {
  await firestore.collection('books').doc('alice').set({
    name: '帳',
    ownerUid: 'alice',
    memberUids: ['alice'],
    bottomWindowMonths: 6,
    createdAt: FieldValue.serverTimestamp(),
    ownerLicenseStatus: 'free',
  });
  const { payload, signature } = makeEvent(
    'checkout.session.async_payment_succeeded',
    paidSession({ id: 'cs_async_1' }),
  );
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps({
      retrieveCheckoutSession: async (sessionId) => ({
        ...paidSession({ id: sessionId }),
        line_items: { data: [{ price: { id: PRICE_ID } }] },
      }),
    }),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).data()?.license?.status, 'lifetime');
});

test('未知イベントは 200 で無視する', async () => {
  const { payload, signature } = makeEvent('customer.created', paidSession());
  const res = mockRes();
  await handleStripeWebhook(
    {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      rawBody: Buffer.from(payload),
    },
    res,
    makeDeps(),
  );
  assert.equal(res.result.statusCode, 200);
  assert.equal((await firestore.collection('users').doc('alice').get()).exists, false);
});
