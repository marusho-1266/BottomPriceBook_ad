import { signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import type { App } from 'firebase-admin/app';
import type { Auth as AdminAuth } from 'firebase-admin/auth';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount, reauthenticate } from '../../src/features/account/api';
import { addPriceRecord } from '../../src/features/prices/api';
import { createInvite, joinBook } from '../../src/features/sharing/api';
import { auth, db } from '../../src/lib/firebase';
import { PASSWORD, clearEmulators, deleteAdminApp, initAdminApp, signUp } from './testUtils';

/**
 * アカウント削除 E2E: メンバー(非オーナー)が退会するシナリオ。
 * `npm run emulators` で Firestore/Auth/Functions エミュレータを起動してから実行すること。
 * この deleteAccount() 呼び出しはモジュール単位の Firestore クライアントを
 * terminate() する(不可逆)ため、他シナリオとはファイルを分けて実行する
 * (vitest はテストファイルごとにモジュールを再評価するため安全)。
 */

let adminApp: App;
let adminDb: AdminFirestore;
let adminAuth: AdminAuth;

beforeAll(() => {
  ({ adminApp, adminDb, adminAuth } = initAdminApp());
});

afterAll(async () => {
  await deleteAdminApp(adminApp);
});

beforeEach(async () => {
  await clearEmulators();
  await firebaseSignOut(auth).catch(() => {});
  // jsdom はナビゲーションを実装しないため、deleteAccount() 内の reload() をスタブする
  vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
});

describe('アカウント削除 E2E: メンバーの退会', () => {
  it('共有 book から退出するが、自分が記録した価格記録は残る', async () => {
    const alice = await signUp('alice@example.com', 'アリス', adminAuth);
    const inviteCode = await createInvite(db, {
      id: alice.uid,
      name: 'わたしの底値帳',
      ownerUid: alice.uid,
    });

    await firebaseSignOut(auth);
    const bob = await signUp('bob@example.com', 'ボブ', adminAuth);
    await joinBook(db, {
      bookId: alice.uid,
      inviteCode,
      uid: bob.uid,
      displayName: 'ボブ',
    });
    await addPriceRecord(alice.uid, {
      productId: 'p1',
      storeId: 's1',
      price: 198,
      quantity: 1,
      unit: '個',
      isSale: false,
      recordedAt: new Date(),
    });

    // bob として退会(実際の UI フローと同じ: 再認証 → Callable 呼び出し)
    await reauthenticate(PASSWORD);
    await deleteAccount(bob.uid);

    await expect(signInWithEmailAndPassword(auth, 'bob@example.com', PASSWORD)).rejects.toThrow();

    const aliceBook = (await adminDb.collection('books').doc(alice.uid).get()).data();
    expect(aliceBook?.memberUids).toEqual([alice.uid]);
    expect(
      (await adminDb.collection('books').doc(alice.uid).collection('members').doc(bob.uid).get())
        .exists,
    ).toBe(false);
    expect(
      (await adminDb.collection('books').doc(alice.uid).collection('joinTokens').doc(bob.uid).get())
        .exists,
    ).toBe(false);

    const records = await adminDb.collection('books').doc(alice.uid).collection('priceRecords').get();
    expect(records.docs).toHaveLength(1);
    expect(records.docs[0].data().price).toBe(198);
  });
});
