import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
}));

import { App } from '../src/App';
import { act } from 'react';

describe('App(認証ガード)', () => {
  it('未ログインならログイン画面を表示する', async () => {
    render(<App />);
    await act(async () => {
      listeners.at(-1)!(null);
    });
    expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeInTheDocument();
  });

  it('ログイン済みなら book を初期化してアプリ本体を表示する', async () => {
    render(<App />);
    await act(async () => {
      listeners.at(-1)!({ uid: 'u1' });
    });
    expect(await screen.findByRole('heading', { name: 'そこねこ' })).toBeInTheDocument();
  });
});
