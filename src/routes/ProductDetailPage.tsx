import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { SaleBadge } from '../components/SaleBadge';
import { SubPageHeader } from '../components/SubPageHeader';
import { useBook } from '../features/books/BookProvider';
import { DEFAULT_BOTTOM_WINDOW_MONTHS } from '../features/books/api';
import { useCategories } from '../features/categories/api';
import {
  deletePriceRecord,
  updatePriceRecord,
  usePriceRecords,
} from '../features/prices/api';
import {
  bottomPrice,
  bottomPricesByStore,
} from '../features/prices/bottomPrice';
import { useProducts } from '../features/products/api';
import { useStores } from '../features/stores/api';
import { formatPricePerBase } from '../lib/units';
import type { PriceRecord, WithId } from '../types/models';

function formatDate(record: WithId<PriceRecord>): string {
  const d = record.recordedAt.toDate();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { bookId, book } = useBook();
  const { data: categories } = useCategories();
  const { data: products } = useProducts();
  const { data: stores } = useStores();
  const { data: records } = usePriceRecords();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const product = products.find((p) => p.id === productId);
  const category = product
    ? categories.find((c) => c.id === product.categoryId)
    : undefined;
  const productRecords = records.filter((r) => r.productId === productId);

  const windowMonths = book?.bottomWindowMonths ?? DEFAULT_BOTTOM_WINDOW_MONTHS;
  const now = useMemo(() => new Date(), []);

  const storeName = (storeId: string) =>
    stores.find((s) => s.id === storeId)?.name ?? '(不明な店舗)';

  const saleBottom = category
    ? bottomPrice(productRecords, category.baseUnit, { windowMonths, now })
    : null;
  const regularBottom = category
    ? bottomPrice(productRecords, category.baseUnit, {
        windowMonths,
        now,
        excludeSale: true,
      })
    : null;
  const byStore = category
    ? bottomPricesByStore(productRecords, category.baseUnit, { windowMonths, now })
    : new Map();

  const history = [...productRecords].sort(
    (a, b) => b.recordedAt.toMillis() - a.recordedAt.toMillis(),
  );

  async function handleDelete(recordId: string) {
    if (!window.confirm('この記録を削除しますか?')) return;
    await deletePriceRecord(bookId, recordId);
  }

  async function handleSaveEdit(recordId: string) {
    const price = Number(editPrice);
    if (!Number.isFinite(price) || price <= 0) return;
    await updatePriceRecord(bookId, recordId, { price });
    setEditingId(null);
  }

  if (!product || !category) {
    return (
      <div>
        <SubPageHeader title="商品詳細" backTo="/" />
        <p className="px-5 text-sm text-ink-sub">商品が見つかりません。</p>
      </div>
    );
  }

  return (
    <div>
      <SubPageHeader title={product.name} backTo="/" />

      {saleBottom && (
        <section data-testid="bottom-hero" className="mx-4 rounded-2xl bg-surface p-5 shadow-sm">
          <div className="text-[10.5px] font-bold text-ink-faint">底値(特売込み)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-primary">
              ¥{saleBottom.record.price.toLocaleString()}
            </span>
            {saleBottom.record.isSale && <SaleBadge />}
          </div>
          <div className="mt-1 text-sm text-ink-sub">
            {storeName(saleBottom.record.storeId)}
            {saleBottom.unitPrice !== null &&
              ` · ${formatPricePerBase(saleBottom.unitPrice, category.baseUnit)}`}
          </div>
        </section>
      )}

      <section data-testid="regular-bottom" className="mx-4 mt-3 rounded-2xl bg-surface px-5 py-3">
        <div className="text-[10.5px] font-bold text-ink-faint">通常のみの底値</div>
        {regularBottom ? (
          <div className="mt-1 text-lg font-extrabold">
            ¥{regularBottom.record.price.toLocaleString()}
            <span className="ml-2 text-sm font-medium text-ink-sub">
              {storeName(regularBottom.record.storeId)}
            </span>
          </div>
        ) : (
          <div className="mt-1 text-lg font-extrabold text-ink-faint">—</div>
        )}
      </section>

      {byStore.size > 0 && (
        <section data-testid="by-store" className="mx-4 mt-4">
          <h3 className="mb-2 text-[13px] font-extrabold">店舗別底値</h3>
          <div className="overflow-hidden rounded-2xl bg-surface">
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

      <section data-testid="history" className="mx-4 mt-4 mb-6">
        <h3 className="mb-2 text-[13px] font-extrabold">記録履歴</h3>
        <div className="overflow-hidden rounded-2xl bg-surface">
          {history.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-sub">まだ記録がありません。</p>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    ¥{record.price.toLocaleString()}
                    {record.isSale && (
                      <span className="ml-1.5">
                        <SaleBadge />
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-sub">
                    {storeName(record.storeId)} · {record.quantity}
                    {record.unit} · {formatDate(record)}
                  </div>
                </div>
                {editingId === record.id ? (
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`price-${record.id}`}>
                      価格(税込)
                    </label>
                    <input
                      id={`price-${record.id}`}
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="h-9 w-20 rounded-lg border border-line bg-cream px-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(record.id)}
                      className="text-xs font-bold text-primary"
                    >
                      保存
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="記録を編集"
                      onClick={() => {
                        setEditingId(record.id);
                        setEditPrice(String(record.price));
                      }}
                      className="p-2 text-ink-faint"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="記録を削除"
                      onClick={() => handleDelete(record.id)}
                      className="p-2 text-sale"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <Link
          to="/record"
          className="mt-4 block text-center text-sm font-bold text-primary-deep"
        >
          この商品の価格を記録する
        </Link>
      </section>
    </div>
  );
}
