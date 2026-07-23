import { Link } from 'react-router';
import { SaleBadge } from './SaleBadge';
import {
  bottomPrice,
  bottomPricesByStore,
} from '../features/prices/bottomPrice';
import { formatPriceRecordDate } from '../features/prices/formatPriceRecordDate';
import { formatPricePerBase } from '../lib/units';
import type { Category, PriceRecord, Product, WithId } from '../types/models';

const HISTORY_LIMIT = 8;

type Props = {
  productId: string | null;
  categories: WithId<Category>[];
  products: WithId<Product>[];
  /** ホームで購読済みの記録(商品切替時の再購読・古いデータ混在を避ける) */
  records: WithId<PriceRecord>[];
  windowMonths: number;
  now: Date;
  storeName: (storeId: string) => string;
};

/** PC ホーム右ペイン。閲覧と「詳細を開く」のみ(編集・削除なし) */
export function PcProductDetailPane({
  productId,
  categories,
  products,
  records,
  windowMonths,
  now,
  storeName,
}: Props) {
  const product = products.find((p) => p.id === productId);
  const category = product
    ? categories.find((c) => c.id === product.categoryId)
    : undefined;

  const productRecords = productId
    ? records.filter((r) => r.productId === productId)
    : [];

  const saleBottom =
    productId && category
      ? bottomPrice(productRecords, category.baseUnit, { windowMonths, now })
      : null;
  const byStore =
    productId && category
      ? bottomPricesByStore(productRecords, category.baseUnit, { windowMonths, now })
      : new Map();

  const history = [...productRecords]
    .sort((a, b) => b.recordedAt.toMillis() - a.recordedAt.toMillis())
    .slice(0, HISTORY_LIMIT);

  if (!productId) {
    return (
      <div
        data-testid="pc-detail-pane"
        className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-chevron bg-surface px-6 py-10"
      >
        <p className="text-center text-sm text-ink-sub">一覧から商品を選択</p>
      </div>
    );
  }

  if (!product || !category) {
    return (
      <div data-testid="pc-detail-pane" className="rounded-2xl bg-surface p-5 shadow-sm">
        <p className="text-sm text-ink-sub">商品が見つかりません。</p>
      </div>
    );
  }

  return (
    <div data-testid="pc-detail-pane" className="flex flex-col gap-4">
      <section className="rounded-2xl bg-surface p-5 shadow-sm shadow-ink/5">
        <div className="text-[10.5px] font-bold text-ink-faint">
          選択中 · {category.name}
        </div>
        {saleBottom ? (
          <>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary">
                ¥{saleBottom.record.price.toLocaleString()}
              </span>
              {saleBottom.record.isSale && <SaleBadge />}
            </div>
            <div className="mt-1 text-sm text-ink-sub">
              {storeName(saleBottom.record.storeId)}
            </div>
            <div className="mt-1.5 text-[12px] font-medium text-ink">
              {product.name}
              {saleBottom.unitPrice !== null &&
                ` · ${formatPricePerBase(saleBottom.unitPrice, category.baseUnit)}`}
            </div>
          </>
        ) : (
          <div className="mt-2 text-lg font-extrabold text-ink-faint">—</div>
        )}
        <Link
          to={`/products/${product.id}`}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-light"
        >
          詳細を開く
        </Link>
      </section>

      {byStore.size > 0 && (
        <section>
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
      )}

      <section>
        <h3 className="mb-2 text-[13px] font-extrabold">最近の履歴</h3>
        <div className="overflow-hidden rounded-2xl bg-surface shadow-sm shadow-ink/5">
          {history.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-sub">まだ記録がありません。</p>
          ) : (
            history.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="text-[12px] text-ink-sub">
                  {formatPriceRecordDate(rec)} · {storeName(rec.storeId)}
                </span>
                <span className="text-sm font-bold">
                  ¥{rec.price.toLocaleString()}
                  {rec.isSale && (
                    <span className="ml-1.5">
                      <SaleBadge />
                    </span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
