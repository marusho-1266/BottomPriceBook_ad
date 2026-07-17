import { signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import type { App } from 'firebase-admin/app';
import type { Auth as AdminAuth } from 'firebase-admin/auth';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAccount, reauthenticate } from '../../src/features/account/api';
import { resolveCurrentBookId } from '../../src/features/books/BookProvider';
import { createInvite, joinBook } from '../../src/features/sharing/api';
import { auth, db } from '../../src/lib/firebase';
import { PASSWORD, clearEmulators, deleteAdminApp, initAdminApp, signUp } from './testUtils';

/**
 * アカウント削除 E2E: オーナーが退会するシナリオ。
 * `npm run emulators` で Firestore/Auth/Functions エミュレータを起動してから実行すること。
 * deleteAccount.member.e2e.test.ts と同じ理由で別ファイルに分離している。
 */

let adminApp: App;
let adminDb: AdminFirestore;
let adminAuth: AdminAuth;

beforeAll(() => {
  ({ adminApp, adminDb, adminAuth } = initAdminApp());
});

afterAll(async () => {
  await deleteAdminApp(adminApp);
});

beforeEach(async () => {
  await clearEmulators();
  await firebaseSignOut(auth).catch(() => {});
  vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
});

describe('アカウント削除 E2E: オーナーの退会', () => {
  it('book ごと削除され、メンバーは自分の book へフォールバックする', async () => {
    const alice = await signUp('alice@example.com', 'アリス');
    const inviteCode = await createInvite(db, {
      id: alice.uid,
      name: 'わたしの底値帳',
      ownerUid: alice.uid,
    });

    await firebaseSignOut(auth);
    const bob = await signUp('bob@example.com', 'ボブ');
    await joinBook(db, {
      bookId: alice.uid,
      inviteCode,
      uid: bob.uid,
      displayName: 'ボブ',
    });

    await firebaseSignOut(auth);
    await signInWithEmailAndPassword(auth, 'alice@example.com', PASSWORD);
    await reauthenticate(PASSWORD);
    await deleteAccount(alice.uid);

    await expect(signInWithEmailAndPassword(auth, 'alice@example.com', PASSWORD)).rejects.toThrow();
    await expect(adminAuth.getUser(alice.uid)).rejects.toThrow();
    expect((await adminDb.collection('books').doc(alice.uid).get()).exists).toBe(false);
    expect(
      (await adminDb.collection('invites').where('createdBy', '==', alice.uid).get()).empty,
    ).toBe(true);

    // bob(メンバー側)は影響を受けず、次回アクセス時に自分の book へフォールバックする。
    // deleteAccount(alice.uid) が呼んだ terminate(db) でこのファイルの client 側 db は
    // 以後使用不能になるため、ここでは(セキュリティルールをバイパスする)Admin SDK で
    // 「bob がメンバーの book 一覧」というアプリと同じクエリ条件を検証する
    const booksSnapshot = await adminDb
      .collection('books')
      .where('memberUids', 'array-contains', bob.uid)
      .get();
    const bookIds = booksSnapshot.docs.map((docSnapshot) => docSnapshot.id);

    expect(bookIds).toEqual([bob.uid]);
    expect(
      resolveCurrentBookId(booksSnapshot.docs.map((d) => ({ id: d.id })), alice.uid, bob.uid),
    ).toBe(bob.uid);
  });
});
