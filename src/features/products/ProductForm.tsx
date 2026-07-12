import { useState, type FormEvent } from 'react';
import type { Category, WithId } from '../../types/models';

interface ProductFormValues {
  name: string;
  categoryId: string;
}

interface ProductFormProps {
  categories: WithId<Category>[];
  /** 編集時は現在値を渡す。カテゴリは同じ基準単位のものにのみ変更可(M-1) */
  initial?: ProductFormValues;
  onSubmit: (values: ProductFormValues) => Promise<void> | void;
  submitLabel: string;
}

export function ProductForm({ categories, initial, onSubmit, submitLabel }: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const initialBaseUnit = initial
    ? categories.find((c) => c.id === initial.categoryId)?.baseUnit
    : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('商品名を入力してください');
      return;
    }
    if (!categoryId) {
      setError('カテゴリを選択してください');
      return;
    }
    setError(null);
    await onSubmit({ name: trimmed, categoryId });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="product-name" className="mb-1 block text-xs font-bold text-ink-sub">
          商品名
        </label>
        <input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: キュキュット 本体 240ml"
          className="h-11 w-full rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="product-category" className="mb-1 block text-xs font-bold text-ink-sub">
          カテゴリ
        </label>
        <select
          id="product-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-11 w-full rounded-xl border border-chevron bg-surface px-2 text-sm outline-none focus:border-primary"
        >
          {categories.map((category) => {
            const disabled =
              initialBaseUnit !== undefined && category.baseUnit !== initialBaseUnit;
            return (
              <option key={category.id} value={category.id} disabled={disabled}>
                {category.name}({category.baseUnit})
              </option>
            );
          })}
        </select>
        {initialBaseUnit !== undefined && (
          <p className="mt-1 text-[11px] text-ink-faint">
            基準単位が異なるカテゴリへは変更できません。必要な場合は新しい商品として登録してください
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs font-bold text-sale">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="h-11 rounded-xl bg-primary text-sm font-extrabold text-white active:bg-primary-deep"
      >
        {submitLabel}
      </button>
    </form>
  );
}
