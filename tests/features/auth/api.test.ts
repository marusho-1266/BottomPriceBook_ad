import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
}));

vi.mock('../../../src/lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(function GoogleAuthProviderStub(this: unknown) {}),
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
}));

import { auth } from '../../../src/lib/firebase';
import {
  refreshEmailVerification,
  resendVerificationEmail,
  signUpWithEmail,
} from '../../../src/features/auth/api';

type MutableAuth = { currentUser: unknown };

describe('signUpWithEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('登録成功後に確認メールを送信する', async () => {
    const user = { uid: 'u1' };
    createUserWithEmailAndPassword.mockResolvedValue({ user });
    sendEmailVerification.mockResolvedValue(undefined);

    await signUpWithEmail('a@example.com', 'password1');

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'a@example.com', 'password1');
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });

  it('登録に失敗したら確認メールは送信しない', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });

    await expect(signUpWithEmail('a@example.com', 'password1')).rejects.toBeTruthy();
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it('確認メール送信が失敗しても signup 自体は成功する(Issue #15)', async () => {
    const user = { uid: 'u1' };
    createUserWithEmailAndPassword.mockResolvedValue({ user });
    sendEmailVerification.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(signUpWithEmail('a@example.com', 'password1')).resolves.toEqual({ user });
    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });
});

describe('resendVerificationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as MutableAuth).currentUser = null;
  });

  it('未ログインなら送信せず reject する', async () => {
    await expect(resendVerificationEmail()).rejects.toBeTruthy();
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it('ログイン中なら現在のユーザーに確認メールを再送する', async () => {
    const user = { uid: 'u1' };
    (auth as MutableAuth).currentUser = user;
    sendEmailVerification.mockResolvedValue(undefined);

    await resendVerificationEmail();

    expect(sendEmailVerification).toHaveBeenCalledWith(user);
  });
});

describe('refreshEmailVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as MutableAuth).currentUser = null;
  });

  it('未ログインなら false を返す', async () => {
    await expect(refreshEmailVerification()).resolves.toBe(false);
  });

  it('reload とトークンの強制更新を行い、emailVerified を返す(true)', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const getIdToken = vi.fn().mockResolvedValue('token');
    (auth as MutableAuth).currentUser = { uid: 'u1', emailVerified: true, reload, getIdToken };

    const result = await refreshEmailVerification();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(result).toBe(true);
  });

  it('確認未完了の場合は false を返す', async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const getIdToken = vi.fn().mockResolvedValue('token');
    (auth as MutableAuth).currentUser = { uid: 'u1', emailVerified: false, reload, getIdToken };

    const result = await refreshEmailVerification();

    expect(result).toBe(false);
  });
});
