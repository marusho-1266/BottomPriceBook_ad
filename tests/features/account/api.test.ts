import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProviderCredential,
  GoogleAuthProvider,
  httpsCallable,
  terminate,
  clearIndexedDbPersistence,
  trackEvent,
} = vi.hoisted(() => ({
  reauthenticateWithCredential: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
  EmailAuthProviderCredential: vi.fn((email: string, password: string) => ({ email, password })),
  GoogleAuthProvider: vi.fn(function GoogleAuthProviderStub(this: unknown) {}),
  httpsCallable: vi.fn(),
  terminate: vi.fn().mockResolvedValue(undefined),
  clearIndexedDbPersistence: vi.fn().mockResolvedValue(undefined),
  trackEvent: vi.fn(),
}));

vi.mock('../../../src/lib/firebase', () => ({ auth: {}, db: {}, functions: {} }));
vi.mock('../../../src/lib/analytics', () => ({ trackEvent }));
vi.mock('firebase/auth', () => ({
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  EmailAuthProvider: { credential: EmailAuthProviderCredential },
}));
vi.mock('firebase/firestore', () => ({ terminate, clearIndexedDbPersistence }));
vi.mock('firebase/functions', () => ({ httpsCallable }));

import { auth } from '../../../src/lib/firebase';
import { AccountDeletionError, deleteAccount, reauthenticate } from '../../../src/features/account/api';
import { storageKey } from '../../../src/features/books/BookProvider';

type MutableAuth = { currentUser: unknown };

describe('reauthenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as MutableAuth).currentUser = null;
  });

  it('未ログインなら AccountDeletionError を投げる', async () => {
    await expect(reauthenticate()).rejects.toBeInstanceOf(AccountDeletionError);
  });

  it('メール/パスワードユーザーはパスワードで再認証する', async () => {
    (auth as MutableAuth).currentUser = {
      email: 'a@example.com',
      providerData: [{ providerId: 'password' }],
    };
    reauthenticateWithCredential.mockResolvedValue(undefined);

    await reauthenticate('secret123');

    expect(EmailAuthProviderCredential).toHaveBeenCalledWith('a@example.com', 'secret123');
    expect(reauthenticateWithCredential).toHaveBeenCalledTimes(1);
  });

  it('メール/パスワードユーザーでパスワード未指定なら AccountDeletionError', async () => {
    (auth as MutableAuth).currentUser = {
      email: 'a@example.com',
      providerData: [{ providerId: 'password' }],
    };

    await expect(reauthenticate()).rejects.toBeInstanceOf(AccountDeletionError);
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it('Google ユーザーはポップアップで再認証する', async () => {
    (auth as MutableAuth).currentUser = {
      email: 'a@example.com',
      providerData: [{ providerId: 'google.com' }],
    };
    reauthenticateWithPopup.mockResolvedValue(undefined);

    await reauthenticate();

    expect(reauthenticateWithPopup).toHaveBeenCalledTimes(1);
  });

  it('パスワード誤りは「パスワードが正しくありません」に変換する', async () => {
    (auth as MutableAuth).currentUser = {
      email: 'a@example.com',
      providerData: [{ providerId: 'password' }],
    };
    reauthenticateWithCredential.mockRejectedValue({ code: 'auth/wrong-password' });

    await expect(reauthenticate('wrong')).rejects.toThrow('パスワードが正しくありません');
  });

  it('ポップアップを閉じた場合は「認証がキャンセルされました」に変換する', async () => {
    (auth as MutableAuth).currentUser = {
      email: 'a@example.com',
      providerData: [{ providerId: 'google.com' }],
    };
    reauthenticateWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    await expect(reauthenticate()).rejects.toThrow('認証がキャンセルされました');
  });

  it('未知のエラーは汎用メッセージに変換する', async () => {
    (auth as MutableAuth).currentUser = {
      email: 'a@example.com',
      providerData: [{ providerId: 'password' }],
    };
    reauthenticateWithCredential.mockRejectedValue({ code: 'auth/unknown-error' });

    await expect(reauthenticate('x')).rejects.toThrow('再認証に失敗しました');
  });
});

describe('deleteAccount', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // jsdom はナビゲーションを実装しないため reload() をスタブする
    reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });
  });

  it('Callable を呼び、成功したら Firestore の永続化キャッシュを消してから currentBookId を localStorage から消し、画面をリロードする', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { ok: true } });
    httpsCallable.mockReturnValue(callable);
    localStorage.setItem(storageKey('uid-1'), 'some-book-id');
    const callOrder: string[] = [];
    terminate.mockImplementation(async () => {
      callOrder.push('terminate');
    });
    clearIndexedDbPersistence.mockImplementation(async () => {
      callOrder.push('clearIndexedDbPersistence');
    });
    reloadSpy.mockImplementation(() => {
      callOrder.push('reload');
    });

    await deleteAccount('uid-1');

    expect(httpsCallable).toHaveBeenCalledWith({}, 'deleteAccount');
    expect(callable).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(clearIndexedDbPersistence).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['terminate', 'clearIndexedDbPersistence', 'reload']);
    expect(localStorage.getItem(storageKey('uid-1'))).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('delete_account');
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('Callable 成功後に terminate が失敗しても localStorage を消してリロードする', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { ok: true } });
    httpsCallable.mockReturnValue(callable);
    localStorage.setItem(storageKey('uid-1'), 'some-book-id');
    terminate.mockRejectedValue(new Error('terminate failed'));

    await deleteAccount('uid-1');

    expect(clearIndexedDbPersistence).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey('uid-1'))).toBeNull();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('delete_account');
  });

  it('失敗時は AccountDeletionError に変換し、キャッシュ消去も localStorage 消去もリロードも行わない', async () => {
    const callable = vi.fn().mockRejectedValue({ code: 'functions/unauthenticated' });
    httpsCallable.mockReturnValue(callable);
    localStorage.setItem(storageKey('uid-1'), 'some-book-id');

    await expect(deleteAccount('uid-1')).rejects.toBeInstanceOf(AccountDeletionError);
    expect(terminate).not.toHaveBeenCalled();
    expect(clearIndexedDbPersistence).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey('uid-1'))).toBe('some-book-id');
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
