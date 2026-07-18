import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

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

describe('books の作成', () => {
  it('bookId = uid かつ ownerUid = uid なら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, 'books', ALICE), validBook(ALICE)));
  });

  it('bookId != uid では作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'books', 'other-id'), validBook(ALICE)));
  });

  it('ownerUid が自分以外の book は作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE), { ...validBook(ALICE), ownerUid: BOB }));
  });

  it('未認証では作成できない', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE), validBook(ALICE)));
  });
});

describe('books の読み書き(他人)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
    });
  });

  it('他人の book は読めない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(getDoc(doc(db, 'books', ALICE)));
  });

  it('他人の book は更新できない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, 'books', ALICE), { name: '乗っ取り' }));
  });

  it('本人でも book は削除できない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(deleteDoc(doc(db, 'books', ALICE)));
  });
});

describe('books の更新(本人)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
    });
  });

  it('name と bottomWindowMonths は更新できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'books', ALICE), { name: '新しい名前', bottomWindowMonths: 3 }),
    );
  });

  it('ownerUid は書き換えられない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, 'books', ALICE), { ownerUid: BOB }));
  });

  it('createdAt は書き換えられない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, 'books', ALICE), { createdAt: serverTimestamp() }));
  });

  it('owner は memberUids を変更できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(updateDoc(doc(db, 'books', ALICE), { memberUids: [ALICE, BOB] }));
  });
});

describe('サブコレクション', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
    });
  });

  it('メンバーは categories を読み書きできる(rateLimits 同時更新)', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const ref = doc(db, 'books', ALICE, 'categories', 'food');
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    batch.set(ref, { name: '食品', baseUnit: 'g', sortOrder: 0 });
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(ref));
  });

  it('他人は categories を読めない・書けない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    const ref = doc(db, 'books', ALICE, 'categories', 'food');
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { name: '食品', baseUnit: 'g', sortOrder: 0 }));
  });
});
