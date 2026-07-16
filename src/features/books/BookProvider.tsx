import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCollection } from '../../lib/firestoreHooks';
import type { Book, WithId } from '../../types/models';

interface BookState {
  /** 現在表示中の book。自分の book は bookId = uid(H-4) */
  bookId: string;
  book: WithId<Book> | null;
  /** 参加中の全 book(自分の book を含む) */
  books: WithId<Book>[];
  /** 現在の book のオーナーが自分か */
  isOwner: boolean;
  setCurrentBookId: (bookId: string) => void;
}

const BookContext = createContext<BookState | null>(null);

function storageKey(uid: string): string {
  // 共有端末での uid 混線を防ぐためキーに uid を含める
  return `sokoneko:currentBookId:${uid}`;
}

/** 保存された book ID が参加中リストにあればそれを、無ければ自分の book を返す */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveCurrentBookId(
  books: ReadonlyArray<{ id: string }>,
  storedId: string | null,
  uid: string,
): string {
  if (storedId !== null && books.some((book) => book.id === storedId)) return storedId;
  return uid;
}

export function BookProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const booksQuery = useMemo(
    () => query(collection(db, 'books'), where('memberUids', 'array-contains', uid)),
    [uid],
  );
  const { data: books, loading } = useCollection<Book>(booksQuery);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem(storageKey(uid)),
  );
  // 明示的に選択したがクエリ未反映の book ID。参加直後はスナップショットに参加先が
  // 届くまでラグがあるため、反映までフォールバックで選択を潰さないよう保持する(Issue #7)
  const [pendingId, setPendingId] = useState<string | null>(null);

  // 選択がクエリに反映されたら保留を解除(レンダー中の状態調整パターン)
  if (pendingId !== null && books.some((book) => book.id === pendingId)) {
    setPendingId(null);
  }

  // 反映待ちの選択は books に無くても現在の選択として扱う(uid への一時フォールバックと
  // その localStorage への永続化を防ぐ)。book は null になるが消費側がデフォルト値で吸収する。
  // ロード完了までは保存値(なければ自分の book)を暫定使用し、フォールバック判定しない
  const bookId =
    pendingId ?? (loading ? (selectedId ?? uid) : resolveCurrentBookId(books, selectedId, uid));

  // 退出・削除などで選択中の book が参照不能になったら state もフォールバック先へ揃える
  // (レンダー中の状態調整パターン。effect での setState を避ける)。
  // 反映待ちの選択は消えたのではなくまだ届いていないだけなので揃えない
  if (!loading && pendingId === null && selectedId !== null && selectedId !== bookId) {
    setSelectedId(bookId);
  }

  const setCurrentBookId = useCallback((nextBookId: string) => {
    setSelectedId(nextBookId);
    setPendingId(nextBookId);
  }, []);

  // 選択の永続化(フォールバック時の書き戻しを含む)
  useEffect(() => {
    localStorage.setItem(storageKey(uid), bookId);
  }, [uid, bookId]);

  const book = books.find((candidate) => candidate.id === bookId) ?? null;
  const isOwner = book !== null && book.ownerUid === uid;

  const value = useMemo(
    () => ({ bookId, book, books, isOwner, setCurrentBookId }),
    [bookId, book, books, isOwner, setCurrentBookId],
  );

  return (
    <BookContext.Provider value={value}>
      {/* book 切替時に全購読・画面 state を key 再マウントで張り直す */}
      <Fragment key={bookId}>{children}</Fragment>
    </BookContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBook(): BookState {
  const state = useContext(BookContext);
  if (!state) throw new Error('useBook must be used within BookProvider');
  return state;
}
