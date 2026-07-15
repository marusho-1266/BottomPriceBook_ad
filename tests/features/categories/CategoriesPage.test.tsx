import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/features/books/BookProvider', () => ({
  useBook: () => ({ bookId: 'b1', book: null }),
}));
vi.mock('../../../src/features/categories/api', () => ({
  useCategories: vi.fn(() => ({
    data: [
      { id: 'food', name: '食品', baseUnit: 'g', sortOrder: 0 },
      { id: 'drink', name: '飲料', baseUnit: 'ml', sortOrder: 1 },
    ],
    loading: false,
  })),
  addCategory: vi.fn().mockResolvedValue(undefined),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/features/products/api', () => ({
  // 「食品」カテゴリだけ商品 2 件から参照されている状態
  useProducts: vi.fn(() => ({
    data: [
      { id: 'p1', name: '米', categoryId: 'food' },
      { id: 'p2', name: 'パン', categoryId: 'food' },
    ],
    loading: false,
  })),
}));

import { CategoriesPage } from '../../../src/features/categories/CategoriesPage';
import {
  addCategory,
  deleteCategory,
  updateCategory,
} from '../../../src/features/categories/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <CategoriesPage />
    </MemoryRouter>,
  );
}

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('カテゴリの一覧を基準単位付きで表示する', () => {
    renderPage();
    expect(screen.getByText('食品')).toBeInTheDocument();
    expect(screen.getByText('飲料')).toBeInTheDocument();
    expect(screen.getByText(/基準単位: g/)).toBeInTheDocument();
    expect(screen.getByText(/基準単位: ml/)).toBeInTheDocument();
  });

  it('名前と基準単位を指定してカテゴリを追加できる', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('カテゴリ名'), 'ティッシュ');
    await user.selectOptions(screen.getByLabelText('基準単位'), '組');
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(addCategory).toHaveBeenCalledWith('b1', { name: 'ティッシュ', baseUnit: '組' });
  });

  it('空の名前では追加できずエラーを表示する', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(addCategory).not.toHaveBeenCalled();
    expect(screen.getByText('カテゴリ名を入力してください')).toBeInTheDocument();
  });

  it('カテゴリ名を変更できる', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    const input = screen.getByLabelText('カテゴリ名を編集');
    await user.clear(input);
    await user.type(input, '食料品');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(updateCategory).toHaveBeenCalledWith(
      'b1',
      'food',
      { name: '食料品', baseUnit: 'g' },
      { previousBaseUnit: 'g', productIds: ['p1', 'p2'] },
    );
  });

  it('商品 0 件のカテゴリは confirm なしで基準単位を変更できる', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '編集' })[1]);
    await user.selectOptions(screen.getByLabelText('基準単位を編集'), '個');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(updateCategory).toHaveBeenCalledWith(
      'b1',
      'drink',
      { name: '飲料', baseUnit: '個' },
      { previousBaseUnit: 'ml', productIds: [] },
    );
  });

  it('商品があるカテゴリで基準単位を変えると confirm が出る。キャンセルなら保存しない', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    await user.selectOptions(screen.getByLabelText('基準単位を編集'), 'ml');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(updateCategory).not.toHaveBeenCalled();
  });

  it('商品があるカテゴリで基準単位変更に同意すると updateCategory が呼ばれる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    await user.selectOptions(screen.getByLabelText('基準単位を編集'), 'ml');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(updateCategory).toHaveBeenCalledWith(
      'b1',
      'food',
      { name: '食品', baseUnit: 'ml' },
      { previousBaseUnit: 'g', productIds: ['p1', 'p2'] },
    );
  });

  it('あとから変更できますの案内が表示される', () => {
    renderPage();
    expect(screen.getByText(/基準単位はあとから変更できます/)).toBeInTheDocument();
    expect(screen.queryByText(/基準単位はあとから変更できません/)).not.toBeInTheDocument();
  });

  it('商品から参照中のカテゴリは削除できず件数を表示する(H-2)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(deleteCategory).not.toHaveBeenCalled();
    expect(screen.getByText('2件の商品が使用中のため削除できません')).toBeInTheDocument();
  });

  it('参照されていないカテゴリは確認のうえ削除できる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '削除' })[1]);
    expect(deleteCategory).toHaveBeenCalledWith('b1', 'drink');
  });
});
