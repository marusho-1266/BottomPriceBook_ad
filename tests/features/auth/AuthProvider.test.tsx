import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const listeners: Array<(user: unknown) => void> = [];

vi.mock('../../../src/lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (user: unknown) => void) => {
    listeners.push(cb);
    return () => {};
  }),
}));

import { AuthProvider, useAuth } from '../../../src/features/auth/AuthProvider';
import { act } from 'react';

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `user:${(user as { uid: string }).uid}` : 'signed-out'}</div>;
}

describe('AuthProvider', () => {
  it('認証状態が届くまで loading を返す', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('サインアウト状態が届いたら user=null / loading=false になる', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      listeners.at(-1)!(null);
    });
    expect(screen.getByText('signed-out')).toBeInTheDocument();
  });

  it('サインイン状態が届いたら user を返す', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      listeners.at(-1)!({ uid: 'u1' });
    });
    expect(screen.getByText('user:u1')).toBeInTheDocument();
  });
});
