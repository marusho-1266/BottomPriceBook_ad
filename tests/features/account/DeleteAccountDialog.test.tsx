import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, WithId } from '../../../src/types/models';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

const mocks = vi.hoisted(() => ({
  reauthenticate: vi.fn(),
  deleteAccount: vi.fn(),
  useBook: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock('../../../src/features/account/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/features/account/api')>()),
  reauthenticate: mocks.reauthenticate,
  deleteAccount: mocks.deleteAccount,
}));

vi.mock('../../../src/features/books/BookProvider', () => ({
  useBook: mocks.useBook,
}));

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: mocks.useAuth,
}));

const { DeleteAccountDialog } = await import('../../../src/features/account/DeleteAccountDialog');

function makeBook(memberUids: string[]): WithId<Book> {
  return {
    id: ALICE,
    name: 'わたしの底値帳',
    ownerUid: ALICE,
    memberUids,
    bottomWindowMonths: 6,
    createdAt: Timestamp.now(),
  };
}

function setup({
  memberUids = [ALICE],
  isOwner = true,
  providerId = 'password',
}: { memberUids?: string[]; isOwner?: boolean; providerId?: string } = {}) {
  mocks.useBook.mockReturnValue({
    bookId: ALICE,
    book: makeBook(memberUids),
    books: [makeBook(memberUids)],
    isOwner,
    setCurrentBookId: vi.fn(),
  });
  mocks.useAuth.mockReturnValue({
    user: { uid: ALICE, email: 'alice@example.com', providerData: [{ providerId }] },
    loading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setup();
});

describe('DeleteAccountDialog(メール/パスワードユーザー)', () => {
  it('パスワード入力欄が表示され、未入力では削除ボタンが無効', () => {
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/パスワード/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '削除する' })).toBeDisabled();
  });

  it('パスワード入力後、削除するで reauthenticate → deleteAccount の順に呼ばれる', async () => {
    const user = userEvent.setup();
    mocks.reauthenticate.mockResolvedValue(undefined);
    mocks.deleteAccount.mockResolvedValue(undefined);
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/パスワード/), 'secret123');
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(mocks.reauthenticate).toHaveBeenCalledWith('secret123');
    expect(mocks.deleteAccount).toHaveBeenCalledWith(ALICE);
  });

  it('再認証に失敗するとエラーを表示し、deleteAccount は呼ばれない', async () => {
    const user = userEvent.setup();
    const { AccountDeletionError } = await import('../../../src/features/account/api');
    mocks.reauthenticate.mockRejectedValue(new AccountDeletionError('パスワードが正しくありません'));
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/パスワード/), 'wrong');
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('パスワードが正しくありません');
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it('deleteAccount 失敗時もエラーを表示する', async () => {
    const user = userEvent.setup();
    const { AccountDeletionError } = await import('../../../src/features/account/api');
    mocks.reauthenticate.mockResolvedValue(undefined);
    mocks.deleteAccount.mockRejectedValue(new AccountDeletionError('削除に失敗しました'));
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/パスワード/), 'secret123');
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('削除に失敗しました');
  });

  it('処理中は削除・キャンセルボタンが無効になる', async () => {
    const user = userEvent.setup();
    let resolveReauth!: () => void;
    mocks.reauthenticate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveReauth = resolve;
        }),
    );
    mocks.deleteAccount.mockResolvedValue(undefined);
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/パスワード/), 'secret123');
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(screen.getByRole('button', { name: '削除しています…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();

    resolveReauth();
  });
});

describe('DeleteAccountDialog(Google ユーザー)', () => {
  it('パスワード入力欄は表示されず、削除ボタンは有効', () => {
    setup({ providerId: 'google.com' });
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/パスワード/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '削除する' })).not.toBeDisabled();
  });

  it('削除するで reauthenticate はパスワードなしで呼ばれる', async () => {
    const user = userEvent.setup();
    setup({ providerId: 'google.com' });
    mocks.reauthenticate.mockResolvedValue(undefined);
    mocks.deleteAccount.mockResolvedValue(undefined);
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(mocks.reauthenticate).toHaveBeenCalledWith(undefined);
  });
});

describe('DeleteAccountDialog(共有メンバーの有無)', () => {
  it('自分の book に他のメンバーがいる場合は警告を表示する', () => {
    setup({ memberUids: [ALICE, BOB], isOwner: true });
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    expect(screen.getByText(/メンバーもこの底値帳を使えなくなります/)).toBeInTheDocument();
  });

  it('自分だけの book では警告を表示しない', () => {
    setup({ memberUids: [ALICE], isOwner: true });
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    expect(screen.queryByText(/メンバーもこの底値帳を使えなくなります/)).not.toBeInTheDocument();
  });

  it('参加中(非オーナー)の book では警告を表示しない', () => {
    setup({ memberUids: [BOB, ALICE], isOwner: false });
    render(<DeleteAccountDialog onCancel={vi.fn()} />);

    expect(screen.queryByText(/メンバーもこの底値帳を使えなくなります/)).not.toBeInTheDocument();
  });
});

describe('DeleteAccountDialog(キャンセル)', () => {
  it('キャンセルボタンで onCancel が呼ばれる', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<DeleteAccountDialog onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
