import { useRef, useState } from 'react';
import { ONBOARDING_SLIDES } from './content';

/**
 * アプリの主要機能を紹介するスライド式ウォークスルー。誤操作防止のため
 * ConfirmDialog と異なり Escape・背景タップでは閉じない(仕様前提10)
 */
export function OnboardingModal({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const slide = ONBOARDING_SLIDES[pageIndex];
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === ONBOARDING_SLIDES.length - 1;
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md items-center justify-center px-6">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/30" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="アプリの使い方"
        className="relative w-full rounded-2xl bg-surface p-5"
      >
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={onSkip} className="text-xs font-bold text-ink-faint">
            スキップ
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-primary-light/30 text-primary">
            <Icon className="size-8" />
          </span>
          <h3 className="mt-4 text-base font-extrabold">{slide.title}</h3>
          <p className="mt-2 text-sm text-ink-sub">{slide.description}</p>
        </div>

        <div className="mt-5 flex justify-center gap-1.5">
          {ONBOARDING_SLIDES.map((s, i) => (
            <span
              key={s.title}
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                i === pageIndex ? 'bg-primary' : 'bg-line-strong'
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={() => setPageIndex((i) => i - 1)}
              className="h-11 flex-1 rounded-xl bg-cream text-sm font-bold text-ink-sub"
            >
              戻る
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              onClick={onComplete}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-white"
            >
              はじめる
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPageIndex((i) => i + 1)}
              className="h-11 flex-1 rounded-xl bg-primary text-sm font-bold text-white"
            >
              次へ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
