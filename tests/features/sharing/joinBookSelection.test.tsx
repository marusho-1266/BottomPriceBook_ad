import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, Invite, WithId } from '../../../src/types/models';

const UID = 'bob-uid';
const BOOK_ID = 'alice-uid';
const CODE = 'invite-code-1234567890';

const mocks = vi.hoisted(() => ({
  fetchInvite: vi.fn(),
  joinBook: vi.fn(),
  useCollection: vi.fn(),
}));

vi.mock('../../../src/features/sharing/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/features/sharing/api')>()),
  fetchInvite: mocks.fetchInvite,
  joinBook: mocks.joinBook,
}));

vi.mock('../../../src/lib/firestoreHooks', () => ({
  useCollection: mocks.useCollection,
}));

vi.mock('../../../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: UID, displayName: 'ボブ', email: 'bob@example.com' },
    loading: false,
  }),
}));

// vi.mock より後に import するため dynamic import
const { BookProvider, useBook } = await import('../../../src/features/books/BookProvider');
const { JoinPage } = await import('../../../src/features/sharing/JoinPage');

function makeBook(id: string, name: string): WithId<Book> {
  return {
    id,
    name,
    ownerUid: id,
    memberUids: [id, UID],
    bottomWindowMonths: 6,
    createdAt: Timestamp.now(),
  };
}

const MY_BOOK = makeBook(UID, 'わたしの底値帳');
const JOINED_BOOK = makeBook(BOOK_ID, 'アリスの底値帳');

function makeInvite(): WithId<Invite> {
  return {
    id: CODE,
    bookId: BOOK_ID,
    bookName: 'アリスの底値帳',
    createdBy: BOOK_ID,
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

function HomeProbe() {
  const { bookId } = useBook();
  return <div data-testid="currentBookId">{bookId}</div>;
}

function App() {
  return (
    <MemoryRouter initialEntries={[`/join/${CODE}`]}>
      <BookProvider uid={UID}>
        <Routes>
          <Route path="/join/:inviteCode" element={<JoinPage />} />
          <Route path="/" element={<HomeProbe />} />
        </Routes>
      </BookProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('参加直後の book 切替(BookProvider × JoinPage 統合)', () => {
  it('books クエリへの反映が参加より遅れても、反映後に参加先の book が開く', async () => {
    const user = userEvent.setup();
    mocks.fetchInvite.mockResolvedValue(makeInvite());
    mocks.joinBook.mockResolvedValue(undefined);
    // 参加完了直後: スナップショットにはまだ参加先が届いていない
    mocks.useCollection.mockReturnValue({ data: [MY_BOOK], loading: false });
    const { rerender } = render(<App />);

    await user.click(await screen.findByRole('button', { name: '参加する' }));

    // ホームへ遷移し、クエリ反映前でも参加先の book ID が現在の選択になる
    expect(await screen.findByTestId('currentBookId')).toHaveTextContent(BOOK_ID);

    // スナップショットに参加先が反映されても選択はそのまま維持される
    mocks.useCollection.mockReturnValue({ data: [MY_BOOK, JOINED_BOOK], loading: false });
    rerender(<App />);

    expect(screen.getByTestId('currentBookId')).toHaveTextContent(BOOK_ID);
  });
});
