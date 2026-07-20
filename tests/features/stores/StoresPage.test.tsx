import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/features/books/BookProvider', () => ({
  useBook: () => ({ bookId: 'b1', book: null }),
}));
vi.mock('../../../src/features/stores/api', () => ({
  useStores: vi.fn(() => ({
    data: [
      { id: 's1', name: 'OKストア' },
      { id: 's2', name: '西友' },
    ],
    loading: false,
  })),
  addStore: vi.fn().mockResolvedValue(undefined),
  renameStore: vi.fn().mockResolvedValue(undefined),
  deleteStore: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../src/features/prices/api', () => ({
  // s1 だけ価格記録 1 件から参照されている状態
  usePriceRecords: vi.fn(() => ({
    data: [{ id: 'r1', productId: 'p1', storeId: 's1', price: 100 }],
    loading: false,
  })),
}));

import { StoresPage } from '../../../src/features/stores/StoresPage';
import { addStore, deleteStore, renameStore } from '../../../src/features/stores/api';
import { usePriceRecords } from '../../../src/features/prices/api';

function renderPage() {
  return render(
    <MemoryRouter>
      <StoresPage />
    </MemoryRouter>,
  );
}

describe('StoresPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('店舗の一覧を表示する', () => {
    renderPage();
    expect(screen.getByText('OKストア')).toBeInTheDocument();
  });

  it('usePriceRecords を引数なし(全件購読)で呼ぶ(Issue #17: 参照カウント判定は全期間が必要)', () => {
    renderPage();
    expect(usePriceRecords).toHaveBeenCalledWith();
  });

  it('店舗を追加できる', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('店舗名'), '西友');
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(addStore).toHaveBeenCalledWith('b1', '西友');
  });

  it('空の名前では追加できずエラーを表示する', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '追加' }));
    expect(addStore).not.toHaveBeenCalled();
    expect(screen.getByText('店舗名を入力してください')).toBeInTheDocument();
  });

  it('店舗名を変更できる', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '編集' })[0]);
    const input = screen.getByDisplayValue('OKストア');
    await user.clear(input);
    await user.type(input, 'OKストア 川崎店');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(renameStore).toHaveBeenCalledWith('b1', 's1', 'OKストア 川崎店');
  });

  it('価格記録から参照中の店舗は削除できず件数を表示する(H-2)', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
    expect(deleteStore).not.toHaveBeenCalled();
    expect(screen.getByText('1件の価格記録が使用中のため削除できません')).toBeInTheDocument();
  });

  it('参照されていない店舗は確認のうえ削除できる', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getAllByRole('button', { name: '削除' })[1]);
    expect(deleteStore).toHaveBeenCalledWith('b1', 's2');
  });
});
