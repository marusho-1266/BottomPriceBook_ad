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
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BOOK_NAME, SEED_CATEGORIES, ensureBook } from '../../src/features/books/api';

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
});

describe('ensureBook', () => {
  it('初回はセキュリティルールの下で book とシードカテゴリを作成する', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore() as unknown as Firestore;
    await ensureBook(db, ALICE, 'アリス');

    const book = await getDoc(doc(db, 'books', ALICE));
    expect(book.exists()).toBe(true);
    expect(book.data()).toMatchObject({
      name: DEFAULT_BOOK_NAME,
      ownerUid: ALICE,
      memberUids: [ALICE],
      bottomWindowMonths: 6,
    });

    const categories = await getDocs(collection(db, 'books', ALICE, 'categories'));
    expect(categories.size).toBe(SEED_CATEGORIES.length);
    expect(categories.docs.map((d) => d.id).sort()).toEqual(
      SEED_CATEGORIES.map((c) => c.id).sort(),
    );
  });

  it('初回作成でオーナーの members doc も作成される(Issue #7)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore() as unknown as Firestore;
    await ensureBook(db, ALICE, 'アリス');

    const member = await getDoc(doc(db, 'books', ALICE, 'members', ALICE));
    expect(member.exists()).toBe(true);
    expect(member.data()).toMatchObject({ displayName: 'アリス' });
  });

  it('2 回目の呼び出しではユーザー変更済みの設定を上書きしない(M-5)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore() as unknown as Firestore;
    await ensureBook(db, ALICE, 'アリス');

    await updateDoc(doc(db, 'books', ALICE), {
      name: '変更済みの名前',
      bottomWindowMonths: 12,
    });

    // 2 台目の端末での初回ログインを想定した再実行
    await ensureBook(db, ALICE, 'アリス');

    const book = await getDoc(doc(db, 'books', ALICE));
    expect(book.data()).toMatchObject({
      name: '変更済みの名前',
      bottomWindowMonths: 12,
    });
  });

  it('members doc が無い既存 book への再ログインで補完される(Issue #7)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore() as unknown as Firestore;
    // Issue #7 以前に作成された book(members doc 無し)を再現
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'books', ALICE), {
        name: '既存の底値帳',
        ownerUid: ALICE,
        memberUids: [ALICE],
        bottomWindowMonths: 6,
        createdAt: serverTimestamp(),
      });
    });

    await ensureBook(db, ALICE, 'アリス');

    const member = await getDoc(doc(db, 'books', ALICE, 'members', ALICE));
    expect(member.exists()).toBe(true);
    expect(member.data()).toMatchObject({ displayName: 'アリス' });
    // book 本体は変更しない
    const book = await getDoc(doc(db, 'books', ALICE));
    expect(book.data()).toMatchObject({ name: '既存の底値帳' });
  });

  it('既存の members doc は上書きしない(冪等)(Issue #7)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore() as unknown as Firestore;
    await ensureBook(db, ALICE, '旧しい名前');

    // 表示名が変わった状態での再ログイン
    await ensureBook(db, ALICE, '新しい名前');

    const member = await getDoc(doc(db, 'books', ALICE, 'members', ALICE));
    expect(member.data()).toMatchObject({ displayName: '旧しい名前' });
  });
});
