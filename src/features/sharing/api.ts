import { useMemo } from 'react';
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import type { Book, Invite, Member, WithId } from '../../types/models';

/** 招待コードの有効期限(日) */
export const INVITE_TTL_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** サーバー付与の createdAt から表示・クライアント判定用の expiresAt を導出する */
export function inviteExpiresAt(createdAt: Timestamp): Timestamp {
  return Timestamp.fromMillis(createdAt.toMillis() + INVITE_TTL_DAYS * DAY_MS);
}

/**
 * 招待コードを発行する(オーナーのみ。ルールで強制)。
 * 有効期限はクライアント時計ではなく createdAt(serverTimestamp) + 7 日をソースオブトゥルースとする。
 * 戻り値は invites の自動 ID = 招待コード。ログ等に出力しないこと
 */
export async function createInvite(
  db: Firestore,
  book: Pick<WithId<Book>, 'id' | 'name' | 'ownerUid'>,
): Promise<string> {
  const ref = doc(collection(db, 'invites'));
  await setDoc(ref, {
    bookId: book.id,
    bookName: book.name,
    createdBy: book.ownerUid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * 招待コードから招待を取得する。存在しなければ null。
 * オフラインキャッシュの stale な招待で参加させないため、常にサーバーから読む。
 * expiresAt はサーバーの createdAt から導出し、クライアント時計に依存しない
 */
export async function fetchInvite(db: Firestore, code: string): Promise<WithId<Invite> | null> {
  const snapshot = await getDocFromServer(doc(db, 'invites', code));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Omit<Invite, 'expiresAt'> & Partial<Pick<Invite, 'expiresAt'>>;
  return {
    id: snapshot.id,
    ...data,
    expiresAt: inviteExpiresAt(data.createdAt),
  };
}

/**
 * 期限内なら true。境界はルールの request.time < createdAt + 7d と揃える。
 * expiresAt がある場合はそれを使い、なければ createdAt から導出する
 */
export function isInviteValid(
  invite: Pick<Invite, 'expiresAt'> | Pick<Invite, 'createdAt'>,
  now: Date = new Date(),
): boolean {
  const expiresMs =
    'expiresAt' in invite && invite.expiresAt
      ? invite.expiresAt.toMillis()
      : inviteExpiresAt((invite as Pick<Invite, 'createdAt'>).createdAt).toMillis();
  return now.getTime() < expiresMs;
}

/** 招待リンクを組み立てる */
export function buildInviteUrl(code: string, origin: string = window.location.origin): string {
  return `${origin}/join/${code}`;
}

/** book のメンバープロフィール一覧を購読する */
export function useMembers(bookId: string): { data: WithId<Member>[]; loading: boolean } {
  const membersQuery = useMemo(() => collection(db, 'books', bookId, 'members'), [bookId]);
  return useCollection<Member>(membersQuery);
}

/**
 * book に参加する。members doc / joinTokens doc の作成と memberUids への追加を
 * 1 バッチで行い、セキュリティルールが招待コードの有効性を検証する(要オンライン)。
 * コードは秘密情報のため、メンバーが読める members ではなく誰も読めない joinTokens に置く
 */
export async function joinBook(
  db: Firestore,
  params: { bookId: string; inviteCode: string; uid: string; displayName: string },
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'books', params.bookId, 'members', params.uid), {
    displayName: params.displayName,
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'books', params.bookId, 'joinTokens', params.uid), {
    inviteCode: params.inviteCode,
  });
  batch.update(doc(db, 'books', params.bookId), { memberUids: arrayUnion(params.uid) });
  await batch.commit();
}

/** members doc / joinTokens doc の削除と memberUids からの除去を 1 バッチで行う */
async function removeFromBook(db: Firestore, bookId: string, targetUid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'books', bookId, 'members', targetUid));
  batch.delete(doc(db, 'books', bookId, 'joinTokens', targetUid));
  batch.update(doc(db, 'books', bookId), { memberUids: arrayRemove(targetUid) });
  await batch.commit();
}

/** 参加中の book から本人が退出する(オーナーは不可。ルールで強制) */
export async function leaveBook(db: Firestore, bookId: string, uid: string): Promise<void> {
  await removeFromBook(db, bookId, uid);
}

/** オーナーがメンバーを削除する。当人の価格記録は削除しない(book に帰属) */
export async function removeMember(
  db: Firestore,
  bookId: string,
  targetUid: string,
): Promise<void> {
  await removeFromBook(db, bookId, targetUid);
}
