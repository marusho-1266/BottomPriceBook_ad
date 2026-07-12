import { useState, type FormEvent } from 'react';
import { SubPageHeader } from '../../components/SubPageHeader';
import { useBook } from '../books/BookProvider';
import { usePriceRecords } from '../prices/api';
import { addStore, deleteStore, renameStore, useStores } from './api';
import type { Store, WithId } from '../../types/models';

function StoreRow({
  store,
  bookId,
  referenceCount,
}: {
  store: WithId<Store>;
  bookId: string;
  /** この店舗を参照している価格記録数。0 より大きい場合は削除禁止(H-2) */
  referenceCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(store.name);
  const [blocked, setBlocked] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== store.name) {
      await renameStore(bookId, store.id, trimmed);
    }
    setEditing(false);
  };

  const remove = async () => {
    if (referenceCount > 0) {
      setBlocked(true);
      return;
    }
    if (window.confirm(`「${store.name}」を削除しますか?`)) {
      await deleteStore(bookId, store.id);
    }
  };

  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      {editing ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="店舗名を編集"
            className="h-10 min-w-0 flex-1 rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
          />
          <button type="button" onClick={save} className="text-sm font-bold text-primary-deep">
            保存
          </button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">{store.name}</div>
            {blocked && (
              <p role="alert" className="mt-1 text-[11px] font-bold text-sale">
                {referenceCount}件の価格記録が使用中のため削除できません
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setName(store.name);
              setEditing(true);
            }}
            className="text-sm font-bold text-primary-deep"
          >
            編集
          </button>
          <button type="button" onClick={remove} className="text-sm font-bold text-sale">
            削除
          </button>
        </>
      )}
    </li>
  );
}

export function StoresPage() {
  const { bookId } = useBook();
  const { data: stores, loading } = useStores();
  const { data: priceRecords } = usePriceRecords();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('店舗名を入力してください');
      return;
    }
    setError(null);
    await addStore(bookId, trimmed);
    setName('');
  };

  return (
    <div>
      <SubPageHeader title="店舗管理" />
      <form onSubmit={handleAdd} className="mx-4 flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <div>
          <label htmlFor="store-name" className="mb-1 block text-xs font-bold text-ink-sub">
            店舗名
          </label>
          <input
            id="store-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: OKストア 〇〇店"
            className="h-10 w-full rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        {error && (
          <p role="alert" className="text-xs font-bold text-sale">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="h-10 rounded-xl bg-primary text-sm font-extrabold text-white active:bg-primary-deep"
        >
          追加
        </button>
      </form>

      <ul className="mx-4 mt-4 rounded-2xl bg-surface">
        {loading && <li className="px-4 py-3 text-sm text-ink-faint">読み込み中…</li>}
        {stores.map((store) => (
          <StoreRow
            key={store.id}
            store={store}
            bookId={bookId}
            referenceCount={priceRecords.filter((r) => r.storeId === store.id).length}
          />
        ))}
      </ul>
    </div>
  );
}
