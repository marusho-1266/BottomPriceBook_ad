import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useDoc } from '../../lib/firestoreHooks';
import type { Book, WithId } from '../../types/models';

interface BookState {
  /** MVP では bookId = uid */
  bookId: string;
  book: WithId<Book> | null;
}

const BookContext = createContext<BookState | null>(null);

export function BookProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const bookRef = useMemo(() => doc(db, 'books', uid), [uid]);
  const { data: book } = useDoc<Book>(bookRef);

  return <BookContext.Provider value={{ bookId: uid, book }}>{children}</BookContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBook(): BookState {
  const state = useContext(BookContext);
  if (!state) throw new Error('useBook must be used within BookProvider');
  return state;
}
