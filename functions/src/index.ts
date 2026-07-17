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

// Issue #13: アカウント削除(退会)。
// uid は request.auth からのみ取得し、引数では受け取らない(他人のデータ削除を構造的に防ぐ)。
// onCall のラッパーから分離することで、エミュレータなしにハンドラ単体をテストできる。
export async function handleDeleteAccount(request: CallableRequest): Promise<DeleteAccountResult> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'ログインが必要です');
  }

  await runDeleteAccount(request.auth.uid, { firestore: getFirestore(), auth: getAuth() });

  return { ok: true };
}

export const deleteAccount = onCall(handleDeleteAccount);
