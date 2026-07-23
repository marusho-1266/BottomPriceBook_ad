import { useRegisterSW } from 'virtual:pwa-register/react';

/** 新ビルド配信時に更新を促す(L-3: prompt 方式) */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      data-testid="pwa-update-prompt"
      className="fixed inset-x-0 bottom-24 z-20 mx-auto max-w-md px-4 md:bottom-6 md:max-w-lg"
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg">
        <p className="text-xs font-bold">新しいバージョンがあります</p>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          更新する
        </button>
      </div>
    </div>
  );
}
