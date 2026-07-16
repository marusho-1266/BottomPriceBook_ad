import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, WithId } from '../../../src/types/models';

const UID = 'alice-uid';
const OTHER_BOOK = 'bob-uid';
const STORAGE_KEY = `sokoneko:currentBookId:${UID}`;

const mocks = vi.hoisted(() => ({
  useCollection: vi.fn(),
}));

vi.mock('../../../src/lib/firestoreHooks', () => ({
  useCollection: mocks.useCollection,
}));

// vi.mock より後に import するため dynamic import
const { BookProvider, resolveCurrentBookId, useBook } = await import(
  '../../../src/features/books/BookProvider'
);

function makeBook(id: string, name: string, ownerUid = id): WithId<Book> {
  return {
    id,
    name,
    ownerUid,
    memberUids: [ownerUid, UID],
    bottomWindowMonths: 6,
    createdAt: Timestamp.now(),
  };
}

const MY_BOOK = makeBook(UID, 'わたしの底値帳');
const JOINED_BOOK = makeBook(OTHER_BOOK, 'ボブの底値帳');

function Probe() {
  const { bookId, book, books, isOwner, setCurrentBookId } = useBook();
  // 再マウントされると初期値が取り直される(key リセットの検証用)
  const [mountedAs] = useState(bookId);
  return (
    <div>
      <span data-testid="bookId">{bookId}</span>
      <span data-testid="mountedAs">{mountedAs}</span>
      <span data-testid="bookName">{book?.name ?? '(なし)'}</span>
      <span data-testid="bookCount">{books.length}</span>
      <span data-testid="isOwner">{String(isOwner)}</span>
      <button onClick={() => setCurrentBookId(OTHER_BOOK)}>切替</button>
    </div>
  );
}

beforeEach(() => {
  // localStorage は tests/setup.ts でテストごとにインメモリ実装へ差し替え済み
  mocks.useCollection.mockReturnValue({ data: [MY_BOOK, JOINED_BOOK], loading: false });
});

describe('resolveCurrentBookId', () => {
  it('保存 ID がリストにあればそれを返す', () => {
    expect(resolveCurrentBookId([MY_BOOK, JOINED_BOOK], OTHER_BOOK, UID)).toBe(OTHER_BOOK);
  });

  it('保存 ID がリストに無ければ自分の book にフォールバック', () => {
    expect(resolveCurrentBookId([MY_BOOK], OTHER_BOOK, UID)).toBe(UID);
  });

  it('保存 ID が無ければ自分の book', () => {
    expect(resolveCurrentBookId([MY_BOOK, JOINED_BOOK], null, UID)).toBe(UID);
  });
});

describe('BookProvider', () => {
  it('デフォルトは自分の book を指す', () => {
    render(
      <BookProvider uid={UID}>
        <Probe />
      </BookProvider>,
    );
    expect(screen.getByTestId('bookId').textContent).toBe(UID);
    expect(screen.getByTestId('bookName').textContent).toBe('わたしの底値帳');
    expect(screen.getByTestId('bookCount').textContent).toBe('2');
    expect(screen.getByTestId('isOwner').textContent).toBe('true');
  });

  it('setCurrentBookId で切り替わり、children が再マウントされ、localStorage に保存される', async () => {
    const user = userEvent.setup();
    render(
      <BookProvider uid={UID}>
        <Probe />
      </BookProvider>,
    );
    await user.click(screen.getByRole('button', { name: '切替' }));

    expect(screen.getByTestId('bookId').textContent).toBe(OTHER_BOOK);
    expect(screen.getByTestId('bookName').textContent).toBe('ボブの底値帳');
    expect(screen.getByTestId('isOwner').textContent).toBe('false');
    // key 再マウントにより useState の初期値が取り直されている
    expect(screen.getByTestId('mountedAs').textContent).toBe(OTHER_BOOK);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(OTHER_BOOK);
  });

  it('localStorage の保存値から復元される', () => {
    localStorage.setItem(STORAGE_KEY, OTHER_BOOK);
    render(
      <BookProvider uid={UID}>
        <Probe />
      </BookProvider>,
    );
    expect(screen.getByTestId('bookId').textContent).toBe(OTHER_BOOK);
  });

  it('保存値の book がリストから消えていたら自分の book にフォールバックし、保存値も更新される', () => {
    localStorage.setItem(STORAGE_KEY, OTHER_BOOK);
    mocks.useCollection.mockReturnValue({ data: [MY_BOOK], loading: false });
    render(
      <BookProvider uid={UID}>
        <Probe />
      </BookProvider>,
    );
    expect(screen.getByTestId('bookId').textContent).toBe(UID);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(UID);
  });

  it('クエリ未反映の book を選択しても、反映されたらその book が開く(参加直後の競合)', async () => {
    const user = userEvent.setup();
    // 参加直後: books クエリにはまだ自分の book しか無い
    mocks.useCollection.mockReturnValue({ data: [MY_BOOK], loading: false });
    const { rerender } = render(
      <BookProvider uid={UID}>
        <Probe />
      </BookProvider>,
    );
    await user.click(screen.getByRole('button', { name: '切替' }));

    // 反映までは自分の book を暫定表示(選択は保持される)
    expect(screen.getByTestId('bookId').textContent).toBe(UID);

    // スナップショットに参加先が反映される
    mocks.useCollection.mockReturnValue({ data: [MY_BOOK, JOINED_BOOK], loading: false });
    rerender(
      <BookProvider uid={UID}>
        <Probe />
      </BookProvider>,
    );

    expect(screen.getByTestId('bookId').textContent).toBe(OTHER_BOOK);
    expect(screen.getByTestId('bookName').textContent).toBe('ボブの底値帳');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(OTHER_BOOK);
  });

  it('ロード中は保存値を尊重しフォールバックしない', () => {
    localStorage.setItem(STORAGE_KEY, OTHER_BOOK);
    mocks.useCollection.mockReturnValue({ data: [], loading: true });
    render(
      <BookProvider uid={UID}>
        <Probe />
      </BookProvider>,
    );
    expect(screen.getByTestId('bookId').textContent).toBe(OTHER_BOOK);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(OTHER_BOOK);
  });
});
