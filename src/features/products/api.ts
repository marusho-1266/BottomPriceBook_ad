import { addDoc, collection, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import { useBook } from '../books/BookProvider';
import type { Product } from '../../types/models';

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
  const ref = await addDoc(collection(db, 'books', bookId, 'products'), input);
  return ref.id;
}

export function updateProduct(
  bookId: string,
  productId: string,
  patch: { name?: string; categoryId?: string },
): Promise<void> {
  return updateDoc(doc(db, 'books', bookId, 'products', productId), patch);
}
