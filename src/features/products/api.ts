import { collection, doc, orderBy, query, writeBatch } from 'firebase/firestore';
import { useMemo } from 'react';
import { auth, db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import { withRateLimit } from '../../lib/rateLimit';
import { useBook } from '../books/BookProvider';
import type { Product } from '../../types/models';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('not authenticated');
  }
  return uid;
}

export function useProducts() {
  const { bookId } = useBook();
  const productsQuery = useMemo(
    () => query(collection(db, 'books', bookId, 'products'), orderBy('name')),
    [bookId],
  );
  return useCollection<Product>(productsQuery);
}

export async function addProduct(
  bookId: string,
  input: { name: string; categoryId: string },
): Promise<string> {
  const uid = requireUid();
  const ref = doc(collection(db, 'books', bookId, 'products'));
  const batch = writeBatch(db);
  batch.set(ref, input);
  withRateLimit(batch, bookId, uid);
  await batch.commit();
  return ref.id;
}

export function updateProduct(
  bookId: string,
  productId: string,
  patch: { name?: string; categoryId?: string },
): Promise<void> {
  const uid = requireUid();
  const batch = writeBatch(db);
  batch.update(doc(db, 'books', bookId, 'products', productId), patch);
  withRateLimit(batch, bookId, uid);
  return batch.commit();
}
