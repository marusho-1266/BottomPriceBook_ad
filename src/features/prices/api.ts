import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '../../lib/firebase';
import { requireUid } from '../../lib/auth';
import { trackEvent } from '../../lib/analytics';
import { useCollection } from '../../lib/firestoreHooks';
import { withRateLimit } from '../../lib/rateLimit';
import { useBook } from '../books/BookProvider';
import { windowStart } from './bottomPrice';
import type { PriceRecord, WithId } from '../../types/models';

export interface PriceRecordDraft {
  productId: string;
  storeId: string;
  price: number;
  quantity: number;
  unit: string;
  isSale: boolean;
  recordedAt: Date;
}

export async function addPriceRecord(bookId: string, draft: PriceRecordDraft): Promise<unknown> {
  if (draft.price <= 0 || draft.quantity <= 0) {
    return Promise.reject(new Error('price and quantity must be positive'));
  }
  const uid = requireUid();
  const ref = doc(collection(db, 'books', bookId, 'priceRecords'));
  const batch = writeBatch(db);
  batch.set(ref, { ...draft, recordedAt: Timestamp.fromDate(draft.recordedAt) });
  withRateLimit(batch, bookId, uid);
  await batch.commit();
  void trackEvent('record_price', { isSale: draft.isSale });
  return ref;
}

export function updatePriceRecord(
  bookId: string,
  recordId: string,
  patch: Partial<Omit<PriceRecordDraft, 'recordedAt'>> & { recordedAt?: Date },
): Promise<void> {
  if ((patch.price !== undefined && patch.price <= 0) ||
      (patch.quantity !== undefined && patch.quantity <= 0)) {
    return Promise.reject(new Error('price and quantity must be positive'));
  }
  const uid = requireUid();
  const { recordedAt, ...rest } = patch;
  const batch = writeBatch(db);
  batch.update(doc(db, 'books', bookId, 'priceRecords', recordId), {
    ...rest,
    ...(recordedAt ? { recordedAt: Timestamp.fromDate(recordedAt) } : {}),
  });
  withRateLimit(batch, bookId, uid);
  return batch.commit();
}

export function deletePriceRecord(bookId: string, recordId: string): Promise<void> {
  return deleteDoc(doc(db, 'books', bookId, 'priceRecords', recordId));
}

/**
 * book 内の価格記録を購読する。
 * `options` を渡すと `recordedAt` が対象期間より古い記録はクエリ段階で除外する
 * (`windowMonths <= 0` は「全期間」を意味し、絞り込みなしで購読する)。
 * 参照カウント(店舗削除可否判定など、全期間の記録が必要な用途)では `options` を省略すること
 */
export function usePriceRecords(options?: { windowMonths: number; now: Date }) {
  const { bookId } = useBook();
  const cutoff = options ? windowStart(options.now, options.windowMonths) : null;
  const cutoffMs = cutoff?.getTime();
  const recordsQuery = useMemo(() => {
    const base = collection(db, 'books', bookId, 'priceRecords');
    return cutoffMs === undefined
      ? query(base)
      : query(base, where('recordedAt', '>=', Timestamp.fromDate(new Date(cutoffMs))));
  }, [bookId, cutoffMs]);
  return useCollection<PriceRecord>(recordsQuery);
}

/** book 内の全期間の価格記録を一度だけ取得する(エクスポート等、購読不要な用途) */
export async function fetchPriceRecords(bookId: string): Promise<WithId<PriceRecord>[]> {
  const snapshot = await getDocs(collection(db, 'books', bookId, 'priceRecords'));
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as PriceRecord) }));
}

/** 特定商品の価格記録のみを購読する(商品詳細の全期間履歴表示に使用) */
export function useProductPriceRecords(productId: string | undefined) {
  const { bookId } = useBook();
  const recordsQuery = useMemo(
    () =>
      productId
        ? query(collection(db, 'books', bookId, 'priceRecords'), where('productId', '==', productId))
        : null,
    [bookId, productId],
  );
  return useCollection<PriceRecord>(recordsQuery);
}
