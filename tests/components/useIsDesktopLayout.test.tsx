import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIsDesktopLayout } from '../../src/components/useIsDesktopLayout';
import { stubMatchMedia } from '../helpers/matchMedia';

describe('useIsDesktopLayout', () => {
  it('768px 相当(matches=true)で true を返す', () => {
    const media = stubMatchMedia(true);
    const { result } = renderHook(() => useIsDesktopLayout());
    expect(result.current).toBe(true);
    media.restore();
  });

  it('768px 未満(matches=false)で false を返す', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useIsDesktopLayout());
    expect(result.current).toBe(false);
    media.restore();
  });

  it('change イベントで更新される', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useIsDesktopLayout());
    expect(result.current).toBe(false);

    act(() => {
      media.setMatches(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      media.setMatches(false);
    });
    expect(result.current).toBe(false);

    media.restore();
  });
});
