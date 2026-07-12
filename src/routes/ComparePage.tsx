import { useMemo, useState } from 'react';
import { useBook } from '../features/books/BookProvider';
import { DEFAULT_BOTTOM_WINDOW_MONTHS } from '../features/books/api';
import { useCategories } from '../features/categories/api';
import { usePriceRecords } from '../features/prices/api';
import { rankByUnitPrice } from '../features/prices/bottomPrice';
import { useProducts } from '../features/products/api';
import { formatPricePerBase } from '../lib/units';

export function ComparePage() {
  const { book } = useBook();
  const { data: categories } = useCategories();
  const { data: products } = useProducts();
  const { data: records } = usePriceRecords();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');

  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const windowMonths = book?.bottomWindowMonths ?? DEFAULT_BOTTOM_WINDOW_MONTHS;
  const now = useMemo(() => new Date(), []);

  const ranked = useMemo(() => {
    if (!category) return [];
    return rankByUnitPrice(
      products.filter((p) => p.categoryId === category.id),
      records,
      category.baseUnit,
      { windowMonths, now },
    );
  }, [products, records, category, windowMonths, now]);

  const maxUnitPrice = ranked.reduce(
    (max, row) => Math.max(max, row.best.unitPrice ?? 0),
    0,
  );

  if (!category) {
    return (
      <div className="p-5 pt-16">
        <h2 className="text-lg font-extrabold">カテゴリ内比較</h2>
        <p className="mt-2 text-sm text-ink-sub">カテゴリがありません。</p>
      </div>
    );
  }

  return (
    <div>
      <header className="px-4 pt-14 pb-3">
        <h2 className="text-lg font-extrabold">カテゴリ内比較</h2>
        <p className="mt-1 text-xs text-ink-sub">
          1{category.baseUnit}あたりで比較
        </p>
      </header>

      <div className="mx-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
              c.id === category.id
                ? 'bg-primary text-white'
                : 'bg-surface text-ink-sub'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ul data-testid="ranking" className="mx-4 mt-4 space-y-3 pb-6">
        {ranked.length === 0 ? (
          <li className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-ink-sub">
            このカテゴリに記録がありません。
          </li>
        ) : (
          ranked.map((row, index) => {
            const unitPrice = row.best.unitPrice ?? 0;
            const barWidth =
              maxUnitPrice > 0 ? Math.max(8, (unitPrice / maxUnitPrice) * 100) : 0;
            return (
              <li
                key={row.product.id}
                className="rounded-2xl bg-surface px-4 py-3.5 shadow-sm shadow-ink/5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-primary">
                      {index + 1}位
                    </span>
                    <div className="truncate text-sm font-bold">{row.product.name}</div>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-primary">
                    {formatPricePerBase(row.best.unitPrice, category.baseUnit)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={unitPrice}
                  aria-valuemin={0}
                  aria-valuemax={maxUnitPrice}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-cream"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-ink-sub">
                  底値 ¥{row.best.record.price.toLocaleString()}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
