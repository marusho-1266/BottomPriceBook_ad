import type { PriceRecord, WithId } from '../../types/models';

/** 価格記録の表示用日付(M/D)。ProductDetailPage / PC 右ペインで共有 */
export function formatPriceRecordDate(record: WithId<PriceRecord>): string {
  const d = record.recordedAt.toDate();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
