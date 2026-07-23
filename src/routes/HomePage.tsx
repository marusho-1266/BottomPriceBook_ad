import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Search, X } from 'lucide-react';
import { PcHomeDashboard } from '../components/PcHomeDashboard';
import { SaleBadge } from '../components/SaleBadge';
import { useDesktopLayout } from '../components/useDesktopLayout';
import { useBook } from '../features/books/BookProvider';
import { BookSwitcher } from '../features/sharing/BookSwitcher';
import { useCategories } from '../features/categories/api';
import { bottomPrice, type BottomResult } from '../features/prices/bottomPrice';
import { computeHomeSummary } from '../features/prices/homeSummary';
import { usePriceRecords } from '../features/prices/api';
import { useProducts } from '../features/products/api';
import { useStores } from '../features/stores/api';
import { DEFAULT_BOTTOM_WINDOW_MONTHS } from '../features/books/api';
import { formatPricePerBase } from '../lib/units';
import type { PriceRecord, Product, WithId } from '../types/models';

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-2xl bg-white/16 px-3.5 py-3">
      <div className="text-[10.5px] font-bold text-white/75">{label}</div>
      <div className={`text-[22px] font-extrabold ${accent ? 'text-[#FFE3C4]' : 'text-white'}`}>
        {value}
        <span className="text-xs font-bold"> {label === '登録商品' ? '品' : '件'}</span>
      </div>
    </div>
  );
}

export function HomePage() {
  const isDesktop = useDesktopLayout();
  const { book } = useBook();
  const { data: categories } = useCategories();
  const { data: products } = useProducts();
  const { data: stores } = useStores();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const windowMonths = book?.bottomWindowMonths ?? DEFAULT_BOTTOM_WINDOW_MONTHS;
  const now = useMemo(() => new Date(), []);
  const { data: records } = usePriceRecords({ windowMonths, now });

  const storeName = (storeId: string) =>
    stores.find((s) => s.id === storeId)?.name ?? '(不明な店舗)';

  const bottoms = useMemo(() => {
    const map = new Map<string, BottomResult<WithId<PriceRecord>>>();
    for (const product of products) {
      const category = categories.find((c) => c.id === product.categoryId);
      if (!category) continue;
      const best = bottomPrice(
        records.filter((r) => r.productId === product.id),
        category.baseUnit,
        { windowMonths, now },
      );
      if (best) map.set(product.id, best);
    }
    return map;
  }, [products, categories, records, windowMonths, now]);

  const summary = computeHomeSummary(products.length, records, bottoms, now);

  if (isDesktop) {
    return (
      <PcHomeDashboard
        categories={categories}
        products={products}
        records={records}
        storeName={storeName}
        bottoms={bottoms}
        summary={summary}
        windowMonths={windowMonths}
        now={now}
      />
    );
  }

  const visibleProducts = (categoryId: string): WithId<Product>[] =>
    products.filter(
      (p) =>
        p.categoryId === categoryId &&
        bottoms.has(p.id) &&
        (search === '' || p.name.includes(search)),
    );

  const hasAnyRecord = bottoms.size > 0;

  return (
    <div>
      <header className="rounded-b-[28px] bg-primary px-5 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <BookSwitcher />
          <button
            type="button"
            aria-label={searchOpen ? '検索を閉じる' : '検索'}
            onClick={() => {
              setSearchOpen((open) => !open);
              setSearch('');
            }}
            className="p-1 text-white/90"
          >
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </button>
        </div>
        {searchOpen ? (
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="商品名で検索"
            className="mt-3.5 h-11 w-full rounded-2xl border-none bg-white/90 px-4 text-sm outline-none"
          />
        ) : (
          <div className="mt-3.5 flex gap-2.5">
            <StatCard label="登録商品" value={summary.productCount} />
            <StatCard label="今週の記録" value={summary.weekRecordCount} />
            <StatCard label="底値更新" value={summary.bottomUpdatedCount} accent />
          </div>
        )}
      </header>

      <main className="px-5 pt-4">
        {!hasAnyRecord && (
          <p className="mt-6 text-center text-sm text-ink-sub">
            まだ記録がありません。
            <br />
            下の「記録」ボタンから始めましょう。
          </p>
        )}

        {categories.map((category) => {
          const categoryProducts = visibleProducts(category.id);
          if (categoryProducts.length === 0) return null;
          return (
            <section key={category.id} className="mb-4.5">
              <div className="mb-2.5 flex items-center gap-2">
                <h2 className="text-[13px] font-extrabold">{category.name}</h2>
                <span className="text-[10.5px] font-medium text-ink-faint">
                  1{category.baseUnit}あたりで比較
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl bg-surface shadow-sm shadow-ink/5">
                {categoryProducts.map((product) => {
                  const best = bottoms.get(product.id)!;
                  return (
                    <Link
                      key={product.id}
                      to={`/products/${product.id}`}
                      className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0"
                    >
                      <div className="min-w-[74px] flex-none text-center">
                        <div className="text-xl font-extrabold text-primary">
                          ¥{best.record.price.toLocaleString()}
                        </div>
                        {best.record.isSale && <SaleBadge />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{product.name}</div>
                        <div className="mt-0.5 text-[11px] text-ink-sub">
                          {storeName(best.record.storeId)} ·{' '}
                          {formatPricePerBase(best.unitPrice, category.baseUnit)}
                        </div>
                      </div>
                      <ChevronRight className="size-4 flex-none text-chevron" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
