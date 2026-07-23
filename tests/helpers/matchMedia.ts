import { vi } from 'vitest';

export type MatchMediaController = {
  /** 現在の matches を変更し、登録済み listener に MediaQueryListEvent 相当を配信する */
  setMatches: (matches: boolean) => void;
  /** matchMedia の stub だけを外す(他の global stub は残す) */
  restore: () => void;
};

/**
 * jsdom に無い window.matchMedia をスタブする。
 * `@media (min-width: 768px)` 相当のデスクトップ判定テスト用。
 */
export function stubMatchMedia(initialMatches = false): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const previous = window.matchMedia;

  const mql: MediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(min-width: 768px)',
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === 'function') {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  };

  const matchMediaMock = vi.fn(() => mql);
  vi.stubGlobal('matchMedia', matchMediaMock);

  return {
    setMatches: (next) => {
      matches = next;
      const event = { matches: next, media: mql.media } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
      if (typeof mql.onchange === 'function') {
        mql.onchange(event);
      }
    },
    restore: () => {
      if (previous) {
        vi.stubGlobal('matchMedia', previous);
      } else {
        // jsdom 既定では未定義であることが多い
        Reflect.deleteProperty(window, 'matchMedia');
      }
    },
  };
}
