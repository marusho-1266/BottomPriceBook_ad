import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

function dbAs(uid: string): Firestore {
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;
}

const ALICE = 'alice-uid';
const BOB = 'bob-uid';
const CHARLIE = 'charlie-uid';
const CODE = 'valid-invite-code-1234';
const EXPIRED_CODE = 'expired-invite-code-12';
const OTHER_BOOK_CODE = 'other-book-code-123456';

function validBook(uid: string) {
  return {
    name: 'わたしの底値帳',
    ownerUid: uid,
    memberUids: [uid],
    bottomWindowMonths: 6,
    createdAt: serverTimestamp(),
  };
}

/** createdAt 基準。ageDays 日前に発行された招待(7 超で期限切れ) */
function invite(bookId: string, createdBy: string, ageDays = 0) {
  return {
    bookId,
    bookName: 'わたしの底値帳',
    createdBy,
    createdAt: Timestamp.fromMillis(Date.now() - ageDays * 24 * 60 * 60 * 1000),
  };
}

function memberDoc() {
  return {
    displayName: 'ボブ',
    joinedAt: serverTimestamp(),
  };
}

/**
 * members doc + joinTokens doc の作成と memberUids への自 uid 追加を
 * 1 バッチで行う(実装と同じ join 手順)。inviteCode 省略時は joinTokens を書かない
 */
async function joinBatch(db: Firestore, bookId: string, uid: string, inviteCode?: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'books', bookId, 'members', uid), memberDoc());
  if (inviteCode !== undefined) {
    batch.set(doc(db, 'books', bookId, 'joinTokens', uid), { inviteCode });
  }
  batch.update(doc(db, 'books', bookId), { memberUids: arrayUnion(uid) });
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
    await setDoc(doc(db, 'books', ALICE), validBook(ALICE));
    await setDoc(doc(db, 'books', CHARLIE), validBook(CHARLIE));
    await setDoc(doc(db, 'invites', CODE), invite(ALICE, ALICE));
    await setDoc(doc(db, 'invites', EXPIRED_CODE), invite(ALICE, ALICE, 8));
    await setDoc(doc(db, 'invites', OTHER_BOOK_CODE), invite(CHARLIE, CHARLIE));
  });
});

describe('招待コードによる参加(join バッチ)', () => {
  it('有効なコードなら members doc + memberUids 追加のバッチで参加できる', async () => {
    const db = dbAs(BOB);
    await assertSucceeds(joinBatch(db, ALICE, BOB, CODE));
  });

  it('members doc なしの memberUids 単独更新では参加できない', async () => {
    const db = dbAs(BOB);
    await assertFails(updateDoc(doc(db, 'books', ALICE), { memberUids: arrayUnion(BOB) }));
  });

  it('joinTokens(コード)なしのバッチでは参加できない', async () => {
    const db = dbAs(BOB);
    await assertFails(joinBatch(db, ALICE, BOB));
  });

  it('期限切れコードでは参加できない', async () => {
    const db = dbAs(BOB);
    await assertFails(joinBatch(db, ALICE, BOB, EXPIRED_CODE));
  });

  it('他の book のコードでは参加できない', async () => {
    const db = dbAs(BOB);
    await assertFails(joinBatch(db, ALICE, BOB, OTHER_BOOK_CODE));
  });

  it('存在しないコードでは参加できない', async () => {
    const db = dbAs(BOB);
    await assertFails(joinBatch(db, ALICE, BOB, 'no-such-code-00000000'));
  });

  it('自分以外の uid は追加できない', async () => {
    const db = dbAs(BOB);
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'members', BOB), memberDoc());
    batch.set(doc(db, 'books', ALICE, 'joinTokens', BOB), { inviteCode: CODE });
    batch.update(doc(db, 'books', ALICE), { memberUids: arrayUnion(BOB, CHARLIE) });
    await assertFails(batch.commit());
  });

  it('参加と同時に他フィールドは変更できない', async () => {
    const db = dbAs(BOB);
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'members', BOB), memberDoc());
    batch.set(doc(db, 'books', ALICE, 'joinTokens', BOB), { inviteCode: CODE });
    batch.update(doc(db, 'books', ALICE), { memberUids: arrayUnion(BOB), name: '乗っ取り' });
    await assertFails(batch.commit());
  });

  it('参加と同時に未知のトップレベルフィールドは追加できない', async () => {
    const db = dbAs(BOB);
    const batch = writeBatch(db);
    batch.set(doc(db, 'books', ALICE, 'members', BOB), memberDoc());
    batch.set(doc(db, 'books', ALICE, 'joinTokens', BOB), { inviteCode: CODE });
    batch.update(doc(db, 'books', ALICE), { memberUids: arrayUnion(BOB), injected: true });
    await assertFails(batch.commit());
  });

  it('参加後は book 配下(categories)を読み書きできる(rateLimits 同時更新)', async () => {
    const db = dbAs(BOB);
    await joinBatch(db, ALICE, BOB, CODE);
    const ref = doc(db, 'books', ALICE, 'categories', 'food');
    const batch = writeBatch(db);
    batch.set(ref, { name: '食品', baseUnit: 'g', sortOrder: 0 });
    batch.set(doc(db, 'books', ALICE, 'rateLimits', BOB), { lastWriteAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(ref));
  });
});

