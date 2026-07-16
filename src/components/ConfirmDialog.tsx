import { useEffect, useRef } from 'react';

/** 破壊的操作の確認ダイアログ(中央モーダル) */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  confirmDisabled = false,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // 呼び出し側がインライン関数を渡してもフォーカス管理の effect を張り直さないよう ref 経由で参照する
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
    focusables()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      // Tab をダイアログ内に閉じ込める(端で反対端へループ)
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panelRef.current?.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      opener?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md items-center justify-center px-6">
      <div aria-hidden="true" onClick={onCancel} className="absolute inset-0 bg-ink/30" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full rounded-2xl bg-surface p-5"
      >
        <h3 className="text-base font-extrabold">{title}</h3>
        <p className="mt-2 text-sm text-ink-sub">{description}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl bg-cream text-sm font-bold text-ink-sub"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="h-11 flex-1 rounded-xl bg-sale text-sm font-bold text-white disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
