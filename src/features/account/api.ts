import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../../lib/firebase';
import { trackEvent } from '../../lib/analytics';
import {
  AUTH_NETWORK_ERROR_MESSAGE,
  firebaseAuthErrorCode,
} from '../../lib/firebaseAuthError';
import { storageKey } from '../books/BookProvider';
import { hasGoogleProvider, hasPasswordProvider } from '../auth/api';

export class AccountDeletionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AccountDeletionError';
  }
}

function mapReauthenticateError(error: unknown): AccountDeletionError {
  switch (firebaseAuthErrorCode(error)) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return new AccountDeletionError('パスワードが正しくありません', { cause: error });
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return new AccountDeletionError('認証がキャンセルされました', { cause: error });
    case 'auth/network-request-failed':
      return new AccountDeletionError(AUTH_NETWORK_ERROR_MESSAGE, { cause: error });
    default:
      return new AccountDeletionError('再認証に失敗しました。もう一度お試しください', {
        cause: error,
      });
  }
}

function mapDeleteAccountError(error: unknown): AccountDeletionError {
  switch (firebaseAuthErrorCode(error)) {
    case 'functions/unauthenticated':
      return new AccountDeletionError('再度ログインしてからお試しください', { cause: error });
    default:
      return new AccountDeletionError(
        '削除に失敗しました。しばらくしてからもう一度お試しください',
        { cause: error },
      );
  }
}

/**
 * 削除前の再認証。password プロバイダがあればパスワード必須、
 * なければ Google 再ポップアップ。両方ある場合はパスワードを優先する
 * (`providerData[0]` の並び順に依存しない)
 */
export async function reauthenticate(password?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new AccountDeletionError('ログインしていません');
  }

  try {
    if (hasPasswordProvider(user)) {
      if (!password) {
        throw new AccountDeletionError('パスワードを入力してください');
      }
      const credential = EmailAuthProvider.credential(user.email ?? '', password);
      await reauthenticateWithCredential(user, credential);
      return;
    }

    if (hasGoogleProvider(user)) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      return;
    }

    throw new AccountDeletionError('再認証に失敗しました。もう一度お試しください');
  } catch (error) {
    if (error instanceof AccountDeletionError) throw error;
    throw mapReauthenticateError(error);
  }
}

/**
 * deleteAccount Callable を呼び出す。成功時は端末に残るデータを消す:
 * Firestore のオフライン永続化(IndexedDB)には削除済みアカウントのデータが
 * キャッシュされたまま残るため、共有・貸出端末での漏洩を防ぐため消去し、
 * 続けて現在の book 選択も端末から消す。
 * `terminate(db)` はアプリ全体で共有しているモジュールシングルトンの
 * Firestore クライアントを以後使用不能にするため、最後に画面を
 * ハードリロードして新しいインスタンスで再初期化させる
 * (リロードしないと、同一タブでの以後の Firestore 操作がすべて失敗する)
 */
export async function deleteAccount(uid: string): Promise<void> {
  try {
    const call = httpsCallable(functions, 'deleteAccount');
    await call();
    void trackEvent('delete_account');
  } catch (error) {
    throw mapDeleteAccountError(error);
  }

  // この時点で Callable は成功しており Auth ユーザーは既に削除済みのため、
  // 以降のキャッシュ消去が失敗してもエラー扱いにはせず、
  // localStorage 消去とリロードは必ず実行する
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // 端末側のキャッシュ消去に失敗しても致命的ではないため無視する
  } finally {
    localStorage.removeItem(storageKey(uid));
    window.location.reload();
  }
}
