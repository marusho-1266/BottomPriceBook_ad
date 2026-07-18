import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { runDeleteAccount } from './deleteAccount.js';

const PROJECT_ID = 'demo-sokoneko';
const FIRESTORE_HOST = '127.0.0.1:8080';
const AUTH_HOST = '127.0.0.1:9099';

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

let app: App;
let firestore: Firestore;
let auth: Auth;

before(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'delete-account-test');
  firestore = getFirestore(app);
  auth = getAuth(app);
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

async function clearAuth(): Promise<void> {
  const response = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
  assert.equal(response.ok, true);
}

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
});

function bookData(ownerUid: string, memberUids: string[]) {
  return {
    name: 'わたしの底値帳',
    ownerUid,
    memberUids,
    bottomWindowMonths: 6,
    createdAt: FieldValue.serverTimestamp(),
  };
}

test('自分の book をサブコレクション込みで削除し、Auth ユーザーも削除する', async () => {
  const uid = 'alice-uid';
  await auth.createUser({ uid, email: 'alice@example.com', password: 'password123' });

  const bookRef = firestore.collection('books').doc(uid);
  await bookRef.set(bookData(uid, [uid]));
  await bookRef.collection('categories').doc('cat-1').set({ name: '野菜', baseUnit: 'g' });
  await bookRef.collection('stores').doc('store-1').set({ name: 'スーパー' });
  await bookRef
    .collection('priceRecords')
    .doc('record-1')
    .set({ price: 100, quantity: 1, categoryId: 'cat-1' });
  // 書込レート制限(Issue #16)用のドキュメントも recursiveDelete で消えることを確認する
  await bookRef.collection('rateLimits').doc(uid).set({ lastWriteAt: FieldValue.serverTimestamp() });

  await runDeleteAccount(uid, { firestore, auth });

  assert.equal((await bookRef.get()).exists, false);
  assert.equal((await bookRef.collection('categories').doc('cat-1').get()).exists, false);
  assert.equal((await bookRef.collection('priceRecords').doc('record-1').get()).exists, false);
  assert.equal((await bookRef.collection('rateLimits').doc(uid).get()).exists, false);
  await assert.rejects(() => auth.getUser(uid));
});

test('自分が発行した招待コードを削除する', async () => {
  const uid = 'alice-uid';
  await auth.createUser({ uid });
  await firestore.collection('books').doc(uid).set(bookData(uid, [uid]));
  await firestore.collection('invites').doc('invite-1').set({
    bookId: uid,
    bookName: 'わたしの底値帳',
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  await runDeleteAccount(uid, { firestore, auth });

  assert.equal((await firestore.collection('invites').doc('invite-1').get()).exists, false);
});

test('参加中の他人の book からは退出するが、自分が記録した価格記録は残す', async () => {
  const owner = 'bob-uid';
  const uid = 'alice-uid';
  await auth.createUser({ uid });

  const ownerBookRef = firestore.collection('books').doc(owner);
  await ownerBookRef.set(bookData(owner, [owner, uid]));
  await ownerBookRef.collection('members').doc(uid).set({ displayName: 'アリス' });
  await ownerBookRef.collection('joinTokens').doc(uid).set({ inviteCode: 'used-code' });
  await ownerBookRef
    .collection('priceRecords')
    .doc('record-by-alice')
    .set({ price: 200, quantity: 1, createdBy: uid });

  await firestore.collection('books').doc(uid).set(bookData(uid, [uid]));

  await runDeleteAccount(uid, { firestore, auth });

  const ownerBookAfter = await ownerBookRef.get();
  assert.equal(ownerBookAfter.exists, true);
  assert.deepEqual(ownerBookAfter.data()?.memberUids, [owner]);
  assert.equal((await ownerBookRef.collection('members').doc(uid).get()).exists, false);
  assert.equal((await ownerBookRef.collection('joinTokens').doc(uid).get()).exists, false);
  assert.equal((await ownerBookRef.collection('priceRecords').doc('record-by-alice').get()).exists, true);
});

test('オーナーとして参加している自分の book は退出処理の対象にしない(削除フローで処理する)', async () => {
  const uid = 'alice-uid';
  await auth.createUser({ uid });
  const bookRef = firestore.collection('books').doc(uid);
  await bookRef.set(bookData(uid, [uid]));

  await runDeleteAccount(uid, { firestore, auth });

  assert.equal((await bookRef.get()).exists, false);
});

test('2 回実行しても失敗しない(冪等)', async () => {
  const uid = 'alice-uid';
  await auth.createUser({ uid });
  await firestore.collection('books').doc(uid).set(bookData(uid, [uid]));

  await runDeleteAccount(uid, { firestore, auth });
  await assert.doesNotReject(() => runDeleteAccount(uid, { firestore, auth }));
});
