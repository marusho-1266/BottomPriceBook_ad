import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
  it('メンバーは正の price / quantity で記録を作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord()));
  });

  it('price が 0 以下の記録は拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ price: 0 })),
    );
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r2'), validRecord({ price: -100 })),
    );
  });

  it('quantity が 0 以下の記録は拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ quantity: 0 })),
    );
  });

  it('price が数値でない記録は拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord({ price: '158' })),
    );
  });

  it('更新でも正数検証が働く', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord());
    await assertFails(updateDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), { price: -1 }));
    await assertSucceeds(updateDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), { price: 99 }));
  });

  it('メンバーは記録を削除できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord());
    await assertSucceeds(deleteDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1')));
  });

  it('他人の book には正しい記録でも書き込めない', async () => {
    const db = testEnv.authenticatedContext(BOB, { email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), validRecord()));
  });
});
