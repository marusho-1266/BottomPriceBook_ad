import { useMemo, useState } from 'react';
import { ChevronRight, Delete } from 'lucide-react';
import { PickerSheet } from '../components/PickerSheet';
import { useBook } from '../features/books/BookProvider';
import { DEFAULT_BOTTOM_WINDOW_MONTHS } from '../features/books/api';
import { useCategories } from '../features/categories/api';
import { addPriceRecord, usePriceRecords } from '../features/prices/api';
import { rankDraftInCategory } from '../features/prices/bottomPrice';
import { ProductForm } from '../features/products/ProductForm';
import { addProduct, useProducts } from '../features/products/api';
import { addStore, useStores } from '../features/stores/api';
import { allowedUnits, formatPricePerBase } from '../lib/units';
import type { BaseUnit } from '../types/models';

type ActiveField = 'price' | 'quantity';

function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function Keypad({
  onDigit,
  onBackspace,
  decimalAllowed,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  decimalAllowed: boolean;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onDigit(key)}
          className="h-13 rounded-2xl bg-surface text-2xl font-bold shadow-sm active:bg-line"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onDigit(decimalAllowed ? '.' : '00')}
        className="h-13 rounded-2xl bg-line-strong text-lg font-bold text-ink-sub active:bg-chevron"
      >
        {decimalAllowed ? '.' : '00'}
      </button>
      <button
        type="button"
        onClick={() => onDigit('0')}
        className="h-13 rounded-2xl bg-surface text-2xl font-bold shadow-sm active:bg-line"
      >
        0
      </button>
      <button
        type="button"
        aria-label="1文字削除"
        onClick={onBackspace}
        className="flex h-13 items-center justify-center rounded-2xl bg-line-strong text-ink-sub active:bg-chevron"
      >
        <Delete className="size-6" />
      </button>
    </div>
  );
}

