import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { grantLifetimeLicense, syncOwnerBookMirrors } from './licenseGrant.js';

// deleteAccount 等とエミュレータを共有しないよう専用プロジェクト ID を使う
const PROJECT_ID = 'demo-license-grant';
const FIRESTORE_HOST = '127.0.0.1:8080';

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;

let app: App;
let firestore: Firestore;

before(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'license-grant-test');
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

function bookData(ownerUid: string, ownerLicenseStatus?: 'free' | 'lifetime') {
  return {
    name: 'わたしの底値帳',
    ownerUid,
    memberUids: [ownerUid],
    bottomWindowMonths: 6,
    createdAt: FieldValue.serverTimestamp(),
    ...(ownerLicenseStatus ? { ownerLicenseStatus } : {}),
  };
}

test('未購入ユーザーに stripe Session で lifetime を付与しミラーも更新する', async () => {
  const uid = 'alice-uid';
  await firestore.collection('books').doc(uid).set(bookData(uid, 'free'));
  await firestore.collection('pendingCheckouts').doc(uid).set({
    status: 'ready',
    url: 'https://checkout.stripe.com/c/pay/cs_test_1',
  });

  await grantLifetimeLicense(
    {
      uid,
      source: 'stripe',
      stripeCheckoutSessionId: 'cs_test_1',
      stripeEventId: 'evt_test_1',
    },
    { firestore },
  );

  const user = await firestore.collection('users').doc(uid).get();
  assert.equal(user.data()?.license?.status, 'lifetime');
  assert.equal(user.data()?.license?.source, 'stripe');
  assert.equal(user.data()?.license?.stripeCheckoutSessionId, 'cs_test_1');
  assert.ok(user.data()?.license?.purchasedAt);

  const session = await firestore.collection('stripeCheckoutSessions').doc('cs_test_1').get();
  assert.equal(session.exists, true);
  assert.equal(session.data()?.uid, uid);
  assert.equal(session.data()?.stripeEventId, 'evt_test_1');

  const book = await firestore.collection('books').doc(uid).get();
  assert.equal(book.data()?.ownerLicenseStatus, 'lifetime');

  assert.equal((await firestore.collection('pendingCheckouts').doc(uid).get()).exists, false);
});

