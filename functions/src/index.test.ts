import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CallableRequest } from 'firebase-functions/v2/https';

// index.ts はモジュール読み込み時に initializeApp()(既定アプリ)を呼ぶ。
// deleteAccount 本体は Firestore/Auth の Admin SDK を実際に叩くため、
// 本番プロジェクトへ誤接続しないよう import 前にエミュレータ接続先を固定する。
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'demo-sokoneko';

const { handleDeleteAccount } = await import('./index.js');

test('未認証の呼び出しは unauthenticated エラーになる', async () => {
  const request = { auth: undefined } as unknown as CallableRequest;

  await assert.rejects(
    () => handleDeleteAccount(request),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'unauthenticated',
  );
});

test('認証済みの呼び出しは { ok: true } を返す(削除対象データなし)', async () => {
  const request = {
    auth: { uid: 'index-test-uid-no-data', token: {} },
  } as unknown as CallableRequest;

  const result = await handleDeleteAccount(request);

  assert.deepEqual(result, { ok: true });
});
