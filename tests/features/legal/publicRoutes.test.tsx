import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Array<(user: unknown) => void> = [];

vi.mock('../../../src/lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (user: unknown) => void) => {
    listeners.push(cb);
    return () => {};
  }),
}));
vi.mock('../../../src/features/books/api', () => ({
  ensureBook: vi.fn().mockResolvedValue(undefined),
  DEFAULT_BOTTOM_WINDOW_MONTHS: 6,
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
}));

import { App } from '../../../src/App';
import { act } from 'react';

async function renderAt(path: string) {
  window.history.pushState({}, '', path);
  render(<App />);
  // 未ログイン状態を確定させる
  await act(async () => {
    listeners.at(-1)!(null);
  });
}

describe('公開ルート(認証不要。Issue #14)', () => {
  beforeEach(() => {
    listeners.length = 0;
  });

  it('未ログインで /privacy を開くとプライバシーポリシーが表示される', async () => {
    await renderAt('/privacy');
    expect(
      screen.getByRole('heading', { name: 'プライバシーポリシー' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Google でログイン/ })).not.toBeInTheDocument();
  });

  it('未ログインで /terms を開くと利用規約が表示される', async () => {
    await renderAt('/terms');
    expect(screen.getByRole('heading', { name: '利用規約' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Google でログイン/ })).not.toBeInTheDocument();
  });

  it('未ログインでその他のパスを開くとログイン画面が表示される', async () => {
    await renderAt('/');
    expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeInTheDocument();
  });
});
