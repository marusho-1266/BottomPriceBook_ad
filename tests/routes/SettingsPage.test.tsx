import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateBook, signOut } = vi.hoisted(() => ({
  updateBook: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/features/books/BookProvider', () => ({
  useBook: () => ({
    bookId: 'u1',
    book: {
      id: 'u1',
      name: 'わたしの底値帳',
      ownerUid: 'u1',
      memberUids: ['u1'],
      bottomWindowMonths: 6,
    },
  }),
}));
vi.mock('../../src/features/books/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/books/api')>();
  return { ...actual, updateBook };
});
vi.mock('../../src/features/auth/api', () => ({ signOut }));

import { SettingsPage } from '../../src/routes/SettingsPage';
import { db } from '../../src/lib/firebase';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('底値の対象期間を変更できる', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: '3ヶ月' }));
    expect(updateBook).toHaveBeenCalledWith(db, 'u1', { bottomWindowMonths: 3 });
  });

  it('底値帳の名前を変更できる', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    const nameInput = screen.getByLabelText('底値帳の名前');
    await user.clear(nameInput);
    await user.type(nameInput, 'うちの底値帳');
    await user.click(screen.getByRole('button', { name: '名前を保存' }));
    expect(updateBook).toHaveBeenCalledWith(db, 'u1', { name: 'うちの底値帳' });
  });

  it('カテゴリ・店舗管理への導線がある', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /カテゴリ管理/ })).toHaveAttribute(
      'href',
      '/settings/categories',
    );
    expect(screen.getByRole('link', { name: /店舗管理/ })).toHaveAttribute(
      'href',
      '/settings/stores',
    );
  });

  it('ログアウトできる', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(signOut).toHaveBeenCalled();
  });
});
