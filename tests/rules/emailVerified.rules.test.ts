import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';

function dbAsUnverified(uid: string): Firestore {
  return testEnv.authenticatedContext(uid, { email_verified: false }).firestore() as unknown as Firestore;
}

function dbAsVerified(uid: string): Firestore {
  return testEnv.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;
}

function validBook(uid: string) {
  return {
    name: 'わたしの底値帳',
    ownerUid: uid,
    memberUids: [uid],
    bottomWindowMonths: 6,
    createdAt: serverTimestamp(),
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sokoneko',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// メール未確認のトークンでは Firestore に一切アクセスできないこと(Issue #15)。
// クライアント側の確認待ち画面だけでなく、SDK 直叩きでも同様に拒否されることを保証する
describe('メール未確認ユーザーのアクセス拒否', () => {
  it('未確認ユーザーは自分の book を作成できない', async () => {
    const db = dbAsUnverified(ALICE);
    await assertFails(setDoc(doc(db, 'books', ALICE), validBook(ALICE)));
  });

  it('未確認ユーザーは自分の book を読めない(既存book)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
    });
    const db = dbAsUnverified(ALICE);
    await assertFails(getDoc(doc(db, 'books', ALICE)));
  });

  it('未確認ユーザーは priceRecords を作成できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
    });
    const db = dbAsUnverified(ALICE);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), {
        productId: 'p1',
        storeId: 's1',
        price: 100,
        quantity: 1,
      }),
    );
  });

  it('未確認ユーザーは招待コードを get できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invites', 'invite-code-1234567890'), {
        bookId: ALICE,
        bookName: 'わたしの底値帳',
        createdBy: ALICE,
        createdAt: serverTimestamp(),
      });
    });
    const db = dbAsUnverified(ALICE);
    await assertFails(getDoc(doc(db, 'invites', 'invite-code-1234567890')));
  });

  it('未確認ユーザーは招待を作成できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
    });
    const db = dbAsUnverified(ALICE);
    await assertFails(
      setDoc(doc(db, 'invites', 'invite-code-1234567890'), {
        bookId: ALICE,
        bookName: 'わたしの底値帳',
        createdBy: ALICE,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('確認済みユーザーは従来どおりアクセスできる(回帰)', async () => {
    const db = dbAsVerified(ALICE);
    await assertSucceeds(setDoc(doc(db, 'books', ALICE), validBook(ALICE)));
  });
});
