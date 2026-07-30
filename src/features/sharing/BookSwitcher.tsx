import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PickerSheet } from '../../components/PickerSheet';
import { useDesktopLayout } from '../../components/useDesktopLayout';
import { useBook } from '../books/BookProvider';

type Tone = 'onPrimary' | 'onSurface';

const TONE_STYLES: Record<
  Tone,
  { title: string; button: string; chevron: string }
> = {
  onPrimary: {
    title: 'text-xl font-extrabold tracking-wider text-white',
    button: 'flex min-w-0 items-center gap-1 text-white',
    chevron: 'size-5 shrink-0 text-white/90',
  },
  onSurface: {
    title: 'text-lg font-extrabold tracking-wider text-ink',
    button: 'flex min-w-0 items-center gap-1 text-ink',
    chevron: 'size-5 shrink-0 text-ink-sub',
  },
};

/** ホームヘッダーの book 切替。参加 book が 1 冊のときは従来のタイトル表示 */
export function BookSwitcher({ tone = 'onPrimary' }: { tone?: Tone }) {
  const isDesktop = useDesktopLayout();
  const { bookId, book, books, setCurrentBookId } = useBook();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const styles = TONE_STYLES[tone];

  useEffect(() => {
    if (!open || !isDesktop) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, isDesktop]);

  if (books.length <= 1) {
    return <h1 className={styles.title}>そこねこ</h1>;
  }

  const selectBook = (id: string) => {
    setCurrentBookId(id);
    setOpen(false);
  };

  const bookList = (
    <ul
      id={listId}
      role="listbox"
      aria-label="底値帳の候補"
      className={isDesktop ? 'max-h-64 overflow-y-auto' : 'flex flex-col'}
    >
      {books.map((candidate) => {
        const selected = candidate.id === bookId;
        return (
          <li key={candidate.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => selectBook(candidate.id)}
              className={`flex w-full items-center gap-2 border-b border-line text-left text-sm font-bold last:border-b-0 ${
                isDesktop
                  ? `px-4 py-2.5 ${selected ? 'bg-primary/10 text-primary-deep' : 'text-ink hover:bg-line/60'}`
                  : 'px-1 py-3'
              }`}
            >
              <span className="flex-1 truncate">{candidate.name}</span>
              {selected && (
                <span className="flex items-center gap-1 text-xs font-bold text-primary">
                  <Check className="size-4" />
                  選択中
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-label="底値帳を切り替え"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={styles.button}
      >
        <h1 className={`truncate ${styles.title}`}>{book?.name ?? 'そこねこ'}</h1>
        <ChevronDown
          className={`${styles.chevron} transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && isDesktop && (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-30 min-w-56 max-w-80 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-lg shadow-ink/10"
          role="presentation"
        >
          {bookList}
        </div>
      )}

      {open && !isDesktop && (
        <PickerSheet title="底値帳を切り替え" onClose={() => setOpen(false)}>
          {bookList}
        </PickerSheet>
      )}
    </div>
  );
}
