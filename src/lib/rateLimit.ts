import { doc, serverTimestamp, type WriteBatch } from 'firebase/firestore';
import { db } from './firebase';

/**
 * 書込レート制限(Issue #16)用の rateLimits doc 更新をバッチに積む。
 * firestore.rules は categories/stores/products/priceRecords の create/update に
 * 同一バッチでの本更新を必須化しており、rateLimits 側のルールが
 * 「前回の書込から 1 秒以上」を強制する
 */
export function withRateLimit(batch: WriteBatch, bookId: string, uid: string): void {
  batch.set(doc(db, 'books', bookId, 'rateLimits', uid), { lastWriteAt: serverTimestamp() });
}
