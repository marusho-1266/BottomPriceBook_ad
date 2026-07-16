/** 破壊的操作の確認ダイアログ(中央モーダル) */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md items-center justify-center px-6">
      <button type="button" aria-label="閉じる" onClick={onCancel} className="absolute inset-0 bg-ink/30" />
      <div role="alertdialog" aria-label={title} className="relative w-full rounded-2xl bg-surface p-5">
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
            className="h-11 flex-1 rounded-xl bg-sale text-sm font-bold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
