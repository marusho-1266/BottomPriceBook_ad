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
  renameCategory: vi.fn().mockResolvedValue(undefined),
}));

import { CategoriesPage } from '../../../src/features/categories/CategoriesPage';
import { addCategory, renameCategory } from '../../../src/features/categories/api';

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
    const input = screen.getByDisplayValue('食品');
    await user.clear(input);
    await user.type(input, '食料品');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(renameCategory).toHaveBeenCalledWith('b1', 'food', '食料品');
  });
});
