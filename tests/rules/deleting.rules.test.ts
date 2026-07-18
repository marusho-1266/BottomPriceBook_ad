import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  arrayRemove,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ensureBook } from '../../src/features/books/api';

let testEnv: RulesTestEnvironment;

function dbAs(uid: string): Firestore {
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;
}

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

function sharedBook(owner: string, members: string[], deleting = false) {
  return {
    name: 'わたしの底値帳',
    ownerUid: owner,
    memberUids: members,
    bottomWindowMonths: 6,
    createdAt: serverTimestamp(),
    ...(deleting ? { deleting: true } : {}),
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

/**
 * 削除処理中(Issue #13: deleteAccount の recursiveDelete)は、Cloud Functions が
 * Admin SDK で book に `deleting: true` を立ててから配下を再帰削除する。
 * その間、クライアントからの並行書き込みが親を失った孤児ドキュメントとして
 * 残らないよう、firestore.rules 側で書き込みを一切禁止することを検証する。
 */
describe('deleting: true の book への書き込み拒否', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'books', ALICE), sharedBook(ALICE, [ALICE, BOB], true));
      await setDoc(doc(db, 'books', ALICE, 'categories', 'food'), { name: '食品', baseUnit: 'g' });
      await setDoc(doc(db, 'books', ALICE, 'stores', 'store-1'), { name: 'スーパー' });
      await setDoc(doc(db, 'books', ALICE, 'products', 'product-1'), {
        name: 'にんじん',
        categoryId: 'food',
      });
    });
  });

  it('メンバーは priceRecords を新規作成できない', async () => {
    const db = dbAs(BOB);
    await assertFails(
      addDoc(collection(db, 'books', ALICE, 'priceRecords'), {
        productId: 'product-1',
        storeId: 'store-1',
        price: 100,
        quantity: 1,
      }),
    );
  });

  it('メンバーは categories を新規作成できない', async () => {
    const db = dbAs(BOB);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'categories', 'drink'), { name: '飲料', baseUnit: 'ml' }),
    );
  });

  it('メンバーは stores を新規作成できない', async () => {
    const db = dbAs(BOB);
    await assertFails(setDoc(doc(db, 'books', ALICE, 'stores', 'store-2'), { name: '別の店' }));
  });

  it('メンバーは products を新規作成できない', async () => {
    const db = dbAs(BOB);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'products', 'product-2'), {
        name: 'じゃがいも',
        categoryId: 'food',
      }),
    );
  });

  it('メンバーは自分から退出できない(book update が拒否される)', async () => {
    const db = dbAs(BOB);
    await assertFails(updateDoc(doc(db, 'books', ALICE), { memberUids: arrayRemove(BOB) }));
  });
});

describe('deleting フラグが無い通常の book では従来どおり書き込める(回帰)', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'books', ALICE), sharedBook(ALICE, [ALICE, BOB]));
      await setDoc(doc(db, 'books', ALICE, 'products', 'product-1'), {
        name: 'にんじん',
        categoryId: 'food',
      });
      await setDoc(doc(db, 'books', ALICE, 'stores', 'store-1'), { name: 'スーパー' });
    });
  });

  it('メンバーは priceRecords を新規作成できる', async () => {
    const db = dbAs(BOB);
    await assertSucceeds(
      addDoc(collection(db, 'books', ALICE, 'priceRecords'), {
        productId: 'product-1',
        storeId: 'store-1',
        price: 100,
        quantity: 1,
      }),
    );
  });
});

describe('book 作成トランザクション中は bookIsDeleting() が存在しない book を安全に扱う', () => {
  it('book が未作成の状態でも ensureBook の初回作成(categories 同時シード)が成功する', async () => {
    const db = dbAs(ALICE);
    await assertSucceeds(ensureBook(db, ALICE, 'アリス'));
  });
});

/**
 * deleting は Cloud Functions(Admin SDK、ルール非適用)専用のフラグ。
 * クライアントがこれをセットできると、永続的な書き込み拒否(DoS)を
 * 自分自身や他メンバーに対して引き起こせてしまうため、
 * create / update のどちらでも変更できないことを検証する。
 */
describe('クライアントは deleting フラグを付与できない', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'books', ALICE), sharedBook(ALICE, [ALICE, BOB]));
    });
  });

  it('オーナーは既存 book の update で deleting: true をセットできない', async () => {
    const db = dbAs(ALICE);
    await assertFails(updateDoc(doc(db, 'books', ALICE), { deleting: true }));
  });

  it('メンバーは既存 book の update で deleting: true をセットできない', async () => {
    const db = dbAs(BOB);
    await assertFails(updateDoc(doc(db, 'books', ALICE), { deleting: true }));
  });

  it('book 新規作成時に deleting: true を含めると拒否される', async () => {
    const db = dbAs(BOB);
    await assertFails(setDoc(doc(db, 'books', BOB), sharedBook(BOB, [BOB], true)));
  });
});