test('同一 Session の再実行は購入メタを上書きせず、不足ミラーだけ修復する', async () => {
  const uid = 'alice-uid';
  await firestore.collection('users').doc(uid).set({
    license: {
      status: 'lifetime',
      source: 'stripe',
      stripeCheckoutSessionId: 'cs_test_1',
      purchasedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  await firestore.collection('stripeCheckoutSessions').doc('cs_test_1').set({
    uid,
    stripeEventId: 'evt_test_1',
    processedAt: FieldValue.serverTimestamp(),
  });
  await firestore.collection('books').doc(uid).set(bookData(uid, 'free'));

  await grantLifetimeLicense(
    {
      uid,
      source: 'stripe',
      stripeCheckoutSessionId: 'cs_test_1',
      stripeEventId: 'evt_test_replay',
    },
    { firestore },
  );

  const user = await firestore.collection('users').doc(uid).get();
  assert.equal(user.data()?.license?.stripeCheckoutSessionId, 'cs_test_1');
  assert.equal(user.data()?.license?.source, 'stripe');
  const purchasedAt = user.data()?.license?.purchasedAt?.toDate?.() ?? user.data()?.license?.purchasedAt;
  assert.equal(new Date(purchasedAt).toISOString(), '2026-01-01T00:00:00.000Z');

  const session = await firestore.collection('stripeCheckoutSessions').doc('cs_test_1').get();
  assert.equal(session.data()?.stripeEventId, 'evt_test_1');

  const book = await firestore.collection('books').doc(uid).get();
  assert.equal(book.data()?.ownerLicenseStatus, 'lifetime');
});

test('既に lifetime のとき別 Session でも購入メタを上書きしない', async () => {
  const uid = 'alice-uid';
  await firestore.collection('users').doc(uid).set({
    license: {
      status: 'lifetime',
      source: 'stripe',
      stripeCheckoutSessionId: 'cs_original',
      purchasedAt: new Date('2026-01-01T00:00:00Z'),
    },
  });
  await firestore.collection('books').doc(uid).set(bookData(uid, 'lifetime'));

  await grantLifetimeLicense(
    {
      uid,
      source: 'stripe',
      stripeCheckoutSessionId: 'cs_other',
      stripeEventId: 'evt_other',
    },
    { firestore },
  );

  const user = await firestore.collection('users').doc(uid).get();
  assert.equal(user.data()?.license?.stripeCheckoutSessionId, 'cs_original');

  const session = await firestore.collection('stripeCheckoutSessions').doc('cs_other').get();
  assert.equal(session.exists, true);
  assert.equal(session.data()?.uid, uid);
});

test('オーナー book が 0 件でも users.license は更新する', async () => {
  const uid = 'alice-uid';

  await grantLifetimeLicense(
    {
      uid,
      source: 'stripe',
      stripeCheckoutSessionId: 'cs_nobook',
      stripeEventId: 'evt_nobook',
    },
    { firestore },
  );

  const user = await firestore.collection('users').doc(uid).get();
  assert.equal(user.data()?.license?.status, 'lifetime');
});

test('lifetime 済みミラーは no-op、free / 欠落だけ更新する', async () => {
  const uid = 'alice-uid';
  await firestore.collection('books').doc('book-life').set(bookData(uid, 'lifetime'));
  await firestore.collection('books').doc('book-free').set(bookData(uid, 'free'));
  await firestore.collection('books').doc('book-missing').set(bookData(uid));

  await syncOwnerBookMirrors(uid, { firestore });

  assert.equal((await firestore.collection('books').doc('book-life').get()).data()?.ownerLicenseStatus, 'lifetime');
  assert.equal((await firestore.collection('books').doc('book-free').get()).data()?.ownerLicenseStatus, 'lifetime');
  assert.equal(
    (await firestore.collection('books').doc('book-missing').get()).data()?.ownerLicenseStatus,
    'lifetime',
  );
});

test('ミラー更新はチャンク分割して書き込む', async () => {
  const uid = 'alice-uid';
  for (let i = 0; i < 5; i += 1) {
    await firestore.collection('books').doc(`book-${i}`).set(bookData(uid, 'free'));
  }

  await syncOwnerBookMirrors(uid, { firestore, mirrorChunkSize: 2 });

  for (let i = 0; i < 5; i += 1) {
    assert.equal(
      (await firestore.collection('books').doc(`book-${i}`).get()).data()?.ownerLicenseStatus,
      'lifetime',
    );
  }
});

test('Session 無し（プロモ等）でも users とミラーを lifetime にする', async () => {
  const uid = 'alice-uid';
  await firestore.collection('books').doc(uid).set(bookData(uid, 'free'));

  await grantLifetimeLicense({ uid, source: 'promo' }, { firestore });

  const user = await firestore.collection('users').doc(uid).get();
  assert.equal(user.data()?.license?.status, 'lifetime');
  assert.equal(user.data()?.license?.source, 'promo');
  assert.equal(user.data()?.license?.stripeCheckoutSessionId, undefined);

  const book = await firestore.collection('books').doc(uid).get();
  assert.equal(book.data()?.ownerLicenseStatus, 'lifetime');
});

test('チャンク失敗は最大 3 回まで再試行する', async () => {
  const uid = 'alice-uid';
  await firestore.collection('books').doc(uid).set(bookData(uid, 'free'));

  let attempts = 0;
  const realBatch = firestore.batch.bind(firestore);
  // writeBatch を差し替えられないため、commit をラップする deps を使う
  await syncOwnerBookMirrors(uid, {
    firestore,
    sleep: async () => undefined,
    beforeCommitChunk: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error('transient');
      }
    },
  });

  assert.equal(attempts, 3);
  assert.equal((await firestore.collection('books').doc(uid).get()).data()?.ownerLicenseStatus, 'lifetime');
  void realBatch;
});
