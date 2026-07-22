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
  hasGoogleProvider,
  hasPasswordProvider,
  mapLinkGoogleError,
  refreshEmailVerification,
  resendVerificationEmail,
  signUpWithEmail,
} from '../../../src/features/auth/api';

type MutableAuth = { currentUser: unknown };

describe('hasGoogleProvider / hasPasswordProvider', () => {
  it('providerData に google.com があれば true', () => {
    expect(hasGoogleProvider({ providerData: [{ providerId: 'google.com' }] })).toBe(true);
    expect(hasGoogleProvider({ providerData: [{ providerId: 'password' }] })).toBe(false);
  });

  it('providerData に password があれば true', () => {
    expect(hasPasswordProvider({ providerData: [{ providerId: 'password' }] })).toBe(true);
    expect(hasPasswordProvider({ providerData: [{ providerId: 'google.com' }] })).toBe(false);
  });

  it('両方ある場合はどちらも true', () => {
    const user = {
      providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
    };
    expect(hasPasswordProvider(user)).toBe(true);
    expect(hasGoogleProvider(user)).toBe(true);
  });
});

describe('mapLinkGoogleError', () => {
  it.each([
    [
      'auth/credential-already-in-use',
      'この Google アカウントは既に別のユーザーで使われています。そのアカウントでログインするか、別の Google を選んでください',
    ],
    ['auth/provider-already-linked', 'すでに Google アカウントが連携されています'],
    ['auth/popup-closed-by-user', '連携がキャンセルされました'],
    ['auth/cancelled-popup-request', '連携がキャンセルされました'],
    [
      'auth/requires-recent-login',
      'セキュリティのため再認証が必要です。パスワードを入力してから再度お試しください',
    ],
    [
      'auth/network-request-failed',
      'ネットワークエラーが発生しました。もう一度お試しください',
    ],
    ['auth/unknown', '連携に失敗しました。時間をおいて再度お試しください'],
  ] as const)('%s を日本語メッセージに変換する', (code, message) => {
    expect(mapLinkGoogleError({ code }).message).toBe(message);
  });
});

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
