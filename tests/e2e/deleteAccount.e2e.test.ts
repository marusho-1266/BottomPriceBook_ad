import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, type Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteAccount, reauthenticate } from '../../src/features/account/api';
import { ensureBook } from '../../src/features/books/api';
import { resolveCurrentBookId } from '../../src/features/books/BookProvider';
import { addPriceRecord } from '../../src/features/prices/api';
import { createInvite, joinBook } from '../../src/features/sharing/api';
import { auth, db } from '../../src/lib/firebase';

/**
 * アカウント削除フローの E2E 検証(Success Criteria の一部を実機同等の経路で確認する)。
 * 実際のアプリと同じクライアント API(ensureBook / createInvite / joinBook /
 * addPriceRecord / reauthenticate / deleteAccount)を、実際に起動した
 * Firestore(8080)・Auth(9099)・Functions(5001)エミュレータに対して呼び出す。
 * `npm run emulators` でエミュレータを起動してから実行すること。
 *
 * 再認証失敗時に削除されないこと・途中失敗後の冪等性は、
 * functions/src/deleteAccount.test.ts(I13-T2)と
 * tests/features/account/api.test.ts(I13-T4)で Admin SDK / モックにより
 * 個別に検証済みのため、ここでは実ネットワーク越しでしか確認できない
 * 「メンバー退会時のデータ保持」「オーナー退会によるメンバーのフォールバック」に絞る。
 */

const PROJECT_ID = 'demo-sokoneko';
const FIRESTORE_HOST = '127.0.0.1:8080';
const AUTH_HOST = '127.0.0.1:9099';
const PASSWORD = 'Password123!';

let adminApp: App;
let adminDb: AdminFirestore;
let adminAuth: AdminAuth;

beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
  adminApp = initializeApp({ projectId: PROJECT_ID }, 'e2e-verify');
  adminDb = getAdminFirestore(adminApp);
  adminAuth = getAdminAuth(adminApp);
});

afterAll(async () => {
  await deleteApp(adminApp);
});

async function clearAll(): Promise<void> {
  await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
}

beforeEach(async () => {
  await clearAll();
  await firebaseSignOut(auth).catch(() => {});
});

async function signUp(email: string, displayName: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, PASSWORD);
  await ensureBook(db, credential.user.uid, displayName);
  return credential.user;
}

describe('アカウント削除 E2E(実クライアント API × エミュレータ)', () => {
  it(
    'メンバーが退会すると共有 book から退出するが、自分が記録した価格記録は残る',
    async () => {
      const alice = await signUp('alice@example.com', 'アリス');
      const inviteCode = await createInvite(db, {
        id: alice.uid,
        name: 'わたしの底値帳',
        ownerUid: alice.uid,
      });

      await firebaseSignOut(auth);
      const bob = await signUp('bob@example.com', 'ボブ');
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
        (
          await adminDb
            .collection('books')
            .doc(alice.uid)
            .collection('joinTokens')
            .doc(bob.uid)
            .get()
        ).exists,
      ).toBe(false);

      const records = await adminDb.collection('books').doc(alice.uid).collection('priceRecords').get();
      expect(records.docs).toHaveLength(1);
      expect(records.docs[0].data().price).toBe(198);
    },
  );

  it(
    'オーナーが退会すると book ごと削除され、メンバーは自分の book へフォールバックする',
    async () => {
      const alice = await signUp('alice@example.com', 'アリス');
      const inviteCode = await createInvite(db, {
        id: alice.uid,
        name: 'わたしの底値帳',
        ownerUid: alice.uid,
      });

      await firebaseSignOut(auth);
      const bob = await signUp('bob@example.com', 'ボブ');
      await joinBook(db, {
        bookId: alice.uid,
        inviteCode,
        uid: bob.uid,
        displayName: 'ボブ',
      });

      await firebaseSignOut(auth);
      await signInWithEmailAndPassword(auth, 'alice@example.com', PASSWORD);
      await reauthenticate(PASSWORD);
      await deleteAccount(alice.uid);

      await expect(
        signInWithEmailAndPassword(auth, 'alice@example.com', PASSWORD),
      ).rejects.toThrow();
      await expect(adminAuth.getUser(alice.uid)).rejects.toThrow();
      expect((await adminDb.collection('books').doc(alice.uid).get()).exists).toBe(false);
      expect(
        (await adminDb.collection('invites').where('createdBy', '==', alice.uid).get()).empty,
      ).toBe(true);

      // bob(メンバー側)は影響を受けず、次回アクセス時に自分の book へフォールバックする
      await signInWithEmailAndPassword(auth, 'bob@example.com', PASSWORD);
      const booksQuery = query(collection(db, 'books'), where('memberUids', 'array-contains', bob.uid));
      const booksSnapshot = await getDocs(booksQuery);
      const bookIds = booksSnapshot.docs.map((docSnapshot) => docSnapshot.id);

      expect(bookIds).toEqual([bob.uid]);
      expect(resolveCurrentBookId(booksSnapshot.docs.map((d) => ({ id: d.id })), alice.uid, bob.uid)).toBe(
        bob.uid,
      );
    },
  );
});
