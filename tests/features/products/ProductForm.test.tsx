import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductForm } from '../../../src/features/products/ProductForm';
import type { Category, WithId } from '../../../src/types/models';

const categories: WithId<Category>[] = [
  { id: 'food', name: '食品', baseUnit: 'g', sortOrder: 0 },
  { id: 'flour', name: '粉もの', baseUnit: 'g', sortOrder: 1 },
  { id: 'drink', name: '飲料', baseUnit: 'ml', sortOrder: 2 },
];

const onSubmit = vi.fn().mockResolvedValue(undefined);

describe('ProductForm(新規)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('名前とカテゴリを入力して送信できる', async () => {
    const user = userEvent.setup();
    render(<ProductForm categories={categories} onSubmit={onSubmit} submitLabel="登録" />);
    await user.type(screen.getByLabelText('商品名'), 'コシヒカリ 5kg');
    await user.selectOptions(screen.getByLabelText('カテゴリ'), 'food');
    await user.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'コシヒカリ 5kg', categoryId: 'food' });
  });

  it('名前が空だとエラーを表示し送信しない', async () => {
    const user = userEvent.setup();
    render(<ProductForm categories={categories} onSubmit={onSubmit} submitLabel="登録" />);
    await user.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('商品名を入力してください')).toBeInTheDocument();
  });
});

describe('ProductForm(編集・カテゴリ変更制限 M-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const initial = { name: 'コシヒカリ 5kg', categoryId: 'food' };

  it('同じ基準単位のカテゴリには変更できる', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        categories={categories}
        initial={initial}
        onSubmit={onSubmit}
        submitLabel="保存"
      />,
    );
    await user.selectOptions(screen.getByLabelText('カテゴリ'), 'flour');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'コシヒカリ 5kg', categoryId: 'flour' });
  });

  it('基準単位が異なるカテゴリの選択肢は無効化され、案内が表示される', () => {
    render(
      <ProductForm
        categories={categories}
        initial={initial}
        onSubmit={onSubmit}
        submitLabel="保存"
      />,
    );
    expect(screen.getByRole('option', { name: /飲料/ })).toBeDisabled();
    expect(screen.getByText(/基準単位が異なるカテゴリへは変更できません/)).toBeInTheDocument();
  });
});
