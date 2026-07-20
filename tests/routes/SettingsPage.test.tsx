import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateBook,
  signOut,
  useBook,
  fetchPriceRecords,
  fetchProducts,
  fetchStores,
  downloadPriceRecordsCsv,
} = vi.hoisted(() => ({
  updateBook: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  useBook: vi.fn(),
  fetchPriceRecords: vi.fn().mockResolvedValue([] as unknown[]),
  fetchProducts: vi.fn().mockResolvedValue([] as unknown[]),
  fetchStores: vi.fn().mockResolvedValue([] as unknown[]),
  downloadPriceRecordsCsv: vi.fn(),
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
vi.mock('../../src/features/prices/api', () => ({ fetchPriceRecords }));
vi.mock('../../src/features/products/api', () => ({ fetchProducts }));
vi.mock('../../src/features/stores/api', () => ({ fetchStores }));
vi.mock('../../src/features/prices/export', () => ({ downloadPriceRecordsCsv }));
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
vi.mock('../../src/lib/analytics', () => ({ trackEvent: vi.fn() }));

import { SettingsPage } from '../../src/routes/SettingsPage';
import { db } from '../../src/lib/firebase';
import { trackEvent } from '../../src/lib/analytics';
import { hasSeenOnboarding, markOnboardingSeen } from '../../src/features/onboarding/storage';

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('データをエクスポートボタンでクリック時に全期間データを取得しダウンロード関数が正しい引数で呼ばれる(Issue #20)', async () => {
    const records = [{ id: 'r1', productId: 'p1', storeId: 's1' }];
    const products = [{ id: 'p1', name: 'シャンプー' }];
    const stores = [{ id: 's1', name: 'スーパーA' }];
    fetchPriceRecords.mockResolvedValue(records);
    fetchProducts.mockResolvedValue(products);
    fetchStores.mockResolvedValue(stores);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'データをエクスポート' }));
    expect(fetchPriceRecords).toHaveBeenCalledWith('u1');
    expect(fetchProducts).toHaveBeenCalledWith('u1');
    expect(fetchStores).toHaveBeenCalledWith('u1');
    expect(downloadPriceRecordsCsv).toHaveBeenCalledWith(
      records,
      products,
      stores,
      'わたしの底値帳',
    );
  });

  it('取得中はエクスポートボタンが無効化され、完了すると再度有効になる(読み込み中の不完全CSVを防止)', async () => {
    let resolveFetch: (value: unknown[]) => void = () => {};
    fetchPriceRecords.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'データをエクスポート' });
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(button).toBeDisabled();
    expect(downloadPriceRecordsCsv).not.toHaveBeenCalled();

    resolveFetch([]);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(downloadPriceRecordsCsv).toHaveBeenCalled();
  });

  it('取得に失敗した場合はエラーメッセージを表示し、ボタンを再度有効にする', async () => {
    fetchPriceRecords.mockRejectedValue(new Error('network error'));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: 'データをエクスポート' });
    await user.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent('エクスポートに失敗しました');
    expect(button).not.toBeDisabled();
    expect(downloadPriceRecordsCsv).not.toHaveBeenCalled();
  });

  it('参加中の book(非オーナー)でもデータをエクスポートボタンが表示される(Issue #20)', () => {
    setBook(false);
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'データをエクスポート' })).toBeInTheDocument();
  });

  it('「使い方を見る」からオンボーディングを再表示でき、閉じると設定画面に戻る(Issue #21)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog', { name: 'アプリの使い方' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '使い方を見る' }));

    expect(screen.getByRole('dialog', { name: 'アプリの使い方' })).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_reopened');

    await user.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(screen.queryByRole('dialog', { name: 'アプリの使い方' })).not.toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('onboarding_skipped');
  });

  it('設定からの再表示ではスキップしても既読フラグが変化しない(未設定)(Issue #21)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(hasSeenOnboarding('u1')).toBe(false);
    await user.click(screen.getByRole('button', { name: '使い方を見る' }));
    await user.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(hasSeenOnboarding('u1')).toBe(false);
  });

  it('設定からの再表示ではスキップしても既読フラグが変化しない(既読済み)(Issue #21)', async () => {
    markOnboardingSeen('u1');
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(hasSeenOnboarding('u1')).toBe(true);
    await user.click(screen.getByRole('button', { name: '使い方を見る' }));
    await user.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(hasSeenOnboarding('u1')).toBe(true);
  });

  it('設定からの再表示で「はじめる」まで進めても既読フラグが変化しない(未設定)(Issue #21)', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(hasSeenOnboarding('u1')).toBe(false);
    await user.click(screen.getByRole('button', { name: '使い方を見る' }));
    let next = screen.queryByRole('button', { name: '次へ' });
    while (next) {
      await user.click(next);
      next = screen.queryByRole('button', { name: '次へ' });
    }
    await user.click(screen.getByRole('button', { name: 'はじめる' }));
    expect(screen.queryByRole('dialog', { name: 'アプリの使い方' })).not.toBeInTheDocument();
    expect(hasSeenOnboarding('u1')).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('onboarding_completed');
  });

  it('設定からの再表示で「はじめる」まで進めても既読フラグが変化しない(既読済み)(Issue #21)', async () => {
    markOnboardingSeen('u1');
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(hasSeenOnboarding('u1')).toBe(true);
    await user.click(screen.getByRole('button', { name: '使い方を見る' }));
    let next = screen.queryByRole('button', { name: '次へ' });
    while (next) {
      await user.click(next);
      next = screen.queryByRole('button', { name: '次へ' });
    }
    await user.click(screen.getByRole('button', { name: 'はじめる' }));
    expect(screen.queryByRole('dialog', { name: 'アプリの使い方' })).not.toBeInTheDocument();
    expect(hasSeenOnboarding('u1')).toBe(true);
  });
});
