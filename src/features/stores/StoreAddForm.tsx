import { useState } from 'react';
import { addStore } from './api';

/**
 * 価格記録画面のピッカー内に置く店舗の簡易追加フォーム。
 * PC のコンボボックスとモバイルのボトムシートの両方から使う。
 */
export function StoreAddForm({ bookId, className }: { bookId: string; className?: string }) {
  const [name, setName] = useState('');

  return (
    <form
      className={`flex gap-2 ${className ?? ''}`}
      onSubmit={async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        await addStore(bookId, trimmed);
        setName('');
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="新しい店舗名"
        aria-label="新しい店舗名"
        className="h-10 min-w-0 flex-1 rounded-xl border border-chevron bg-surface px-3 text-sm outline-none focus:border-primary"
      />
      <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white">
        追加
      </button>
    </form>
  );
}
