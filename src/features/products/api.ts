import { collection, doc, getDocs, orderBy, query, writeBatch } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { requireUid } from '../../lib/auth';
import { useCollection } from '../../lib/firestoreHooks';
import { withRateLimit } from '../../lib/rateLimit';
import { useBook } from '../books/BookProvider';
import type { Product, WithId } from '../../types/models';

export function useProducts() {
  const { bookId } = useBook();
  const productsQuery = useMemo(
    () => query(collection(db, 'books', bookId, 'products'), orderBy('name')),
    [bookId],
  );
  return useCollection<Product>(productsQuery);
}

/** book 内の商品一覧を一度だけ取得する(エクスポート等、購読不要な用途) */
export async function fetchProducts(bookId: string): Promise<WithId<Product>[]> {
  const snapshot = await getDocs(query(collection(db, 'books', bookId, 'products'), orderBy('name')));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Product) }));
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
