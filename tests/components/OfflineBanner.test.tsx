import { render, screen, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OfflineBanner } from '../../src/components/OfflineBanner';

describe('OfflineBanner', () => {
  it('オンライン時は表示しない', () => {
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('オフライン時にバナーを表示する', () => {
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('offline-banner')).toHaveTextContent('オフラインです');
  });

  it('オンライン復帰でバナーを隠す', () => {
    render(<OfflineBanner />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
});
