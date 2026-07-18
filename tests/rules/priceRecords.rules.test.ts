import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

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
    await setDoc(doc(context.firestore(), 'books', ALICE), {
      name: 'テスト',
      ownerUid: ALICE,
      memberUids: [ALICE],
      bottomWindowMonths: 6,
      createdAt: serverTimestamp(),
    });
  });
});

describe('priceRecords のルール(M-3 / T12)', () => {
  it('メンバーは正の price / quantity で記録を作成できる(rateLimits 同時更新)', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord());
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it('price が 0 以下の記録は拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const batch1 = writeBatch(db);
    batch1.set(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ price: 0 }));
    batch1.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertFails(batch1.commit());

    const batch2 = writeBatch(db);
    batch2.set(doc(db, 'books', ALICE, 'priceRecords', 'r2'), validRecord({ price: -100 }));
    batch2.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertFails(batch2.commit());
  });

  it('quantity が 0 以下の記録は拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ quantity: 0 }));
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertFails(batch.commit());
  });

  it('price が数値でない記録は拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ price: '158' }));
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertFails(batch.commit());
  });

  it('更新でも正数検証が働く', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const seedBatch = writeBatch(db);
    seedBatch.set(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord());
    seedBatch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await seedBatch.commit();

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const failBatch = writeBatch(db);
    failBatch.update(doc(db, 'books', ALICE, 'priceRecords', 'r1'), { price: -1 });
    failBatch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertFails(failBatch.commit());

    const okBatch = writeBatch(db);
    okBatch.update(doc(db, 'books', ALICE, 'priceRecords', 'r1'), { price: 99 });
    okBatch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(okBatch.commit());
  }, 10000);

  it('メンバーは記録を削除できる(削除はレート制限対象外)', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    const seedBatch = writeBatch(db);
    seedBatch.set(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord());
    seedBatch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await seedBatch.commit();
    await assertSucceeds(deleteDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1')));
  });

  it('他人の book には正しい記録でも書き込めない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord()));
  });
});
