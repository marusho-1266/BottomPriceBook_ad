import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { type CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

initializeApp();

setGlobalOptions({ region: 'asia-northeast1' });

export interface DeleteAccountResult {
  ok: true;
}

// Issue #13: アカウント削除(退会)。本体は I13-T2 で実装する。
// uid は request.auth からのみ取得し、引数では受け取らない(他人のデータ削除を構造的に防ぐ)。
// onCall のラッパーから分離することで、エミュレータなしにハンドラ単体をテストできる。
export function handleDeleteAccount(request: CallableRequest): DeleteAccountResult {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'ログインが必要です');
  }

  return { ok: true };
}

export const deleteAccount = onCall(handleDeleteAccount);
