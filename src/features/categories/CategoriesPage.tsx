import { useState, type FormEvent } from 'react';
import { SubPageHeader } from '../../components/SubPageHeader';
import { useBook } from '../books/BookProvider';
import { useProducts } from '../products/api';
import { addCategory, deleteCategory, updateCategory, useCategories } from './api';
import type { BaseUnit, Category, WithId } from '../../types/models';

const BASE_UNITS: BaseUnit[] = ['g', 'ml', '個', '枚', '組', '回分'];

function confirmBaseUnitChange(
  categoryName: string,
  from: BaseUnit,
  to: BaseUnit,
  productCount: number,
): boolean {
  return window.confirm(
    `「${categoryName}」の基準単位を ${from} から ${to} に変更します。\n` +
      `所属する商品 ${productCount} 件の価格記録について、数量を旧基準単位に揃えたうえで単位名を付け替えます` +
      `（物理的な換算ではありません。単価比較の意味が変わる可能性があります）。\n` +
      `変更しない場合はキャンセルしてください。`,
  );
}

function CategoryRow({
  category,
  bookId,
  referenceCount,
  productIds,
}: {
  category: WithId<Category>;
  bookId: string;
  /** このカテゴリを参照している商品数。0 より大きい場合は削除禁止(H-2) */
  referenceCount: number;
  productIds: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(category.baseUnit);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('カテゴリ名を入力してください');
      return;
    }
    setError(null);

    const baseUnitChanged = baseUnit !== category.baseUnit;
    if (baseUnitChanged && referenceCount > 0) {
      const ok = confirmBaseUnitChange(category.name, category.baseUnit, baseUnit, referenceCount);
      if (!ok) return;
    }

    const nameChanged = trimmed !== category.name;
    if (!nameChanged && !baseUnitChanged) {
      setEditing(false);
      return;
    }

    try {
      await updateCategory(
        bookId,
        category.id,
        { name: trimmed, baseUnit },
        { previousBaseUnit: category.baseUnit, productIds },
      );
      setEditing(false);
    } catch {
      setError('保存に失敗しました。もう一度お試しください');
    }
  };

  const remove = async () => {
    if (referenceCount > 0) {
      setBlocked(true);
      return;
    }
    if (window.confirm(`「${category.name}」を削除しますか?`)) {
      await deleteCategory(bookId, category.id);
    }
  };

  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      {editing ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="カテゴリ名を編集"
              className="h-10 min-w-0 flex-1 rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            <select
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value as BaseUnit)}
              aria-label="基準単位を編集"
              className="h-10 rounded-xl border border-chevron bg-surface px-2 text-sm outline-none focus:border-primary"
            >
              {BASE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <button type="button" onClick={save} className="text-sm font-bold text-primary-deep">
              保存
            </button>
          </div>
          {error && (
            <p role="alert" className="text-[11px] font-bold text-sale">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{category.name}</div>
            <div className="text-[11px] text-ink-sub">基準単位: {category.baseUnit}</div>
            {blocked && (
              <p role="alert" className="mt-1 text-[11px] font-bold text-sale">
                {referenceCount}件の商品が使用中のため削除できません
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setName(category.name);
              setBaseUnit(category.baseUnit);
              setError(null);
              setEditing(true);
            }}
            className="text-sm font-bold text-primary-deep"
          >
            編集
          </button>
          <button type="button" onClick={remove} className="text-sm font-bold text-sale">
            削除
          </button>
        </>
      )}
    </li>
  );
}

export function CategoriesPage() {
  const { bookId } = useBook();
  const { data: categories, loading } = useCategories();
  const { data: products } = useProducts();
  const [name, setName] = useState('');
  const [baseUnit, setBaseUnit] = useState<BaseUnit>('g');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('カテゴリ名を入力してください');
      return;
    }
    setError(null);
    await addCategory(bookId, { name: trimmed, baseUnit });
    setName('');
  };

  return (
    <div>
      <SubPageHeader title="カテゴリ管理" />
      <form onSubmit={handleAdd} className="mx-4 flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="category-name" className="mb-1 block text-xs font-bold text-ink-sub">
              カテゴリ名
            </label>
            <input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="category-unit" className="mb-1 block text-xs font-bold text-ink-sub">
              基準単位
            </label>
            <select
              id="category-unit"
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value as BaseUnit)}
              className="h-10 rounded-xl border border-chevron bg-surface px-2 text-sm outline-none focus:border-primary"
            >
              {BASE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-xs font-bold text-sale">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="h-10 rounded-xl bg-primary text-sm font-extrabold text-white active:bg-primary-deep"
        >
          追加
        </button>
        <p className="text-[11px] text-ink-faint">
          基準単位はあとから変更できます。変更時は所属商品の価格記録の単位も付け替えます
        </p>
      </form>

      <ul className="mx-4 mt-4 rounded-2xl bg-surface">
        {loading && <li className="px-4 py-3 text-sm text-ink-faint">読み込み中…</li>}
        {categories.map((category) => {
          const categoryProducts = products.filter((p) => p.categoryId === category.id);
          return (
            <CategoryRow
              key={category.id}
              category={category}
              bookId={bookId}
              referenceCount={categoryProducts.length}
              productIds={categoryProducts.map((p) => p.id)}
            />
          );
        })}
      </ul>
    </div>
  );
}
