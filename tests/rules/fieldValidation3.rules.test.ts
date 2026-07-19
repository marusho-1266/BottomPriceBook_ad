import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const LONG_101 = 'a'.repeat(101);

function validBook(uid: string, memberUids: string[] = [uid]) {
  return {
    name: 'わたしの底値帳',
    ownerUid: uid,
    memberUids,
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

describe('books のフィールド検証強化(Issue #16)', () => {
  it('許可フィールドのみなら作成できる(既存フィールド構成の回帰)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(db, 'books', ALICE), validBook(ALICE)));
  });

  it('許可リスト外のフィールドがあると作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE), { ...validBook(ALICE), extra: 'invalid' }),
    );
  });

  it('name が101文字だと作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE), { ...validBook(ALICE), name: LONG_101 }));
  });

  it('name が空文字だと作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'books', ALICE), { ...validBook(ALICE), name: '' }));
  });

  describe('既存 book への更新', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'books', ALICE), validBook(ALICE));
      });
    });

    it('許可リスト外のフィールドを追加する更新は拒否される', async () => {
      const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
      await assertFails(updateDoc(doc(db, 'books', ALICE), { extra: 'x' }));
    });

    it('name の更新は100文字以内なら成功する(既存の正常系回帰)', async () => {
      const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
      await assertSucceeds(updateDoc(doc(db, 'books', ALICE), { name: '新しい名前' }));
    });

    it('memberUids が21人になる更新は拒否される', async () => {
      const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
      const members = [ALICE, ...Array.from({ length: 20 }, (_, i) => `member-${i}`)];
      await assertFails(updateDoc(doc(db, 'books', ALICE), { memberUids: members }));
    });

    it('memberUids が20人ちょうどになる更新は成功する', async () => {
      const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
      const members = [ALICE, ...Array.from({ length: 19 }, (_, i) => `member-${i}`)];
      await assertSucceeds(updateDoc(doc(db, 'books', ALICE), { memberUids: members }));
    });
  });
});
