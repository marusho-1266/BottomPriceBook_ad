import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

type TestFirestore = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;

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

describe('categories のフィールド検証', () => {
  /** categories の作成をレート制限用の rateLimits 同時更新込みで行う(Issue #16) */
  function createCategoryBatch(db: TestFirestore, categoryId: string, category: Record<string, unknown>) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'categories', categoryId), category);
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    return batch.commit();
  }

  it('許可フィールドのみなら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(
      createCategoryBatch(db, 'c1', { name: '食品', baseUnit: 'g', sortOrder: 0 }),
    );
  });

  it('許可リスト外のフィールドがあると拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'c1'), {
        name: '食品',
        baseUnit: 'g',
        sortOrder: 0,
        extra: 'invalid',
      }),
    );
  });

  it('name が空文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'c1'), {
        name: '',
        baseUnit: 'g',
        sortOrder: 0,
      }),
    );
  });

  it('name が100文字ちょうどなら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(
      createCategoryBatch(db, 'c1', { name: LONG_100, baseUnit: 'g', sortOrder: 0 }),
    );
  });

  it('name が101文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'c1'), {
        name: LONG_101,
        baseUnit: 'g',
        sortOrder: 0,
      }),
    );
  });

  it('baseUnit が許可リスト外だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'c1'), {
        name: '食品',
        baseUnit: 'invalid-unit',
        sortOrder: 0,
      }),
    );
  });

  it('sortOrder が負だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'c1'), {
        name: '食品',
        baseUnit: 'g',
        sortOrder: -1,
      }),
    );
  });

  it('sortOrder が Date.now() 相当の大きな整数でも作成できる(上限なし)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(
      createCategoryBatch(db, 'c1', { name: '食品', baseUnit: 'g', sortOrder: Date.now() }),
    );
  });

  it('sortOrder が数値でないと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'c1'), {
        name: '食品',
        baseUnit: 'g',
        sortOrder: '0',
      }),
    );
  });

  it('更新時も許可リスト外のフィールドは拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await createCategoryBatch(db, 'c1', { name: '食品', baseUnit: 'g', sortOrder: 0 });

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const failBatch = writeBatch(db);
    failBatch.update(doc(db, 'books', ALICE, 'categories', 'c1'), { extra: 'x' });
    failBatch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertFails(failBatch.commit());

    const okBatch = writeBatch(db);
    okBatch.update(doc(db, 'books', ALICE, 'categories', 'c1'), { name: '食料品' });
    okBatch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(okBatch.commit());
  }, 10000);

  it('メンバーは categories を削除できる(検証対象外)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE, 'categories', 'c1'), {
        name: '食品',
        baseUnit: 'g',
        sortOrder: 0,
      });
    });
    const { deleteDoc } = await import('firebase/firestore');
    await assertSucceeds(deleteDoc(doc(db, 'books', ALICE, 'categories', 'c1')));
  });
});

describe('stores のフィールド検証', () => {
  it('許可フィールドのみなら作成できる(rateLimits 同時更新)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'stores', 's1'), { name: 'スーパーA' });
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it('許可リスト外のフィールドがあると拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'stores', 's1'), { name: 'スーパーA', extra: 'x' }),
    );
  });

  it('name が空文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE, 'stores', 's1'), { name: '' }));
  });

  it('name が101文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE, 'stores', 's1'), { name: LONG_101 }));
  });

  it('name が100文字ちょうどなら作成できる(rateLimits 同時更新)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'stores', 's1'), { name: LONG_100 });
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });
});

describe('products のフィールド検証', () => {
  /** products の作成をレート制限用の rateLimits 同時更新込みで行う(Issue #16) */
  function createProductBatch(db: TestFirestore, productId: string, product: Record<string, unknown>) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'products', productId), product);
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    return batch.commit();
  }

  it('許可フィールドのみなら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(createProductBatch(db, 'p1', { name: '牛乳', categoryId: 'food' }));
  });

  it('note を付けても作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(
      createProductBatch(db, 'p1', { name: '牛乳', categoryId: 'food', note: 'メモ' }),
    );
  });

  it('許可リスト外のフィールドがあると拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'products', 'p1'), {
        name: '牛乳',
        categoryId: 'food',
        extra: 'x',
      }),
    );
  });

  it('name が101文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'products', 'p1'), { name: LONG_101, categoryId: 'food' }),
    );
  });

  it('note が501文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'products', 'p1'), {
        name: '牛乳',
        categoryId: 'food',
        note: 'a'.repeat(501),
      }),
    );
  });

  it('note が500文字ちょうどなら作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(
      createProductBatch(db, 'p1', { name: '牛乳', categoryId: 'food', note: 'a'.repeat(500) }),
    );
  });

  it('categoryId が空文字だと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'products', 'p1'), { name: '牛乳', categoryId: '' }),
    );
  });
});
