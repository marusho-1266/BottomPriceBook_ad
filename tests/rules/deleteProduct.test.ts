import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteProductWithRecords } from '../../src/features/products/deleteProduct';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';

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

describe('deleteProductWithRecords', () => {
  it('商品と配下の価格記録をセキュリティルールの下で削除する', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore() as unknown as Firestore;

    // セットアップの全書込を 1 バッチにまとめ、rateLimits 更新を 1 回で満たす(Issue #16)
    const setupBatch = writeBatch(db);
    setupBatch.set(doc(db, 'books', ALICE, 'products', 'p1'), {
      name: '牛乳',
      categoryId: 'drink',
    });
    for (let i = 0; i < 3; i++) {
      setupBatch.set(doc(collection(db, 'books', ALICE, 'priceRecords')), {
        productId: 'p1',
        storeId: 's1',
        price: 200 + i,
        quantity: 900,
        unit: 'ml',
        isSale: false,
        recordedAt: Timestamp.now(),
      });
    }
    // 別商品の記録は残ること
    setupBatch.set(doc(collection(db, 'books', ALICE, 'priceRecords')), {
      productId: 'p2',
      storeId: 's1',
      price: 100,
      quantity: 100,
      unit: 'g',
      isSale: false,
      recordedAt: Timestamp.now(),
    });
    setupBatch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await setupBatch.commit();

    await deleteProductWithRecords(db, ALICE, 'p1');

    const product = await getDoc(doc(db, 'books', ALICE, 'products', 'p1'));
    expect(product.exists()).toBe(false);
    const records = await getDocs(collection(db, 'books', ALICE, 'priceRecords'));
    expect(records.size).toBe(1);
    expect(records.docs[0].data().productId).toBe('p2');
  });
});
