import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { SubPageHeader } from '../../components/SubPageHeader';
import { db } from '../../lib/firebase';
import type { Category, Product, WithId } from '../../types/models';
import { useBook } from '../books/BookProvider';
import { useCategories } from '../categories/api';
import { ProductForm } from './ProductForm';
import { addProduct, updateProduct, useProducts } from './api';
import { deleteProductWithRecords } from './deleteProduct';

function categoryLabel(categories: WithId<Category>[], categoryId: string): string {
  return categories.find((c) => c.id === categoryId)?.name ?? '(未分類)';
}

function ProductRow({
  product,
  bookId,
  categories,
  editing,
  onEdit,
  onCancelEdit,
}: {
  product: WithId<Product>;
  bookId: string;
  categories: WithId<Category>[];
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async () => {
    const ok = window.confirm(
      `「${product.name}」を削除しますか?\n配下の価格記録も削除されます。`,
    );
    if (!ok) return;
    try {
      setDeleteError(null);
      await deleteProductWithRecords(db, bookId, product.id);
    } catch {
      setDeleteError('削除に失敗しました。もう一度お試しください');
    }
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
        <div className="mt-0.5 text-[11px] text-ink-sub">
          {categoryLabel(categories, product.categoryId)}
        </div>
        {product.note ? (
          <div className="mt-0.5 truncate text-[11px] text-ink-faint">{product.note}</div>
        ) : null}
        {deleteError && (
          <p role="alert" className="mt-1 text-[11px] font-bold text-sale">
            {deleteError}
          </p>
        )}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const editFromQuery = searchParams.get('edit');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [appliedEditQuery, setAppliedEditQuery] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  // 購読完了後に ?edit= を編集モードへ反映する。適用済みのクエリ値を覚えることで
  // 同じ値では再適用せず、値が変われば追従する(レンダー中の状態調整)
  if (!loading && editFromQuery && editFromQuery !== appliedEditQuery) {
    setAppliedEditQuery(editFromQuery);
    if (products.some((p) => p.id === editFromQuery)) {
      setEditingId(editFromQuery);
    }
  }

  // 編集を閉じたら ?edit= も落とす(再読込で編集モードが復活しないように)
  const closeEditor = () => {
    setEditingId(null);
    if (editFromQuery) setSearchParams({}, { replace: true });
  };

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
            categories={categories}
            editing={editingId === product.id}
            onEdit={() => setEditingId(product.id)}
            onCancelEdit={closeEditor}
          />
        ))}
      </ul>
    </div>
  );
}
