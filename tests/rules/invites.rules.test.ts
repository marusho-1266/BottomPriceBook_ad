import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CODE = 'invite-code-1234567890';

function validBook(uid: string) {
  return {
    name: 'わたしの底値帳',
    ownerUid: uid,
    memberUids: [uid],
    bottomWindowMonths: 6,
    createdAt: serverTimestamp(),
  };
}

/** 招待ドキュメント。days は createdAt の「今からの相対日数」(7=ちょうど発行、 -1=期限切れ相当) */
function validInvite(bookId: string, createdBy: string, days = 0) {
  return {
    bookId,
    bookName: 'わたしの底値帳',
    createdBy,
    // ルール経由の create は serverTimestamp 必須。テストの失敗ケース用に Timestamp も渡せる
    createdAt: days === 0 ? serverTimestamp() : Timestamp.fromMillis(Date.now() + days * 24 * 60 * 60 * 1000),
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

describe('invites の作成', () => {
  it('book のオーナーは自分の book の招待を作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, 'invites', CODE), validInvite(ALICE, ALICE)));
  });

  it('他人の book への招待は作成できない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, 'invites', CODE), validInvite(ALICE, BOB)));
  });

  it('createdBy を偽装した招待は作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'invites', CODE), validInvite(ALICE, BOB)));
  });

  it('オーナーでないメンバーは招待を作成できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'books', ALICE), { memberUids: [ALICE, BOB] });
    });
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, 'invites', CODE), validInvite(ALICE, BOB)));
  });

  it('createdAt が serverTimestamp でない招待は作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'invites', CODE), validInvite(ALICE, ALICE, -1)));
  });

  it('expiresAt など余分なフィールド付きの招待は作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      setDoc(doc(db, 'invites', CODE), {
        ...validInvite(ALICE, ALICE),
        expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );
  });

  it('未認証では作成できない', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'invites', CODE), validInvite(ALICE, ALICE)));
  });
});

describe('invites の読み取り', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invites', CODE), validInvite(ALICE, ALICE));
    });
  });

  it('認証済ユーザーはコードを指定して get できる', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, 'invites', CODE)));
  });

  it('未認証では get できない', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'invites', CODE)));
  });

  it('list(コレクション全件取得)はオーナーでもできない', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(getDocs(collection(db, 'invites')));
  });
});

describe('invites の更新・削除', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'invites', CODE), validInvite(ALICE, ALICE));
    });
  });

  it('発行者は招待を削除できる', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertSucceeds(deleteDoc(doc(db, 'invites', CODE)));
  });

  it('発行者以外は削除できない', async () => {
    const db = testEnv.authenticatedContext(BOB).firestore();
    await assertFails(deleteDoc(doc(db, 'invites', CODE)));
  });

  it('発行者でも update はできない(期限延長の禁止)', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore();
    await assertFails(
      updateDoc(doc(db, 'invites', CODE), {
        bookName: '書き換え',
      }),
    );
  });
});
