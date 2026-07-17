import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { type CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { runDeleteAccount } from './deleteAccount.js';

initializeApp();

setGlobalOptions({ region: 'asia-northeast1' });

export interface DeleteAccountResult {
  ok: true;
}

// クライアントは deleteAccount 呼び出し前に必ず reauthenticate() を行うが、それは
// UI 側の制御に過ぎない。有効期限内の ID トークンを盗用・使い回されただけで
// 直近の再認証を経ていない呼び出しからも削除できてしまわないよう、
// トークンの auth_time(直近サインイン時刻)をサーバー側でも検証する
const MAX_AUTH_AGE_SECONDS = 5 * 60;

// Issue #13: アカウント削除(退会)。
// uid は request.auth からのみ取得し、引数では受け取らない(他人のデータ削除を構造的に防ぐ)。
// onCall のラッパーから分離することで、エミュレータなしにハンドラ単体をテストできる。
export async function handleDeleteAccount(request: CallableRequest): Promise<DeleteAccountResult> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'ログインが必要です');
  }

  const authTime = request.auth.token.auth_time;
  const ageSeconds = typeof authTime === 'number' ? Date.now() / 1000 - authTime : Infinity;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
    throw new HttpsError('unauthenticated', '再認証してからもう一度お試しください');
  }

  await runDeleteAccount(request.auth.uid, { firestore: getFirestore(), auth: getAuth() });

  return { ok: true };
}

export const deleteAccount = onCall(handleDeleteAccount);
