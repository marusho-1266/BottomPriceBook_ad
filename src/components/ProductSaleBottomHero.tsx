import { SaleBadge } from './SaleBadge';
import type { BottomResult } from '../features/prices/bottomPrice';
import { formatPricePerBase } from '../lib/units';
import type { BaseUnit, PriceRecord, WithId } from '../types/models';

type Props = {
  saleBottom: BottomResult<WithId<PriceRecord>>;
  storeName: (storeId: string) => string;
  baseUnit: BaseUnit;
  /** 詳細ページは「底値(特売込み)」、右ペインはカテゴリ名など */
  eyebrow: string;
  /**
   * 右ペイン向け: 商品名 + 単価を別行に出す。
   * 未指定時は店舗行に単価を併記(詳細ページの従来表示)。
   */
  productLine?: string;
  className?: string;
  testId?: string;
  children?: React.ReactNode;
};

/** 底値ヒーロー。ProductDetailPage / PC 右ペインで共有 */
export function ProductSaleBottomHero({
  saleBottom,
  storeName,
  baseUnit,
  eyebrow,
  productLine,
  className,
  testId,
  children,
}: Props) {
  const unitLabel =
    saleBottom.unitPrice !== null
      ? formatPricePerBase(saleBottom.unitPrice, baseUnit)
      : null;

  return (
    <section data-testid={testId} className={className}>
      <div className="text-[10.5px] font-bold text-ink-faint">{eyebrow}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-primary">
          ¥{saleBottom.record.price.toLocaleString()}
        </span>
        {saleBottom.record.isSale && <SaleBadge />}
      </div>
      <div className="mt-1 text-sm text-ink-sub">
        {storeName(saleBottom.record.storeId)}
        {!productLine && unitLabel && ` · ${unitLabel}`}
      </div>
      {productLine && (
        <div className="mt-1.5 text-[12px] font-medium text-ink">
          {productLine}
          {unitLabel && ` · ${unitLabel}`}
        </div>
      )}
      {children}
    </section>
  );
}
