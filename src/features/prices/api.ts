import { collection, query } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import { useBook } from '../books/BookProvider';
import type { PriceRecord } from '../../types/models';

/** book 内の全価格記録を購読する(底値算出・参照カウントに使用) */
export function usePriceRecords() {
  const { bookId } = useBook();
  const recordsQuery = useMemo(() => query(collection(db, 'books', bookId, 'priceRecords')), [bookId]);
  return useCollection<PriceRecord>(recordsQuery);
}
