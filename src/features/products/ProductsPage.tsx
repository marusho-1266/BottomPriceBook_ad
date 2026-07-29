import { useState } from 'react';
import { SubPageHeader } from '../../components/SubPageHeader';
import { db } from '../../lib/firebase';
import type { Product, WithId } from '../../types/models';
import { useBook } from '../books/BookProvider';
import { useCategories } from '../categories/api';
import { ProductForm } from './ProductForm';
import { addProduct, updateProduct, useProducts } from './api';
import { deleteProductWithRecords } from './deleteProduct';

function categoryLabel(
  categories: { id: string; name: string }[],
  categoryId: string,
): string {
  return categories.find((c) => c.id === categoryId)?.name ?? '(未分類)';
}

function ProductRow({
  product,
  bookId,
  categoryName,
  categories,
  editing,
  onEdit,
  onCancelEdit,
}: {
  product: WithId<Product>;
  bookId: string;
  categoryName: string;
  categories: ReturnType<typeof useCategories>['data'];
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  const remove = async () => {
    const ok = window.confirm(
      `「${product.name}」を削除しますか?\n配下の価格記録も削除されます。`,
    );
    if (!ok) return;
    await deleteProductWithRecords(db, bookId, product.id);
  };

  if (editing) {
    return (
      <li className="border-b border-line px-4 py-3 last:border-b-0">
        <ProductForm
          categories={categories}
          initial={{
            name: product.name,
            categoryId: product.categoryId,
            note: product.note ?? '',
          }}
          submitLabel="保存"
          onSubmit={async (values) => {
            await updateProduct(bookId, product.id, values);
            onCancelEdit();
          }}
        />
        <button
          type="button"
          onClick={onCancelEdit}
          className="mt-2 text-sm font-bold text-ink-sub"
        >
          キャンセル
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{product.name}</div>
        <div className="mt-0.5 text-[11px] text-ink-sub">{categoryName}</div>
        {product.note ? (
          <div className="mt-0.5 truncate text-[11px] text-ink-faint">{product.note}</div>
        ) : null}
      </div>
      <button type="button" onClick={onEdit} className="text-sm font-bold text-primary-deep">
        編集
      </button>
      <button type="button" onClick={remove} className="text-sm font-bold text-sale">
        削除
      </button>
    </li>
  );
}

/** 設定配下の商品マスタ管理。登録・編集・削除(配下記録含む) */
export function ProductsPage() {
  const { bookId } = useBook();
  const { data: categories } = useCategories();
  const { data: products, loading } = useProducts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div>
      <SubPageHeader title="商品管理" />

      <div className="mx-4 rounded-2xl bg-surface p-4">
        <ProductForm
          key={formKey}
          categories={categories}
          submitLabel="登録"
          onSubmit={async (values) => {
            await addProduct(bookId, values);
            setFormKey((k) => k + 1);
          }}
        />
      </div>

      <ul className="mx-4 mt-4 rounded-2xl bg-surface">
        {loading && <li className="px-4 py-3 text-sm text-ink-faint">読み込み中…</li>}
        {!loading && products.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink-sub">
            まだ商品がありません。上のフォームから登録できます。
          </li>
        )}
        {products.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            bookId={bookId}
            categoryName={categoryLabel(categories, product.categoryId)}
            categories={categories}
            editing={editingId === product.id}
            onEdit={() => setEditingId(product.id)}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}
      </ul>
    </div>
  );
}
