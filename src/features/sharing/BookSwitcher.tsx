import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PickerSheet } from '../../components/PickerSheet';
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
  const { bookId, book, books, setCurrentBookId } = useBook();
  const [open, setOpen] = useState(false);
  const styles = TONE_STYLES[tone];

  if (books.length <= 1) {
    return <h1 className={styles.title}>そこねこ</h1>;
  }

  return (
    <>
      <button
        type="button"
        aria-label="底値帳を切り替え"
        onClick={() => setOpen(true)}
        className={styles.button}
      >
        <h1 className={`truncate ${styles.title}`}>{book?.name ?? 'そこねこ'}</h1>
        <ChevronDown className={styles.chevron} />
      </button>
      {open && (
        <PickerSheet title="底値帳を切り替え" onClose={() => setOpen(false)}>
          <ul className="flex flex-col">
            {books.map((candidate) => {
              const selected = candidate.id === bookId;
              return (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentBookId(candidate.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 border-b border-line px-1 py-3 text-left text-sm font-bold last:border-b-0"
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
        </PickerSheet>
      )}
    </>
  );
}
