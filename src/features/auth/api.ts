import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';

type ProviderUser = { providerData: { providerId: string }[] };

export function hasGoogleProvider(user: ProviderUser): boolean {
  return user.providerData.some((p) => p.providerId === 'google.com');
}

export function hasPasswordProvider(user: ProviderUser): boolean {
  return user.providerData.some((p) => p.providerId === 'password');
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/** Google アカウント連携失敗時のユーザー向けメッセージ */
export function mapLinkGoogleError(error: unknown): Error {
  switch (errorCode(error)) {
    case 'auth/credential-already-in-use':
      return new Error(
        'この Google アカウントは既に別のユーザーで使われています。そのアカウントでログインするか、別の Google を選んでください',
      );
    case 'auth/provider-already-linked':
      return new Error('すでに Google アカウントが連携されています');
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return new Error('連携がキャンセルされました');
    case 'auth/requires-recent-login':
      return new Error(
        'セキュリティのため再認証が必要です。パスワードを入力してから再度お試しください',
      );
    case 'auth/network-request-failed':
      return new Error('ネットワークエラーが発生しました。もう一度お試しください');
    default:
      return new Error('連携に失敗しました。時間をおいて再度お試しください');
  }
}

export function signInWithGoogle(): Promise<unknown> {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function signInWithEmail(email: string, password: string): Promise<unknown> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmail(email: string, password: string): Promise<unknown> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  // アカウント作成後は取り消せないため、送信失敗で signup 全体を reject しない。
  // 未送信でも VerifyEmailScreen の再送ボタンで復帰できる(Issue #15)
  try {
    await sendEmailVerification(credential.user);
  } catch {
    // 送信失敗は無視し、確認待ち画面からの再送に委ねる
  }
  return credential;
}

export function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return Promise.reject(new Error('未ログインです'));
  return sendEmailVerification(user);
}

export async function refreshEmailVerification(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  await user.getIdToken(true);
  return user.emailVerified;
}

export function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(auth);
}
