import { useState } from 'react';
import { ChevronRight, FolderTree, StoreIcon } from 'lucide-react';
import { Link } from 'react-router';
import { signOut } from '../features/auth/api';
import {
  BOTTOM_WINDOW_OPTIONS,
  updateBook,
} from '../features/books/api';
import { useBook } from '../features/books/BookProvider';
import { ShareSettings } from '../features/sharing/ShareSettings';
import { db } from '../lib/firebase';

function SettingsLink({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-sm font-bold last:border-b-0"
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-chevron" />
    </Link>
  );
}

export function SettingsPage() {
  const { bookId, book } = useBook();
  const bookName = book?.name ?? '';
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const name = nameDraft ?? bookName;
  const windowMonths = book?.bottomWindowMonths ?? 6;

  async function handleWindowChange(months: number) {
    await updateBook(db, bookId, { bottomWindowMonths: months });
  }

  async function handleNameSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateBook(db, bookId, { name: trimmed });
    setNameDraft(null);
  }

  return (
    <div>
      <header className="px-4 pt-14 pb-3">
        <h2 className="text-lg font-extrabold">設定</h2>
      </header>

      <section className="mx-4 rounded-2xl bg-surface px-4 py-4">
        <label htmlFor="book-name" className="text-xs font-bold text-ink-faint">
          底値帳の名前
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="book-name"
            value={name}
            onChange={(e) => setNameDraft(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleNameSave}
            className="shrink-0 rounded-xl bg-primary px-4 text-xs font-bold text-white"
          >
            名前を保存
          </button>
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-2xl bg-surface px-4 py-4">
        <div className="text-xs font-bold text-ink-faint">底値の対象期間</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {BOTTOM_WINDOW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleWindowChange(option.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${
                windowMonths === option.value
                  ? 'bg-primary text-white'
                  : 'bg-cream text-ink-sub'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <ShareSettings />

      <div className="mx-4 mt-4 rounded-2xl bg-surface">
        <SettingsLink
          to="/settings/categories"
          label="カテゴリ管理"
          icon={<FolderTree className="size-5" />}
        />
        <SettingsLink
          to="/settings/stores"
          label="店舗管理"
          icon={<StoreIcon className="size-5" />}
        />
      </div>

      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={() => signOut()}
          className="h-12 w-full rounded-2xl border border-chevron bg-surface text-sm font-bold text-sale"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
