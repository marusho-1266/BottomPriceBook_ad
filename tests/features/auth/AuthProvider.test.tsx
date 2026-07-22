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

import { auth } from '../../../src/lib/firebase';
import { AuthProvider, useAuth } from '../../../src/features/auth/AuthProvider';
import { act } from 'react';

type MutableAuth = {
  currentUser: { uid: string; reload: ReturnType<typeof vi.fn>; providerData?: unknown[] } | null;
};

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? `user:${(user as { uid: string }).uid}` : 'signed-out'}</div>;
}

function RefreshProbe() {
  const { user, loading, refreshUser } = useAuth();
  if (loading) return <div>loading</div>;
  const providers =
    user && 'providerData' in user
      ? (user.providerData as { providerId: string }[]).map((p) => p.providerId).join(',')
      : '';
  return (
    <div>
      <span>{user ? `user:${(user as { uid: string }).uid}:${providers}` : 'signed-out'}</span>
      <button type="button" onClick={() => void refreshUser()}>
        refresh
      </button>
    </div>
  );
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

  it('refreshUser は reload 後に最新の providerData を反映する', async () => {
    const reload = vi.fn().mockImplementation(async () => {
      (auth as MutableAuth).currentUser = {
        uid: 'u1',
        reload,
        providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
      };
    });
    (auth as MutableAuth).currentUser = {
      uid: 'u1',
      reload,
      providerData: [{ providerId: 'password' }],
    };

    render(
      <AuthProvider>
        <RefreshProbe />
      </AuthProvider>,
    );
    await act(async () => {
      listeners.at(-1)!((auth as MutableAuth).currentUser);
    });
    expect(screen.getByText('user:u1:password')).toBeInTheDocument();

    await act(async () => {
      await screen.getByRole('button', { name: 'refresh' }).click();
    });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByText('user:u1:password,google.com')).toBeInTheDocument();
  });
});
