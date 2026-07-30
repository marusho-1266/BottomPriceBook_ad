import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';

export type ComboboxOption = {
  id: string;
  label: string;
};

type SearchableComboboxProps = {
  /** フィールド左の短いラベル(商品 / 店舗) */
  fieldLabel: string;
  options: ComboboxOption[];
  selectedId: string | null;
  selectedLabel: string | null;
  onSelect: (id: string) => void;
  /** 開閉が変わったとき(外側クリック・Escape・選択後など) */
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** 開いているときリスト下部に出す領域(新規登録など) */
  children?: ReactNode;
};

function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((opt) => opt.label.toLowerCase().includes(q));
}

/**
 * デスクトップ向けの検索つきコンボボックス。
 * ボトムシートではなくフィールド直下に候補を出し、商品数が多い場合の絞り込みに使う。
 */
export function SearchableCombobox({
  fieldLabel,
  options,
  selectedId,
  selectedLabel,
  onSelect,
  onOpenChange,
  placeholder = '選択してください',
  searchPlaceholder = '検索...',
  emptyText = '該当する項目がありません',
  children,
}: SearchableComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = filterOptions(options, query);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const setOpenState = (next: boolean) => {
    setOpen(next);
    onOpenChangeRef.current?.(next);
    if (!next) setQuery('');
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
        onOpenChangeRef.current?.(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const openList = () => {
    setOpenState(true);
    setQuery('');
  };

  const closeList = () => {
    setOpenState(false);
  };

  const choose = (id: string) => {
    onSelect(id);
    closeList();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeList();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (filtered.length === 0) return;
      setActiveIndex((i) => (i + 1) % filtered.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open || filtered.length === 0) return;
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const active = filtered[activeIndex];
      if (open && active) choose(active.id);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`flex items-center gap-2.5 rounded-2xl border-[1.5px] bg-surface px-3.5 py-2.5 ${
          open ? 'border-primary' : 'border-line-strong'
        }`}
      >
        <span className="min-w-8 shrink-0 text-[11px] font-bold text-ink-faint">{fieldLabel}</span>
        {open ? (
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              filtered[activeIndex] ? `${listId}-option-${filtered[activeIndex].id}` : undefined
            }
            aria-label={`${fieldLabel}を検索`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:font-medium placeholder:text-ink-faint"
          />
        ) : (
          <button
            type="button"
            onClick={openList}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-expanded={false}
            aria-haspopup="listbox"
            aria-label={`${fieldLabel}を選択`}
          >
            <span
              className={`flex-1 truncate text-sm font-bold ${
                selectedLabel ? 'text-ink' : 'text-ink-faint'
              }`}
            >
              {selectedLabel ?? placeholder}
            </span>
          </button>
        )}
        <button
          type="button"
          aria-label={open ? `${fieldLabel}の候補を閉じる` : `${fieldLabel}の候補を開く`}
          onClick={() => (open ? closeList() : openList())}
          className="shrink-0 text-chevron"
        >
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-lg shadow-ink/10"
          role="presentation"
        >
          <ul
            id={listId}
            role="listbox"
            aria-label={`${fieldLabel}の候補`}
            className="max-h-56 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-ink-faint">{emptyText}</li>
            ) : (
              filtered.map((opt, index) => {
                const active = index === activeIndex;
                const selected = opt.id === selectedId;
                return (
                  <li key={opt.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-option-${opt.id}`}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(opt.id)}
                      className={`w-full border-b border-line px-4 py-2.5 text-left text-sm font-bold last:border-b-0 ${
                        active ? 'bg-primary/10 text-primary-deep' : 'text-ink'
                      } ${selected ? 'text-primary-deep' : ''}`}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {children ? <div className="border-t border-line-strong p-3">{children}</div> : null}
        </div>
      )}
    </div>
  );
}
