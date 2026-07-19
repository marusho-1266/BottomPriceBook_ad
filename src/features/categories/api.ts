import { collection, deleteDoc, doc, orderBy, query, writeBatch } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { requireUid } from '../../lib/auth';
import { useCollection } from '../../lib/firestoreHooks';
import { withRateLimit } from '../../lib/rateLimit';
import { useBook } from '../books/BookProvider';
import type { BaseUnit, Category } from '../../types/models';
import {
  updateCategoryWithRecords,
  type UpdateCategoryInput,
  type UpdateCategoryOptions,
} from './updateCategory';

export function useCategories() {
  const { bookId } = useBook();
  const categoriesQuery = useMemo(
    () => query(collection(db, 'books', bookId, 'categories'), orderBy('sortOrder')),
    [bookId],
  );
  return useCollection<Category>(categoriesQuery);
}

export function addCategory(
  bookId: string,
  input: { name: string; baseUnit: BaseUnit },
): Promise<unknown> {
  const uid = requireUid();
  const ref = doc(collection(db, 'books', bookId, 'categories'));
  const batch = writeBatch(db);
  batch.set(ref, { ...input, sortOrder: Date.now() });
  withRateLimit(batch, bookId, uid);
  return batch.commit().then(() => ref);
}

/** 名称・基準単位の更新。baseUnit 変更時は配下記録をリラベルする */
export function updateCategory(
  bookId: string,
  categoryId: string,
  input: UpdateCategoryInput,
  options: UpdateCategoryOptions,
): Promise<void> {
  return updateCategoryWithRecords(db, bookId, categoryId, requireUid(), input, options);
}

/** 参照チェックは呼び出し側(UI)の責務。MVP の意図的な割り切り(L-7) */
export function deleteCategory(bookId: string, categoryId: string): Promise<void> {
  return deleteDoc(doc(db, 'books', bookId, 'categories', categoryId));
}
