import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PickerSheet } from '../../components/PickerSheet';
import { useBook } from '../books/BookProvider';

/** ホームヘッダーの book 切替。参加 book が 1 冊のときは従来のタイトル表示 */
export function BookSwitcher() {
  const { bookId, book, books, setCurrentBookId } = useBook();
  const [open, setOpen] = useState(false);

  if (books.length <= 1) {
    return <h1 className="text-xl font-extrabold tracking-wider text-white">そこねこ</h1>;
  }

  return (
    <>
      <button
        type="button"
        aria-label="底値帳を切り替え"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-1 text-white"
      >
        <h1 className="truncate text-xl font-extrabold tracking-wider">
          {book?.name ?? 'そこねこ'}
        </h1>
        <ChevronDown className="size-5 shrink-0 text-white/90" />
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
