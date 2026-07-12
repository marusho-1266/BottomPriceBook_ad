import { addDoc, collection, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import { useBook } from '../books/BookProvider';
import type { Store } from '../../types/models';

export function useStores() {
  const { bookId } = useBook();
  const storesQuery = useMemo(
    () => query(collection(db, 'books', bookId, 'stores'), orderBy('name')),
    [bookId],
  );
  return useCollection<Store>(storesQuery);
}

export function addStore(bookId: string, name: string): Promise<unknown> {
  return addDoc(collection(db, 'books', bookId, 'stores'), { name });
}

export function renameStore(bookId: string, storeId: string, name: string): Promise<void> {
  return updateDoc(doc(db, 'books', bookId, 'stores', storeId), { name });
}
