import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CHARLIE = 'charlie-uid';

function sharedBook(owner: string, members: string[]) {
  return {
    name: 'わたしの底値帳',
    ownerUid: owner,
    memberUids: members,
    bottomWindowMonths: 6,
    createdAt: serverTimestamp(),
  };
}

/** members doc 削除 + memberUids からの除去を 1 バッチで行う(実装と同じ退出/削除手順) */
async function leaveBatch(db: Firestore, bookId: string, targetUid: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'books', bookId, 'members', targetUid));
  batch.update(doc(db, 'books', bookId), { memberUids: arrayRemove(targetUid) });
  return batch.commit();
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
    const db = context.firestore();
    await setDoc(doc(db, 'books', ALICE), sharedBook(ALICE, [ALICE, BOB, CHARLIE]));
    await setDoc(doc(db, 'books', ALICE, 'members', BOB), {
      displayName: 'ボブ',
      joinedAt: serverTimestamp(),
    });
  });
});

describe('メンバー本人の退出', () => {
  it('メンバーは members doc 削除 + memberUids 除去のバッチで退出できる', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(leaveBatch(db, ALICE, BOB));
  });

  it('オーナーは自分の book から退出できない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, 'books', ALICE), { memberUids: arrayRemove(ALICE) }));
  });

  it('メンバーは他人の uid を除去できない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, 'books', ALICE), { memberUids: arrayRemove(CHARLIE) }));
  });

  it('非メンバーは memberUids を操作できない', async () => {
    const db = testEnv.authenticatedContext('mallory-uid').firestore();
    await assertFails(updateDoc(doc(db, 'books', ALICE), { memberUids: arrayRemove(BOB) }));
  });

  it('退出と同時に他フィールドは変更できない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(
      updateDoc(doc(db, 'books', ALICE), { memberUids: arrayRemove(BOB), name: '改名' }),
    );
  });

  it('退出と同時に自分以外の uid は除去できない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(
      updateDoc(doc(db, 'books', ALICE), { memberUids: [ALICE] }),
    );
  });
});

describe('オーナーによるメンバー削除(既存ルールの固定化)', () => {
  it('オーナーは members doc 削除 + memberUids 除去のバッチでメンバーを削除できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(leaveBatch(db, ALICE, BOB));
  });

  it('オーナー以外のメンバーは他メンバーを削除できない', async () => {
    const db = testEnv.authenticatedContext(CHARLIE).firestore();
    await assertFails(leaveBatch(db, ALICE, BOB));
  });
});
