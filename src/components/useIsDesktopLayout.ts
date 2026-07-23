import { useEffect, useState } from 'react';

/** Tailwind md 相当。タブレットを PC 寄りに扱う(Issue #32) */
export const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

/**
 * Tailwind md(768px) 以上を PC レイアウトとみなす。
 * matchMedia を購読し、リサイズに追従する。User-Agent は使わない。
 */
export function useIsDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
