import { collection, deleteDoc, doc, orderBy, query, writeBatch } from 'firebase/firestore';
import { useMemo } from 'react';
import { auth, db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import { withRateLimit } from '../../lib/rateLimit';
import { useBook } from '../books/BookProvider';
import type { Store } from '../../types/models';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('not authenticated');
  }
  return uid;
}

export function useStores() {
  const { bookId } = useBook();
  const storesQuery = useMemo(
    () => query(collection(db, 'books', bookId, 'stores'), orderBy('name')),
    [bookId],
  );
  return useCollection<Store>(storesQuery);
}

export function addStore(bookId: string, name: string): Promise<unknown> {
  const uid = requireUid();
  const ref = doc(collection(db, 'books', bookId, 'stores'));
  const batch = writeBatch(db);
  batch.set(ref, { name });
  withRateLimit(batch, bookId, uid);
  return batch.commit().then(() => ref);
}

export function renameStore(bookId: string, storeId: string, name: string): Promise<void> {
  const uid = requireUid();
  const batch = writeBatch(db);
  batch.update(doc(db, 'books', bookId, 'stores', storeId), { name });
  withRateLimit(batch, bookId, uid);
  return batch.commit();
}

/** 参照チェックは呼び出し側(UI)の責務。MVP の意図的な割り切り(L-7) */
export function deleteStore(bookId: string, storeId: string): Promise<void> {
  return deleteDoc(doc(db, 'books', bookId, 'stores', storeId));
}
