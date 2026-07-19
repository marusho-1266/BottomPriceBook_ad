import {
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import type { BaseUnit } from '../../types/models';

export const DEFAULT_BOOK_NAME = 'わたしの底値帳';
export const DEFAULT_BOTTOM_WINDOW_MONTHS = 6;

/** 初回シードするカテゴリ。ID は決定的(再実行しても重複しない) */
export const SEED_CATEGORIES: ReadonlyArray<{
  id: string;
  name: string;
  baseUnit: BaseUnit;
  sortOrder: number;
}> = [
  { id: 'food', name: '食品', baseUnit: 'g', sortOrder: 0 },
  { id: 'drink', name: '飲料', baseUnit: 'ml', sortOrder: 1 },
  { id: 'detergent', name: '洗剤', baseUnit: 'ml', sortOrder: 2 },
  { id: 'tissue', name: 'ティッシュ', baseUnit: '組', sortOrder: 3 },
  { id: 'daily', name: '日用品', baseUnit: '個', sortOrder: 4 },
];

/**
 * ログインユーザーの book(bookId = uid)が無ければ作成する。
 * トランザクションで存在確認+作成をアトミックに行い、既存 book は一切変更しない(M-5)。
 * 自分の members doc(表示名。Issue #7)も無ければ補完し、既存なら上書きしない。
 */
export async function ensureBook(db: Firestore, uid: string, displayName: string): Promise<void> {
  const bookRef = doc(db, 'books', uid);
  const memberRef = doc(db, 'books', uid, 'members', uid);
  await runTransaction(db, async (tx) => {
    const bookSnapshot = await tx.get(bookRef);

    if (bookSnapshot.exists()) {
      // book 未作成時に members を読むとルール(isBookMember の get)で拒否されるため、
      // 存在確認は book が既にある場合のみ行う
      const memberSnapshot = await tx.get(memberRef);
      if (!memberSnapshot.exists()) {
        tx.set(memberRef, { displayName, joinedAt: serverTimestamp() });
      }
      return;
    }

    tx.set(memberRef, { displayName, joinedAt: serverTimestamp() });
    tx.set(bookRef, {
      name: DEFAULT_BOOK_NAME,
      ownerUid: uid,
      memberUids: [uid],
      bottomWindowMonths: DEFAULT_BOTTOM_WINDOW_MONTHS,
      createdAt: serverTimestamp(),
    });
    for (const category of SEED_CATEGORIES) {
      tx.set(doc(db, 'books', uid, 'categories', category.id), {
        name: category.name,
        baseUnit: category.baseUnit,
        sortOrder: category.sortOrder,
      });
    }
    // categories の書込レート制限(Issue #16)を満たすため、シードと同一トランザクションで更新する
    tx.set(doc(db, 'books', uid, 'rateLimits', uid), { lastWriteAt: serverTimestamp() });
  });
}

export const BOTTOM_WINDOW_OPTIONS = [
  { value: 0, label: '全期間' },
  { value: 3, label: '3ヶ月' },
  { value: 6, label: '6ヶ月' },
  { value: 12, label: '12ヶ月' },
] as const;

export async function updateBook(
  db: Firestore,
  bookId: string,
  patch: { name?: string; bottomWindowMonths?: number },
): Promise<void> {
  await updateDoc(doc(db, 'books', bookId), patch);
}
