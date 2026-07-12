import type { ReactNode } from 'react';
import { X } from 'lucide-react';

/** 画面下部から出る簡易ピッカー(商品・店舗の選択に使用) */
export function PickerSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-md flex-col justify-end">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div className="relative max-h-[75dvh] overflow-y-auto rounded-t-3xl bg-cream p-4 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold">{title}</h3>
          <button
            type="button"
            aria-label="ピッカーを閉じる"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-line-strong text-ink-sub"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
