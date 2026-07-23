import { SaleBadge } from './SaleBadge';
import type { BottomResult } from '../features/prices/bottomPrice';
import type { PriceRecord, WithId } from '../types/models';

type Props = {
  byStore: Map<string, BottomResult<WithId<PriceRecord>>>;
  storeName: (storeId: string) => string;
  className?: string;
  /** 商品詳細ページ用。未指定なら data-testid なし */
  testId?: string;
};

/** 店舗別底値一覧。ProductDetailPage / PC 右ペインで共有 */
export function ProductByStoreSection({ byStore, storeName, className, testId }: Props) {
  if (byStore.size === 0) return null;

  return (
    <section data-testid={testId} className={className}>
      <h3 className="mb-2 text-[13px] font-extrabold">店舗別底値</h3>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-sm shadow-ink/5">
        {[...byStore.entries()].map(([storeId, best]) => (
          <div
            key={storeId}
            className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
          >
            <span className="text-sm font-bold">{storeName(storeId)}</span>
            <div className="text-right">
              <span className="font-extrabold text-primary">
                ¥{best.record.price.toLocaleString()}
              </span>
              {best.record.isSale && (
                <span className="ml-1.5">
                  <SaleBadge />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
