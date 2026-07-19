import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Array<(user: unknown) => void> = [];

vi.mock('../src/lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (user: unknown) => void) => {
    listeners.push(cb);
    return () => {};
  }),
}));
vi.mock('../src/features/books/api', () => ({
  ensureBook: vi.fn().mockResolvedValue(undefined),
  DEFAULT_BOTTOM_WINDOW_MONTHS: 6,
}));
vi.mock('../src/features/auth/api', () => ({
  refreshEmailVerification: vi.fn(),
  resendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
  Timestamp: { fromDate: vi.fn(() => ({})) },
}));

import { App } from '../src/App';
import { ensureBook } from '../src/features/books/api';
import { refreshEmailVerification } from '../src/features/auth/api';
import { act } from 'react';

describe('App(認証ガード)', () => {
  beforeEach(() => {
    vi.mocked(ensureBook).mockClear();
    vi.mocked(refreshEmailVerification).mockReset();
  });

  it('未ログインならログイン画面を表示する', async () => {
    render(<App />);
    await act(async () => {
      listeners.at(-1)!(null);
    });
    expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeInTheDocument();
  });

  it('ログイン済み(確認済み)なら book を初期化してアプリ本体を表示する', async () => {
    render(<App />);
    await act(async () => {
      listeners.at(-1)!({ uid: 'u1', emailVerified: true });
    });
    expect(await screen.findByRole('heading', { name: 'そこねこ' })).toBeInTheDocument();
  });

  it('メール未確認なら確認待ち画面を表示し、book を初期化しない(Issue #15)', async () => {
    render(<App />);
    await act(async () => {
      listeners.at(-1)!({ uid: 'u2', email: 'unverified@example.com', emailVerified: false });
    });
    expect(await screen.findByText(/unverified@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '確認しました' })).toBeInTheDocument();
    expect(ensureBook).not.toHaveBeenCalled();
  });

  it('未確認ユーザーが確認を完了すると book を初期化してアプリ本体を表示する(Issue #15)', async () => {
    vi.mocked(refreshEmailVerification).mockResolvedValue(true);
    const user = userEvent.setup();
    render(<App />);
    await act(async () => {
      listeners.at(-1)!({ uid: 'u3', email: 'newlyverified@example.com', emailVerified: false });
    });
    expect(await screen.findByText(/newlyverified@example.com/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '確認しました' }));

    expect(await screen.findByRole('heading', { name: 'そこねこ' })).toBeInTheDocument();
    expect(ensureBook).toHaveBeenCalledWith(expect.anything(), 'u3', expect.any(String));
  });
});
