import type { Auth } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export interface DeleteAccountDeps {
  firestore: Firestore;
  auth: Auth;
}

function isAuthUserNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'auth/user-not-found'
  );
}

/** 自分が発行した招待コードをすべて削除する */
async function deleteOwnInvites(firestore: Firestore, uid: string): Promise<void> {
  const snapshot = await firestore.collection('invites').where('createdBy', '==', uid).get();
  await Promise.all(snapshot.docs.map((docSnapshot) => docSnapshot.ref.delete()));
}

/** 参加中(オーナーではない)book から退出する。価格記録などは残す */
async function leaveOtherBooks(firestore: Firestore, uid: string): Promise<void> {
  const snapshot = await firestore
    .collection('books')
    .where('memberUids', 'array-contains', uid)
    .get();

  const otherBooks = snapshot.docs.filter((docSnapshot) => docSnapshot.data().ownerUid !== uid);

  await Promise.all(
    otherBooks.map(async (bookDoc) => {
      const batch = firestore.batch();
      batch.delete(bookDoc.ref.collection('members').doc(uid));
      batch.delete(bookDoc.ref.collection('joinTokens').doc(uid));
      batch.update(bookDoc.ref, { memberUids: FieldValue.arrayRemove(uid) });
      await batch.commit();
    }),
  );
}

/** 自分の book をサブコレクション込みで再帰削除する */
async function deleteOwnBook(firestore: Firestore, uid: string): Promise<void> {
  await firestore.recursiveDelete(firestore.collection('books').doc(uid));
}

/** Auth ユーザーを削除する。既に存在しない場合は成功扱い(冪等) */
async function deleteAuthUser(auth: Auth, uid: string): Promise<void> {
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (!isAuthUserNotFound(error)) {
      throw error;
    }
  }
}

/**
 * アカウント削除(退会)。呼び出し元の uid のデータのみを対象とする。
 * 途中失敗時に再実行しても完走できるよう、各ステップは「存在すれば消す」で冪等に実装する。
 * 順序: invites → 参加 book からの退出 → 自分の book の再帰削除 → Auth ユーザー削除
 * (Auth 削除を最後にすることで、失敗時もログインしたまま再実行できる)
 */
export async function runDeleteAccount(uid: string, { firestore, auth }: DeleteAccountDeps): Promise<void> {
  await deleteOwnInvites(firestore, uid);
  await leaveOtherBooks(firestore, uid);
  await deleteOwnBook(firestore, uid);
  await deleteAuthUser(auth, uid);
}
