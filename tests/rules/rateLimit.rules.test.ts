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

const ALICE = 'alice-uid';

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

describe('rateLimits ドキュメント自体のルール', () => {
  it('本人はメンバーとして rateLimits を作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() }),
    );
  });

  it('lastWriteAt 以外のフィールドがあると拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'rateLimits', ALICE), {
        lastWriteAt: serverTimestamp(),
        extra: 'x',
      }),
    );
  });

  it('lastWriteAt が serverTimestamp でないと拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    const { Timestamp } = await import('firebase/firestore');
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: Timestamp.now() }),
    );
  });

  it('他人の rateLimits は作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'rateLimits', 'other-uid'), {
        lastWriteAt: serverTimestamp(),
      }),
    );
  });

  it('本人は自分の rateLimits を読める', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE, 'rateLimits', ALICE), {
        lastWriteAt: serverTimestamp(),
      });
    });
    const { getDoc } = await import('firebase/firestore');
    await assertSucceeds(getDoc(doc(db, 'books', ALICE, 'rateLimits', ALICE)));
  });
});

describe('コンテンツ書込とレート制限の連携', () => {
  it('rateLimits を同一バッチで更新しない単独書込は拒否される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'stores', 's1'), { name: 'スーパーA' }),
    );
  });

  it('rateLimits を同一バッチで更新する単発書込は許可される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'stores', 's1'), { name: 'スーパーA' });
    batch.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it('1 秒未満の間隔で連続書込すると 2 回目は拒否される(オフライン再接続時の代理検証)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    const batch1 = writeBatch(db);
    batch1.set(doc(db, 'books', ALICE, 'stores', 's1'), { name: 'スーパーA' });
    batch1.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch1.commit());

    const batch2 = writeBatch(db);
    batch2.set(doc(db, 'books', ALICE, 'stores', 's2'), { name: 'スーパーB' });
    batch2.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertFails(batch2.commit());
  });

  it('1 秒以上経過すれば次の書込が許可される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    const batch1 = writeBatch(db);
    batch1.set(doc(db, 'books', ALICE, 'stores', 's1'), { name: 'スーパーA' });
    batch1.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch1.commit());

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const batch2 = writeBatch(db);
    batch2.set(doc(db, 'books', ALICE, 'stores', 's2'), { name: 'スーパーB' });
    batch2.set(doc(db, 'books', ALICE, 'rateLimits', ALICE), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch2.commit());
  }, 10000);

  it('products / categories / priceRecords も同様にレート制限される', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'products', 'p1'), { name: '牛乳', categoryId: 'food' }),
    );
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'c1'), {
        name: '食品',
        baseUnit: 'g',
        sortOrder: 0,
      }),
    );
    const { Timestamp } = await import('firebase/firestore');
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'priceRecords', 'r1'), {
        productId: 'p1',
        storeId: 's1',
        price: 100,
        quantity: 1,
        unit: 'g',
        isSale: false,
        recordedAt: Timestamp.now(),
      }),
    );
  });
});
