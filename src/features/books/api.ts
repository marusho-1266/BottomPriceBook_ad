import {
  doc,
  runTransaction,
  serverTimestamp,
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
 */
export async function ensureBook(db: Firestore, uid: string): Promise<void> {
  const bookRef = doc(db, 'books', uid);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(bookRef);
    if (snapshot.exists()) return;

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
  });
}
