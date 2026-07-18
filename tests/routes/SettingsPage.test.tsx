import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateBook, signOut, useBook } = vi.hoisted(() => ({
  updateBook: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  useBook: vi.fn(),
}));

function setBook(isOwner: boolean) {
  useBook.mockReturnValue({
    bookId: 'u1',
    book: {
      id: 'u1',
      name: 'わたしの底値帳',
      ownerUid: isOwner ? 'u1' : 'someone-else',
      memberUids: ['u1'],
      bottomWindowMonths: 6,
    },
    books: [],
    isOwner,
    setCurrentBookId: vi.fn(),
  });
}

vi.mock('../../src/features/books/BookProvider', () => ({ useBook }));
vi.mock('../../src/features/books/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/features/books/api')>();
  return { ...actual, updateBook };
});
vi.mock('../../src/features/auth/api', () => ({ signOut }));
// 共有セクションは専用テストで検証済み。実 Firestore 購読を避けるためモックする
vi.mock('../../src/features/sharing/ShareSettings', () => ({ ShareSettings: () => null }));
// 退会ダイアログ自体の挙動は専用テスト(DeleteAccountDialog.test.tsx)で検証済み
vi.mock('../../src/features/account/DeleteAccountDialog', () => ({
  DeleteAccountDialog: ({ onCancel }: { onCancel: () => void }) => (
    <div role="alertdialog" aria-label="アカウントを削除(モック)">
      <button type="button" onClick={onCancel}>
        閉じる(モック)
      </button>
    </div>
  ),
}));

import { SettingsPage } from '../../src/routes/SettingsPage';
import { db } from '../../src/lib/firebase';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBook(true);
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

  it('退会ボタンから確認ダイアログを開閉できる', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'アカウントを削除(退会)' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '閉じる(モック)' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('参加中の book(非オーナー)では名前・期間の編集 UI が出ない(Issue #7)', () => {
    setBook(false);
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText('底値帳の名前')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '名前を保存' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '3ヶ月' })).not.toBeInTheDocument();
    // 閲覧表示はされる
    expect(screen.getByText('わたしの底値帳')).toBeInTheDocument();
    expect(screen.getByText('6ヶ月')).toBeInTheDocument();
  });

  it('利用規約・プライバシーポリシー・お問い合わせへのリンクを表示する(Issue #14)', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /利用規約/ })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /プライバシーポリシー/ })).toHaveAttribute(
      'href',
      '/privacy',
    );
    const contact = screen.getByRole('link', { name: /お問い合わせ/ });
    expect(contact).toHaveAttribute('target', '_blank');
    expect(contact).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
