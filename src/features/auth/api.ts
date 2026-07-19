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
