import { readFileSync } from 'node:fs';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createInvite,
  fetchInvite,
  joinBook,
  leaveBook,
  removeMember,
} from '../../src/features/sharing/api';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

function validBook(uid: string) {
  return {
    name: 'アリスの底値帳',
    ownerUid: uid,
    memberUids: [uid],
    bottomWindowMonths: 6,
    createdAt: serverTimestamp(),
  };
}

function dbAs(uid: string): Firestore {
  return testEnv.authenticatedContext(uid, { email_verified: true }).firestore() as unknown as Firestore;
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

describe('sharing api(セキュリティルール下での統合)', () => {
  it('招待発行 → 取得 → 参加 → 退出の一連が実 API で通る', async () => {
    // オーナーが招待を発行
    const code = await createInvite(dbAs(ALICE), { id: ALICE, name: 'アリスの底値帳', ownerUid: ALICE });
    expect(code).toBeTruthy();

    // 招待された側がコードで取得できる
    const invite = await fetchInvite(dbAs(BOB), code);
    expect(invite).not.toBeNull();
    expect(invite?.bookId).toBe(ALICE);
    expect(invite?.bookName).toBe('アリスの底値帳');
    // expiresAt はサーバーの createdAt + 7 日から導出される
    expect(invite?.expiresAt.toMillis()).toBe(
      invite!.createdAt.toMillis() + 7 * 24 * 60 * 60 * 1000,
    );

    // 参加
    await joinBook(dbAs(BOB), {
      bookId: ALICE,
      inviteCode: code,
      uid: BOB,
      displayName: 'ボブ',
    });
    const bookAfterJoin = await getDoc(doc(dbAs(BOB), 'books', ALICE));
    expect(bookAfterJoin.data()?.memberUids).toEqual([ALICE, BOB]);
    // members doc は表示名のみで、招待コードを含まない(メンバーに露出させない)
    const memberDoc = await getDoc(doc(dbAs(BOB), 'books', ALICE, 'members', BOB));
    expect(memberDoc.data()).toMatchObject({ displayName: 'ボブ' });
    expect(memberDoc.data()).not.toHaveProperty('inviteCode');

    // 本人退出(members / joinTokens doc も掃除される)
    await leaveBook(dbAs(BOB), ALICE, BOB);
    const bookAfterLeave = await getDoc(doc(dbAs(ALICE), 'books', ALICE));
    expect(bookAfterLeave.data()?.memberUids).toEqual([ALICE]);
    const memberDocAfterLeave = await getDoc(doc(dbAs(ALICE), 'books', ALICE, 'members', BOB));
    expect(memberDocAfterLeave.exists()).toBe(false);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const tokenDoc = await getDoc(doc(context.firestore(), 'books', ALICE, 'joinTokens', BOB));
      expect(tokenDoc.exists()).toBe(false);
    });
  });

  it('参加後も本人・オーナーとも joinTokens から招待コードを読み出せない', async () => {
    const code = await createInvite(dbAs(ALICE), { id: ALICE, name: 'アリスの底値帳', ownerUid: ALICE });
    await joinBook(dbAs(BOB), {
      bookId: ALICE,
      inviteCode: code,
      uid: BOB,
      displayName: 'ボブ',
    });

    await assertFails(getDoc(doc(dbAs(BOB), 'books', ALICE, 'joinTokens', BOB)));
    await assertFails(getDoc(doc(dbAs(ALICE), 'books', ALICE, 'joinTokens', BOB)));
  });

  it('オーナーが removeMember でメンバーを削除できる(members doc も掃除)', async () => {
    const code = await createInvite(dbAs(ALICE), { id: ALICE, name: 'アリスの底値帳', ownerUid: ALICE });
    await joinBook(dbAs(BOB), {
      bookId: ALICE,
      inviteCode: code,
      uid: BOB,
      displayName: 'ボブ',
    });

    await removeMember(dbAs(ALICE), ALICE, BOB);
    const book = await getDoc(doc(dbAs(ALICE), 'books', ALICE));
    expect(book.data()?.memberUids).toEqual([ALICE]);
    const memberDoc = await getDoc(doc(dbAs(ALICE), 'books', ALICE, 'members', BOB));
    expect(memberDoc.exists()).toBe(false);
  });

  it('存在しないコードの fetchInvite は null を返す', async () => {
    const invite = await fetchInvite(dbAs(BOB), 'no-such-code-00000000');
    expect(invite).toBeNull();
  });

  it('非オーナーは createInvite できない', async () => {
    await assertFails(createInvite(dbAs(BOB), { id: ALICE, name: 'アリスの底値帳', ownerUid: ALICE }));
  });
});
