import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invite, WithId } from '../../../src/types/models';

const UID = 'bob-uid';
const BOOK_ID = 'alice-uid';
const CODE = 'invite-code-1234567890';

const mocks = vi.hoisted(() => ({
  fetchInvite: vi.fn(),
  joinBook: vi.fn(),
  setCurrentBookId: vi.fn(),
  useBook: vi.fn(),
}));

vi.mock('../../../src/features/sharing/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/features/sharing/api')>()),
  fetchInvite: mocks.fetchInvite,
  joinBook: mocks.joinBook,
}));

vi.mock('../../../src/features/books/BookProvider', () => ({
  useBook: mocks.useBook,
}));

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: UID, displayName: 'ボブ', email: 'bob@example.com' },
    loading: false,
  }),
}));

const { JoinPage } = await import('../../../src/features/sharing/JoinPage');

function makeInvite(expiresInMs = 7 * 24 * 60 * 60 * 1000): WithId<Invite> {
  return {
    id: CODE,
    bookId: BOOK_ID,
    bookName: 'アリスの底値帳',
    createdBy: BOOK_ID,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + expiresInMs),
  };
}

function renderJoinPage(initialEntry = `/join/${CODE}`) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:inviteCode" element={<JoinPage />} />
        <Route path="/" element={<div>ホーム</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useBook.mockReturnValue({
    bookId: UID,
    book: null,
    books: [{ id: UID, name: 'わたしの底値帳' }],
    isOwner: true,
    setCurrentBookId: mocks.setCurrentBookId,
  });
});

describe('JoinPage', () => {
  it('有効な招待なら book 名と参加ボタンを表示する', async () => {
    mocks.fetchInvite.mockResolvedValue(makeInvite());
    renderJoinPage();

    expect(await screen.findByText('アリスの底値帳')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '参加する' })).toBeEnabled();
  });

  it('参加するとバッチ実行 → book 切替 → ホームへ遷移する', async () => {
    const user = userEvent.setup();
    mocks.fetchInvite.mockResolvedValue(makeInvite());
    mocks.joinBook.mockResolvedValue(undefined);
    renderJoinPage();

    await user.click(await screen.findByRole('button', { name: '参加する' }));

    expect(mocks.joinBook).toHaveBeenCalledWith(expect.anything(), {
      bookId: BOOK_ID,
      inviteCode: CODE,
      uid: UID,
      displayName: 'ボブ',
    });
    expect(mocks.setCurrentBookId).toHaveBeenCalledWith(BOOK_ID);
    expect(await screen.findByText('ホーム')).toBeInTheDocument();
  });

  it('存在しないコードならエラーを表示する', async () => {
    mocks.fetchInvite.mockResolvedValue(null);
    renderJoinPage();

    expect(await screen.findByText(/招待が見つかりません/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '参加する' })).not.toBeInTheDocument();
  });

  it('期限切れの招待なら期限切れの旨を表示する', async () => {
    mocks.fetchInvite.mockResolvedValue(makeInvite(-1000));
    renderJoinPage();

    expect(await screen.findByText(/有効期限が切れています/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '参加する' })).not.toBeInTheDocument();
  });

  it('取得に失敗したらエラーを表示する', async () => {
    mocks.fetchInvite.mockRejectedValue(new Error('network'));
    renderJoinPage();

    expect(await screen.findByText(/招待を確認できませんでした/)).toBeInTheDocument();
  });

  it('オフラインなら参加ボタンを無効化して案内を表示する', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    mocks.fetchInvite.mockResolvedValue(makeInvite());
    renderJoinPage();

    expect(await screen.findByRole('button', { name: '参加する' })).toBeDisabled();
    expect(screen.getByText(/オンラインで参加してください/)).toBeInTheDocument();
  });

  it('/join でコードを手入力すると招待の確認へ進める', async () => {
    const user = userEvent.setup();
    mocks.fetchInvite.mockResolvedValue(makeInvite());
    renderJoinPage('/join');

    const input = screen.getByLabelText('招待コード');
    expect(screen.getByRole('button', { name: '招待を確認' })).toBeDisabled();

    await user.type(input, CODE);
    await user.click(screen.getByRole('button', { name: '招待を確認' }));

    expect(mocks.fetchInvite).toHaveBeenCalledWith(expect.anything(), CODE);
    expect(await screen.findByText('アリスの底値帳')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '参加する' })).toBeInTheDocument();
  });

  it('招待リンクを貼り付けてもコード部分を取り出して確認へ進める', async () => {
    const user = userEvent.setup();
    mocks.fetchInvite.mockResolvedValue(makeInvite());
    renderJoinPage('/join');

    await user.type(screen.getByLabelText('招待コード'), `https://example.com/join/${CODE}`);
    await user.click(screen.getByRole('button', { name: '招待を確認' }));

    expect(mocks.fetchInvite).toHaveBeenCalledWith(expect.anything(), CODE);
    expect(await screen.findByText('アリスの底値帳')).toBeInTheDocument();
  });

  it('参加済みの book なら切替導線のみ表示する', async () => {
    mocks.useBook.mockReturnValue({
      bookId: UID,
      book: null,
      books: [
        { id: UID, name: 'わたしの底値帳' },
        { id: BOOK_ID, name: 'アリスの底値帳' },
      ],
      isOwner: true,
      setCurrentBookId: mocks.setCurrentBookId,
    });
    mocks.fetchInvite.mockResolvedValue(makeInvite());
    const user = userEvent.setup();
    renderJoinPage();

    expect(await screen.findByText(/参加済み/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '参加する' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'この底値帳を開く' }));
    expect(mocks.setCurrentBookId).toHaveBeenCalledWith(BOOK_ID);
    expect(await screen.findByText('ホーム')).toBeInTheDocument();
  });
});
