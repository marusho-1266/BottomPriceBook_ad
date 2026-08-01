import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopLayoutProvider } from '../../../src/components/DesktopLayoutContext';
import type { Book, WithId } from '../../../src/types/models';

const UID = 'alice-uid';
const OTHER = 'bob-uid';

const mocks = vi.hoisted(() => ({
  useBook: vi.fn(),
  setCurrentBookId: vi.fn(),
}));

vi.mock('../../../src/features/books/BookProvider', () => ({
  useBook: mocks.useBook,
}));

const { BookSwitcher } = await import('../../../src/features/sharing/BookSwitcher');

function makeBook(id: string, name: string): WithId<Book> {
  return {
    id,
    name,
    ownerUid: id,
    memberUids: [id],
    bottomWindowMonths: 6,
    createdAt: Timestamp.now(),
  };
}

const MY_BOOK = makeBook(UID, 'わたしの底値帳');
const JOINED_BOOK = makeBook(OTHER, 'ボブの底値帳');

function setBooks(books: WithId<Book>[], currentId = UID) {
  mocks.useBook.mockReturnValue({
    bookId: currentId,
    book: books.find((b) => b.id === currentId) ?? null,
    books,
    isOwner: currentId === UID,
    setCurrentBookId: mocks.setCurrentBookId,
  });
}

function renderMobile() {
  return render(
    <DesktopLayoutProvider value={false}>
      <BookSwitcher />
    </DesktopLayoutProvider>,
  );
}

function renderDesktop() {
  return render(
    <DesktopLayoutProvider value={true}>
      <BookSwitcher tone="onSurface" />
    </DesktopLayoutProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BookSwitcher(モバイル)', () => {
  it('参加 book が 1 冊なら従来どおり「そこねこ」を表示し、切替トリガーは出ない', () => {
    setBooks([MY_BOOK]);
    renderMobile();

    expect(screen.getByRole('heading', { name: 'そこねこ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '底値帳を切り替え' })).not.toBeInTheDocument();
  });

  it('複数冊なら現在の book 名を表示する', () => {
    setBooks([MY_BOOK, JOINED_BOOK]);
    renderMobile();

    expect(screen.getByRole('heading', { name: 'わたしの底値帳' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '底値帳を切り替え' })).toBeInTheDocument();
  });

  it('シートから選ぶと setCurrentBookId が呼ばれる', async () => {
    const user = userEvent.setup();
    setBooks([MY_BOOK, JOINED_BOOK]);
    renderMobile();

    await user.click(screen.getByRole('button', { name: '底値帳を切り替え' }));
    await user.click(screen.getByRole('option', { name: /ボブの底値帳/ }));

    expect(mocks.setCurrentBookId).toHaveBeenCalledWith(OTHER);
  });

  it('シートでは選択中の book に印が付く', async () => {
    const user = userEvent.setup();
    setBooks([MY_BOOK, JOINED_BOOK]);
    renderMobile();

    await user.click(screen.getByRole('button', { name: '底値帳を切り替え' }));

    expect(screen.getByRole('option', { name: /わたしの底値帳.*選択中/ })).toBeInTheDocument();
  });

  it('切替シートのオーバーレイは画面全幅を覆う(PCでの帯状暗転防止)', async () => {
    const user = userEvent.setup();
    setBooks([MY_BOOK, JOINED_BOOK]);
    renderMobile();

    await user.click(screen.getByRole('button', { name: '底値帳を切り替え' }));

    const backdrop = screen.getByTestId('picker-sheet-backdrop');
    const shell = backdrop.parentElement;
    expect(shell?.className.split(/\s+/)).toEqual(expect.arrayContaining(['fixed', 'inset-0']));
    expect(shell?.className.split(/\s+/)).not.toContain('max-w-md');
  });
});

describe('BookSwitcher(デスクトップ)', () => {
  it('ドロップダウンから選ぶと setCurrentBookId が呼ばれる', async () => {
    const user = userEvent.setup();
    setBooks([MY_BOOK, JOINED_BOOK]);
    renderDesktop();

    await user.click(screen.getByRole('button', { name: '底値帳を切り替え' }));
    expect(screen.getByRole('listbox', { name: '底値帳の候補' })).toBeInTheDocument();
    expect(screen.queryByTestId('picker-sheet-backdrop')).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /ボブの底値帳/ }));
    expect(mocks.setCurrentBookId).toHaveBeenCalledWith(OTHER);
  });

  it('選択中の book に印が付き、Escape で閉じる', async () => {
    const user = userEvent.setup();
    setBooks([MY_BOOK, JOINED_BOOK]);
    renderDesktop();

    await user.click(screen.getByRole('button', { name: '底値帳を切り替え' }));
    expect(screen.getByRole('option', { name: /わたしの底値帳.*選択中/ })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: '底値帳の候補' })).not.toBeInTheDocument();
  });
});