describe('参加中 book の一覧クエリ', () => {
  it('memberUids array-contains 自 uid のリストクエリが通る', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'books', ALICE), { memberUids: [ALICE, BOB] });
      await setDoc(doc(context.firestore(), 'books', BOB), validBook(BOB));
    });
    const db = dbAs(BOB);
    await assertSucceeds(
      getDocs(query(collection(db, 'books'), where('memberUids', 'array-contains', BOB))),
    );
  });

  it('他人の uid での array-contains クエリは拒否される', async () => {
    const db = dbAs(BOB);
    await assertFails(
      getDocs(query(collection(db, 'books'), where('memberUids', 'array-contains', ALICE))),
    );
  });
});

describe('members サブコレクション', () => {
  beforeEach(async () => {
    // BOB を ALICE の book のメンバーにしておく(members doc あり)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'books', ALICE), { memberUids: [ALICE, BOB] });
      await setDoc(doc(db, 'books', ALICE, 'members', BOB), memberDoc());
    });
  });

  it('メンバーは members を読める', async () => {
    const db = dbAs(BOB);
    await assertSucceeds(getDocs(collection(db, 'books', ALICE, 'members')));
  });

  it('非メンバーは members を読めない', async () => {
    const db = dbAs(CHARLIE);
    await assertFails(getDocs(collection(db, 'books', ALICE, 'members')));
  });

  it('既存メンバーは招待コードなしで自分の members doc を作成できる(補完用)', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'books', ALICE, 'members', BOB));
    });
    const db = dbAs(BOB);
    await assertSucceeds(
      setDoc(doc(db, 'books', ALICE, 'members', BOB), memberDoc()),
    );
  });

  it('displayName / joinedAt 以外のフィールドを含む members doc は作成できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'books', ALICE, 'members', BOB));
    });
    const db = dbAs(BOB);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'members', BOB), { ...memberDoc(), role: 'admin' }),
    );
  });

  it('非メンバーは招待コードなしで members doc を作成できない', async () => {
    const db = dbAs(CHARLIE);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'members', CHARLIE), memberDoc()),
    );
  });

  it('他人名義の members doc は作成できない', async () => {
    const db = dbAs(CHARLIE);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'members', BOB), memberDoc()),
    );
  });

  it('members doc は update できない', async () => {
    const db = dbAs(BOB);
    await assertFails(
      updateDoc(doc(db, 'books', ALICE, 'members', BOB), { displayName: '改名' }),
    );
  });

  it('本人は自分の members doc を削除できる', async () => {
    const db = dbAs(BOB);
    await assertSucceeds(deleteDoc(doc(db, 'books', ALICE, 'members', BOB)));
  });

  it('オーナーはメンバーの members doc を削除できる', async () => {
    const db = dbAs(ALICE);
    await assertSucceeds(deleteDoc(doc(db, 'books', ALICE, 'members', BOB)));
  });

  it('オーナーでも本人でもないメンバーは members doc を削除できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), 'books', ALICE), {
        memberUids: [ALICE, BOB, CHARLIE],
      });
    });
    const db = dbAs(CHARLIE);
    await assertFails(deleteDoc(doc(db, 'books', ALICE, 'members', BOB)));
  });
});

describe('joinTokens サブコレクション(招待コードの秘匿)', () => {
  beforeEach(async () => {
    // BOB が CODE で参加済みの状態(joinTokens にコードが残っている)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, 'books', ALICE), { memberUids: [ALICE, BOB] });
      await setDoc(doc(db, 'books', ALICE, 'members', BOB), memberDoc());
      await setDoc(doc(db, 'books', ALICE, 'joinTokens', BOB), { inviteCode: CODE });
    });
  });

  it('本人でも joinTokens(招待コード)を読めない', async () => {
    const db = dbAs(BOB);
    await assertFails(getDoc(doc(db, 'books', ALICE, 'joinTokens', BOB)));
  });

  it('オーナーでも他メンバーの joinTokens を読めない', async () => {
    const db = dbAs(ALICE);
    await assertFails(getDoc(doc(db, 'books', ALICE, 'joinTokens', BOB)));
  });

  it('メンバーでも joinTokens を list できない(コードの再取得・再配布の防止)', async () => {
    const db = dbAs(BOB);
    await assertFails(getDocs(collection(db, 'books', ALICE, 'joinTokens')));
  });

  it('joinTokens は update できない(コードのすり替え防止)', async () => {
    const db = dbAs(BOB);
    await assertFails(
      updateDoc(doc(db, 'books', ALICE, 'joinTokens', BOB), { inviteCode: EXPIRED_CODE }),
    );
  });

  it('有効な招待コードなしでは joinTokens を作成できない', async () => {
    const db = dbAs(CHARLIE);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'joinTokens', CHARLIE), { inviteCode: EXPIRED_CODE }),
    );
  });

  it('他人名義の joinTokens は作成できない', async () => {
    const db = dbAs(CHARLIE);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'joinTokens', BOB), { inviteCode: CODE }),
    );
  });

  it('inviteCode 以外のフィールドを持つ joinTokens は作成できない', async () => {
    const db = dbAs(CHARLIE);
    await assertFails(
      setDoc(doc(db, 'books', ALICE, 'joinTokens', CHARLIE), {
        inviteCode: CODE,
        injected: true,
      }),
    );
  });

  it('本人は自分の joinTokens を削除できる(退出時の掃除)', async () => {
    const db = dbAs(BOB);
    await assertSucceeds(deleteDoc(doc(db, 'books', ALICE, 'joinTokens', BOB)));
  });

  it('オーナーはメンバーの joinTokens を削除できる(メンバー削除時の掃除)', async () => {
    const db = dbAs(ALICE);
    await assertSucceeds(deleteDoc(doc(db, 'books', ALICE, 'joinTokens', BOB)));
  });
});
