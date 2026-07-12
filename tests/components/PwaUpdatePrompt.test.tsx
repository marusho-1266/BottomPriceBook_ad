import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const updateServiceWorker = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true],
    offlineReady: [false],
    updateServiceWorker,
  }),
}));

import { PwaUpdatePrompt } from '../../src/components/PwaUpdatePrompt';

describe('PwaUpdatePrompt', () => {
  it('更新が必要なときプロンプトを表示する', () => {
    render(<PwaUpdatePrompt />);
    expect(screen.getByTestId('pwa-update-prompt')).toBeInTheDocument();
    expect(screen.getByText('新しいバージョンがあります')).toBeInTheDocument();
  });

  it('更新ボタンで Service Worker を更新する', async () => {
    const user = userEvent.setup();
    render(<PwaUpdatePrompt />);
    await user.click(screen.getByRole('button', { name: '更新する' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
