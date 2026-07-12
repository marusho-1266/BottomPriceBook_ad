import { addDoc, collection, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import { useBook } from '../books/BookProvider';
import type { BaseUnit, Category } from '../../types/models';

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
  return addDoc(collection(db, 'books', bookId, 'categories'), {
    ...input,
    sortOrder: Date.now(),
  });
}

export function renameCategory(bookId: string, categoryId: string, name: string): Promise<void> {
  return updateDoc(doc(db, 'books', bookId, 'categories', categoryId), { name });
}
