import { useState, type FormEvent } from 'react';
import { SubPageHeader } from '../../components/SubPageHeader';
import { useBook } from '../books/BookProvider';
import { addCategory, renameCategory, useCategories } from './api';
import type { BaseUnit, Category, WithId } from '../../types/models';

const BASE_UNITS: BaseUnit[] = ['g', 'ml', '個', '枚', '組', '回分'];

function CategoryRow({ category, bookId }: { category: WithId<Category>; bookId: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== category.name) {
      await renameCategory(bookId, category.id, trimmed);
    }
    setEditing(false);
  };

  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      {editing ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="カテゴリ名を編集"
            className="h-10 min-w-0 flex-1 rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
          />
          <button type="button" onClick={save} className="text-sm font-bold text-primary-deep">
            保存
          </button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{category.name}</div>
            <div className="text-[11px] text-ink-sub">基準単位: {category.baseUnit}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setName(category.name);
              setEditing(true);
            }}
            className="text-sm font-bold text-primary-deep"
          >
            編集
          </button>
        </>
      )}
    </li>
  );
}

export function CategoriesPage() {
  const { bookId } = useBook();
  const { data: categories, loading } = useCategories();
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
          基準単位はあとから変更できません(単価比較の基準になります)
        </p>
      </form>

      <ul className="mx-4 mt-4 rounded-2xl bg-surface">
        {loading && <li className="px-4 py-3 text-sm text-ink-faint">読み込み中…</li>}
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} bookId={bookId} />
        ))}
      </ul>
    </div>
  );
}
