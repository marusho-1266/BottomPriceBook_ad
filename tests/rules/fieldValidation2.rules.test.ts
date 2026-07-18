import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const LONG_101 = 'a'.repeat(101);
const LONG_100 = 'a'.repeat(100);

function validBook(uid: string) {
  return {
    name: 'わたしの底値帳',
    ownerUid: uid,
    memberUids: [uid],
    bottomWindowMonths: 6,
    createdAt: serverTimestamp(),
  };
}

function validRecord(over: Record<string, unknown> = {}) {
  return {
    productId: 'p1',
    storeId: 's1',
    price: 158,
    quantity: 240,
    unit: 'ml',
    isSale: false,
    recordedAt: Timestamp.now(),
    ...over,
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
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
  });
});

describe('priceRecords のフィールド検証(Issue #16)', () => {
  it('許可リスト外のフィールドがあると拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ extra: 'x' })),
    );
  });

  it('price が上限(10,000,000)ちょうどなら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ price: 10_000_000 })),
    );
  });

  it('price が上限(10,000,000)を超えると拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(
        doc(db, 'books', ALICE, 'priceRecords', 'r1'),
        validRecord({ price: 10_000_001 }),
      ),
    );
  });

  it('quantity が上限(1,000,000)ちょうどなら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(
        doc(db, 'books', ALICE, 'priceRecords', 'r1'),
        validRecord({ quantity: 1_000_000 }),
      ),
    );
  });

  it('quantity が上限(1,000,000)を超えると拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(
        doc(db, 'books', ALICE, 'priceRecords', 'r1'),
        validRecord({ quantity: 1_000_001 }),
      ),
    );
  });

  it('unit が101文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ unit: LONG_101 })),
    );
  });

  it('isSale が bool でないと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ isSale: 'false' })),
    );
  });

  it('note を付けても500文字以内なら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(
        doc(db, 'books', ALICE, 'priceRecords', 'r1'),
        validRecord({ note: 'a'.repeat(500) }),
      ),
    );
  });

  it('note が501文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(
        doc(db, 'books', ALICE, 'priceRecords', 'r1'),
        validRecord({ note: 'a'.repeat(501) }),
      ),
    );
  });

  it('productId / storeId が空文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ productId: '' })),
    );
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r2'), validRecord({ storeId: '' })),
    );
  });
});

describe('members のフィールド検証強化(Issue #16)', () => {
  it('displayName が100文字ちょうどなら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'books', ALICE, 'members', ALICE), {
        displayName: LONG_100,
        joinedAt: serverTimestamp(),
      }),
    );
  });

  it('displayName が101文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'members', ALICE), {
        displayName: LONG_101,
        joinedAt: serverTimestamp(),
      }),
    );
  });

  it('displayName が空文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'members', ALICE), {
        displayName: '',
        joinedAt: serverTimestamp(),
      }),
    );
  });
});

describe('invites のフィールド検証強化(Issue #16)', () => {
  const CODE = 'invite-code-abcdefghij';

  it('bookName が100文字ちょうどなら発行できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'invites', CODE), {
        bookId: ALICE,
        bookName: LONG_100,
        createdBy: ALICE,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('bookName が101文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'invites', CODE), {
        bookId: ALICE,
        bookName: LONG_101,
        createdBy: ALICE,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('bookName が空文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'invites', CODE), {
        bookId: ALICE,
        bookName: '',
        createdBy: ALICE,
        createdAt: serverTimestamp(),
      }),
    );
  });
});
