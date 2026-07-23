import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { PcProductDetailPane } from './PcProductDetailPane';
import { SaleBadge } from './SaleBadge';
import { useBook } from '../features/books/BookProvider';
import { BookSwitcher } from '../features/sharing/BookSwitcher';
import type { BottomResult } from '../features/prices/bottomPrice';
import type { HomeSummary } from '../features/prices/homeSummary';
import { formatPricePerBase } from '../lib/units';
import type { Category, PriceRecord, Product, WithId } from '../types/models';

type Props = {
  categories: WithId<Category>[];
  products: WithId<Product>[];
  records: WithId<PriceRecord>[];
  storeName: (storeId: string) => string;
  bottoms: Map<string, BottomResult<WithId<PriceRecord>>>;
  summary: HomeSummary;
  windowMonths: number;
  now: Date;
};

export function PcHomeDashboard(props: Props) {
  const { bookId } = useBook();
  // book 切替で検索・選択を破棄(Effect 内 setState を避け key で再マウント)
  return <PcHomeDashboardInner key={bookId} {...props} />;
}

function PcHomeDashboardInner({
  categories,
  products,
  records,
  storeName,
  bottoms,
  summary,
  windowMonths,
  now,
}: Props) {
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const visibleProducts = (categoryId: string): WithId<Product>[] =>
    products.filter(
      (p) =>
        p.categoryId === categoryId &&
        bottoms.has(p.id) &&
        (search === '' || p.name.includes(search)),
    );

  const hasAnyRecord = bottoms.size > 0;

  return (
    <div data-testid="pc-home-dashboard" className="px-6 py-5">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1">
            <BookSwitcher tone="onSurface" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink">ホーム</h1>
          <p className="mt-1 text-sm text-ink-sub">底値の全体像をひと目で</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-56 items-center gap-2 rounded-xl border border-chevron bg-surface px-3 text-ink-faint">
            <Search className="size-4 shrink-0" strokeWidth={2} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="商品名で検索"
              className="w-full min-w-0 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
              aria-label="商品名で検索"
            />
          </label>
          <Link
            to="/record"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-light"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            価格を記録
          </Link>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <SummaryCard label="登録商品" value={summary.productCount} unit="品" />
        <SummaryCard label="今週の記録" value={summary.weekRecordCount} unit="件" />
        <SummaryCard label="底値更新" value={summary.bottomUpdatedCount} unit="件" accent />
      </div>

      {!hasAnyRecord ? (
        <p className="mt-10 text-center text-sm text-ink-sub">
          まだ記録がありません。
          <br />
          <Link to="/record" className="font-bold text-primary-deep underline-offset-2 hover:underline">
            「価格を記録」から始めましょう
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <div className="min-w-0 space-y-4">
            <h2 className="text-[13px] font-extrabold text-ink">カテゴリ別・底値一覧</h2>
            {categories.map((category) => {
              const categoryProducts = visibleProducts(category.id);
              if (categoryProducts.length === 0) return null;
              return (
                <section key={category.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-[13px] font-extrabold">{category.name}</h3>
                    <span className="text-[10.5px] font-medium text-ink-faint">
                      1{category.baseUnit}あたりで比較
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-surface shadow-sm shadow-ink/5">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line bg-surface-alt text-[11px] font-bold text-ink-faint">
                        <tr>
                          <th className="px-4 py-2.5 font-bold">商品</th>
                          <th className="px-3 py-2.5 font-bold">底値</th>
                          <th className="hidden px-3 py-2.5 font-bold sm:table-cell">店舗</th>
                          <th className="hidden px-4 py-2.5 font-bold md:table-cell">単価</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryProducts.map((product) => {
                          const best = bottoms.get(product.id)!;
                          const selected = selectedProductId === product.id;
                          return (
                            <tr
                              key={product.id}
                              tabIndex={0}
                              aria-selected={selected}
                              onClick={() => setSelectedProductId(product.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedProductId(product.id);
                                }
                              }}
                              className={`cursor-pointer border-b border-line last:border-b-0 ${
                                selected ? 'bg-primary/10' : 'hover:bg-cream/80'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="truncate font-bold">{product.name}</div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="font-extrabold text-primary">
                                  ¥{best.record.price.toLocaleString()}
                                </span>
                                {best.record.isSale && (
                                  <span className="ml-1.5 inline-block align-middle">
                                    <SaleBadge />
                                  </span>
                                )}
                              </td>
                              <td className="hidden px-3 py-3 text-ink-sub sm:table-cell">
                                {storeName(best.record.storeId)}
                              </td>
                              <td className="hidden px-4 py-3 text-ink-sub md:table-cell">
                                {formatPricePerBase(best.unitPrice, category.baseUnit)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="min-w-0 xl:sticky xl:top-5 xl:self-start">
            <PcProductDetailPane
              productId={selectedProductId}
              categories={categories}
              products={products}
              records={records}
              windowMonths={windowMonths}
              now={now}
              storeName={storeName}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-sm shadow-ink/5">
      <div className="text-[11px] font-bold text-ink-faint">{label}</div>
      <div
        className={`mt-1 text-2xl font-extrabold ${accent ? 'text-primary-deep' : 'text-ink'}`}
      >
        {value}
        <span className="ml-1 text-xs font-bold text-ink-sub">{unit}</span>
      </div>
    </div>
  );
}
