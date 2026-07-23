import type { BottomResult } from './bottomPrice';
import type { PriceRecord, WithId } from '../../types/models';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type HomeSummary = {
  productCount: number;
  weekRecordCount: number;
  bottomUpdatedCount: number;
};

/**
 * ホーム画面サマリー 3 指標。定義は現行 HomePage と同一:
 * - 登録商品: products.length
 * - 今週の記録: 直近 7 日以内の priceRecords 件数
 * - 底値更新: 今週の記録のうち、現在の商品底値レコードと id が一致する件数
 */
export function computeHomeSummary(
  productCount: number,
  records: WithId<PriceRecord>[],
  bottoms: Map<string, BottomResult<WithId<PriceRecord>>>,
  now: Date,
): HomeSummary {
  const weekRecords = records.filter(
    (r) => now.getTime() - r.recordedAt.toDate().getTime() < WEEK_MS,
  );
  const bottomIds = new Set([...bottoms.values()].map((b) => b.record.id));
  const bottomUpdatedCount = weekRecords.filter((r) => bottomIds.has(r.id)).length;

  return {
    productCount,
    weekRecordCount: weekRecords.length,
    bottomUpdatedCount,
  };
}
