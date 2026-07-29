import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
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
}));
vi.mock('../../../src/features/products/api', () => ({
  useProducts: vi.fn(() => ({
    data: [
      { id: 'p1', name: 'コシヒカリ 5kg', categoryId: 'food', note: '精米日注意' },
      { id: 'p2', name: '天然水', categoryId: 'drink' },
    ],
    loading: false,
  })),
  addProduct: vi.fn().mockResolvedValue('p-new'),
  updateProduct: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/features/products/deleteProduct', () => ({
  deleteProductWithRecords: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/lib/firebase', () => ({ db: {} }));

import { ProductsPage } from '../../../src/features/products/ProductsPage';
import { addProduct, updateProduct } from '../../../src/features/products/api';
import { deleteProductWithRecords } from '../../../src/features/products/deleteProduct';

/** 現在の URL をアサートするためのプローブ */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderPage(initialEntry = '/settings/products') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ProductsPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('商品の一覧を表示する', () => {
    renderPage();
    expect(screen.getByText('コシヒカリ 5kg')).toBeInTheDocument();
    expect(screen.getByText('食品')).toBeInTheDocument();
    expect(screen.getByText('天然水')).toBeInTheDocument();
  });

  it('商品を登録できる', async () => {
    const user = userEvent.setup();
    renderPage();
    const form = screen.getByRole('button', { name: '登録' }).closest('form')!;
    await user.type(within(form).getByLabelText('商品名'), '牛乳');
    await user.selectOptions(within(form).getByLabelText('カテゴリ'), 'drink');
    await user.type(within(form).getByLabelText('メモ'), '1L');
    await user.click(within(form).getByRole('button', { name: '登録' }));
    expect(addProduct).toHaveBeenCalledWith('b1', {
      name: '牛乳',
      categoryId: 'drink',
      note: '1L',
    });
  });

  it('商品を編集できる', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    // [0] は上部の追加フォーム、[1] が編集中の行
    const nameInput = screen.getAllByLabelText('商品名')[1];
    await user.clear(nameInput);
    await user.type(nameInput, 'コシヒカリ 10kg');
    const noteInput = screen.getAllByLabelText('メモ')[1];
    await user.clear(noteInput);
    await user.type(noteInput, '5kg 袋のみ');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(updateProduct).toHaveBeenCalledWith('b1', 'p1', {
      name: 'コシヒカリ 10kg',
      categoryId: 'food',
      note: '5kg 袋のみ',
    });
  });

  it('確認のうえ商品を削除できる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/コシヒカリ 5kg/));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/価格記録も削除/));
    expect(deleteProductWithRecords).toHaveBeenCalledWith({}, 'b1', 'p1');
  });

  it('編集フォームのラベルが追加フォームと衝突しない', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    // 追加フォームと編集フォームで id が一意なため、両方のラベルが個別に解決できる
    const nameFields = screen.getAllByLabelText('商品名');
    expect(nameFields).toHaveLength(2);
    expect(nameFields[1]).toHaveValue('コシヒカリ 5kg');
    expect(screen.getAllByLabelText('メモ')[1]).toHaveValue('精米日注意');
  });

  it('削除が失敗するとエラーを表示する', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteProductWithRecords).mockRejectedValueOnce(new Error('unavailable'));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました');
  });

  it('削除をキャンセルすると API を呼ばない', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(deleteProductWithRecords).not.toHaveBeenCalled();
  });

  it('?edit= があるとき該当商品を編集モードで開く', () => {
    renderPage('/settings/products?edit=p1');
    expect(screen.getByDisplayValue('コシヒカリ 5kg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  it('存在しない ?edit= は無視して一覧のまま', () => {
    renderPage('/settings/products?edit=missing');
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.getByText('コシヒカリ 5kg')).toBeInTheDocument();
  });

  it('編集を閉じると一覧に戻り、?edit= も URL から消える', async () => {
    const user = userEvent.setup();
    renderPage('/settings/products?edit=p1');
    expect(screen.getByTestId('location')).toHaveTextContent('edit=p1');
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).not.toHaveTextContent('edit=p1');
  });

  it('保存すると編集モードを閉じる', async () => {
    const user = userEvent.setup();
    renderPage('/settings/products?edit=p1');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(updateProduct).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });
});