export function RecordPage() {
  const { bookId, book } = useBook();
  const { data: products } = useProducts();
  const { data: stores } = useStores();
  const { data: categories } = useCategories();
  const windowMonths = book?.bottomWindowMonths ?? DEFAULT_BOTTOM_WINDOW_MONTHS;
  const now = useMemo(() => new Date(), []);
  const { data: records } = usePriceRecords({ windowMonths, now });

  const [productId, setProductId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState('');
  const [quantityText, setQuantityText] = useState('');
  const [unit, setUnit] = useState<string>('');
  const [isSale, setIsSale] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [activeField, setActiveField] = useState<ActiveField>('price');
  const [picker, setPicker] = useState<'product' | 'store' | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const product = products.find((p) => p.id === productId) ?? null;
  const store = stores.find((s) => s.id === storeId) ?? null;
  const category = product ? (categories.find((c) => c.id === product.categoryId) ?? null) : null;
  const baseUnit: BaseUnit | null = category?.baseUnit ?? null;
  const units = useMemo(() => (baseUnit ? allowedUnits(baseUnit) : []), [baseUnit]);
  const effectiveUnit = units.includes(unit) ? unit : (units[0] ?? '');

  const draftRank = useMemo(() => {
    if (!product || !baseUnit || !storeId) return null;
    return rankDraftInCategory(
      products.filter((p) => p.categoryId === product.categoryId),
      records,
      product.id,
      storeId,
      { price: Number(priceText), quantity: Number(quantityText), unit: effectiveUnit },
      baseUnit,
      { windowMonths, now },
    );
  }, [
    product,
    baseUnit,
    storeId,
    products,
    records,
    priceText,
    quantityText,
    effectiveUnit,
    windowMonths,
    now,
  ]);

  const draftRankReferenceLabel = useMemo(() => {
    const ref = draftRank?.reference;
    if (!ref || !baseUnit) return null;
    const productName = products.find((p) => p.id === ref.productId)?.name ?? '不明';
    const storeName = stores.find((s) => s.id === ref.storeId)?.name ?? '不明';
    return `${ref.displayRank}位: ${productName} / ${storeName} / ${formatPricePerBase(ref.unitPrice, baseUnit)}`;
  }, [draftRank, baseUnit, products, stores]);

  const handleDigit = (digit: string) => {
    setSaved(false);
    const apply = (current: string): string => {
      if (digit === '.' && (current.includes('.') || current === '')) return current;
      const next = current + digit;
      if (next.replace('.', '').length > 7) return current;
      // 先頭 0 の連続を防ぐ(0 → 05 ではなく 5 に)
      return next.replace(/^0+(?=\d)/, '');
    };
    if (activeField === 'price') setPriceText(apply);
    else setQuantityText(apply);
  };

  const handleBackspace = () => {
    setSaved(false);
    if (activeField === 'price') setPriceText((t) => t.slice(0, -1));
    else setQuantityText((t) => t.slice(0, -1));
  };

  const selectProduct = (id: string) => {
    setProductId(id);
    const selected = products.find((p) => p.id === id);
    const selectedCategory = categories.find((c) => c.id === selected?.categoryId);
    setUnit(selectedCategory ? allowedUnits(selectedCategory.baseUnit)[0] : '');
    setPicker(null);
    setAddingProduct(false);
  };

  const handleSave = async () => {
    const price = Number(priceText);
    const quantity = Number(quantityText);
    if (!productId) {
      setError('商品を選択してください');
      return;
    }
    if (!storeId) {
      setError('店舗を選択してください');
      return;
    }
    if (!priceText || !Number.isFinite(price) || price <= 0) {
      setError('価格を入力してください');
      return;
    }
    if (!quantityText || !Number.isFinite(quantity) || quantity <= 0) {
      setError('内容量を入力してください');
      return;
    }
    setError(null);
    await addPriceRecord(bookId, {
      productId,
      storeId,
      price,
      quantity,
      unit: effectiveUnit,
      isSale,
      recordedAt: new Date(`${date}T12:00:00`),
    });
    setPriceText('');
    setQuantityText('');
    setIsSale(false);
    setActiveField('price');
    setSaved(true);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full flex-col md:max-w-lg">
      <div className="px-5 pt-14 md:pt-6">
        <h2 className="text-lg font-extrabold">価格を記録</h2>

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPicker('product')}
            className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 py-3 text-left"
          >
            <span className="min-w-8 text-[11px] font-bold text-ink-faint">商品</span>
            <span className="flex-1 truncate text-sm font-bold">
              {product ? product.name : '選択してください'}
            </span>
            <ChevronRight className="size-4 text-chevron" />
          </button>
          <button
            type="button"
            onClick={() => setPicker('store')}
            className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-line-strong bg-surface px-3.5 py-3 text-left"
          >
            <span className="min-w-8 text-[11px] font-bold text-ink-faint">店舗</span>
            <span className="flex-1 truncate text-sm font-bold">
              {store ? store.name : '選択してください'}
            </span>
            <ChevronRight className="size-4 text-chevron" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveField('price')}
          className="mt-4 block w-full text-center"
        >
          <span className="block text-[11px] font-bold text-ink-faint">価格(税込)</span>
          <span className="block text-5xl leading-tight font-extrabold">
            ¥{priceText === '' ? '0' : priceText}
          </span>
          <span
            className={`mx-auto mt-1 block h-[3px] w-44 rounded-full ${
              activeField === 'price' ? 'bg-primary' : 'bg-transparent'
            }`}
          />
        </button>

        <div className="mt-3 flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setActiveField('quantity')}
            className={`flex-[1.4] rounded-2xl border-[1.5px] bg-surface px-3 py-2 text-left ${
              activeField === 'quantity' ? 'border-primary' : 'border-line-strong'
            }`}
          >
            <span className="block text-[10px] font-bold text-ink-faint">内容量</span>
            <span className="text-lg font-extrabold">
              {quantityText === '' ? '0' : quantityText}
            </span>
          </button>
          <select
            aria-label="単位"
            value={effectiveUnit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={units.length === 0}
            className="rounded-2xl border-[1.5px] border-line-strong bg-surface px-2 text-sm font-bold text-primary-deep disabled:opacity-45"
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <label
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-[1.5px] px-2 ${
              isSale ? 'border-sale bg-sale-bg' : 'border-line-strong bg-surface'
            }`}
          >
            <input
              type="checkbox"
              checked={isSale}
              onChange={(e) => setIsSale(e.target.checked)}
              className="accent-sale"
            />
            <span className={`text-xs font-extrabold ${isSale ? 'text-sale' : 'text-ink-faint'}`}>
              特売
            </span>
          </label>
          <input
            type="date"
            aria-label="日付"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-2xl border-[1.5px] border-line-strong bg-surface px-2 text-xs font-bold"
          />
        </div>
        <p className="mt-1.5 text-[10.5px] text-ink-faint">
          内容量は総量を入力(例: 5箱×160組 → 800組)
        </p>

        {draftRank?.kind === 'ranked' && (
          <div className="mt-2 space-y-0.5">
            <p className="text-xs font-bold text-primary-deep">
              このカテゴリで暫定 {draftRank.rank} 位 / {draftRank.total} 件中
            </p>
            {draftRankReferenceLabel && (
              <p className="text-[11px] font-bold text-ink-faint">{draftRankReferenceLabel}</p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-2 text-xs font-bold text-sale">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="mt-2 text-xs font-bold text-primary-deep">
            記録しました
          </p>
        )}
      </div>

      <div className="mt-auto border-t border-line-strong bg-surface-alt px-4 pt-2.5 pb-4">
        <Keypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          decimalAllowed={activeField === 'quantity'}
        />
        <button
          type="button"
          onClick={handleSave}
          className="mt-2.5 h-13 w-full rounded-2xl bg-primary text-base font-extrabold text-white shadow-lg shadow-primary/35 active:bg-primary-deep"
        >
          記録する
        </button>
      </div>

      {picker === 'product' && (
        <PickerSheet title="商品を選択" onClose={() => setPicker(null)}>
          {addingProduct ? (
            <ProductForm
              categories={categories}
              submitLabel="登録して選択"
              onSubmit={async (values) => {
                const id = await addProduct(bookId, values);
                selectProduct(id);
              }}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAddingProduct(true)}
                className="mb-3 h-10 w-full rounded-xl border border-dashed border-primary text-sm font-bold text-primary-deep"
              >
                + 新しい商品を登録
              </button>
              <ul className="rounded-2xl bg-surface">
                {products.map((p) => (
                  <li key={p.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => selectProduct(p.id)}
                      className="w-full px-4 py-3 text-left text-sm font-bold"
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </PickerSheet>
      )}

      {picker === 'store' && (
        <PickerSheet title="店舗を選択" onClose={() => setPicker(null)}>
          <form
            className="mb-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = newStoreName.trim();
              if (!name) return;
              await addStore(bookId, name);
              setNewStoreName('');
            }}
          >
            <input
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="新しい店舗名"
              aria-label="新しい店舗名"
              className="h-10 min-w-0 flex-1 rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white"
            >
              追加
            </button>
          </form>
          <ul className="rounded-2xl bg-surface">
            {stores.map((s) => (
              <li key={s.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setStoreId(s.id);
                    setPicker(null);
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-bold"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </PickerSheet>
      )}
    </div>
  );
}
