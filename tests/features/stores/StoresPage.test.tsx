import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/features/books/BookProvider', () => ({
  useBook: () => ({ bookId: 'b1', book: null }),
}));
vi.mock('../../../src/features/stores/api', () => ({
  useStores: vi.fn(() => ({
    data: [{ id: 's1', name: 'OKストア' }],
    loading: false,
  })),
  addStore: vi.fn().mockResolvedValue(undefined),
  renameStore: vi.fn().mockResolvedValue(undefined),
}));

import { StoresPage } from '../../../src/features/stores/StoresPage';
import { addStore, renameStore } from '../../../src/features/stores/api';

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
    await user.click(screen.getByRole('button', { name: '編集' }));
    const input = screen.getByDisplayValue('OKストア');
    await user.clear(input);
    await user.type(input, 'OKストア 川崎店');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(renameStore).toHaveBeenCalledWith('b1', 's1', 'OKストア 川崎店');
  });
});
