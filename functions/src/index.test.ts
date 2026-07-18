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

function requestWithAuthTime(uid: string, authTimeSecondsAgo: number | undefined): CallableRequest {
  const auth_time =
    authTimeSecondsAgo === undefined ? undefined : Date.now() / 1000 - authTimeSecondsAgo;
  return { auth: { uid, token: { auth_time } } } as unknown as CallableRequest;
}

test('直近に再認証済み(auth_time が新しい)なら { ok: true } を返す(削除対象データなし)', async () => {
  const request = requestWithAuthTime('index-test-uid-no-data', 60);

  const result = await handleDeleteAccount(request);

  assert.deepEqual(result, { ok: true });
});

test('auth_time が古い(5 分超)場合は unauthenticated エラーになり削除を実行しない', async () => {
  const request = requestWithAuthTime('index-test-uid-stale-auth', 10 * 60);

  await assert.rejects(
    () => handleDeleteAccount(request),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'unauthenticated' &&
      error.message === '再認証してからもう一度お試しください',
  );
});

test('auth_time が無い場合は unauthenticated エラーになる', async () => {
  const request = requestWithAuthTime('index-test-uid-no-auth-time', undefined);

  await assert.rejects(
    () => handleDeleteAccount(request),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'unauthenticated' &&
      error.message === '再認証してからもう一度お試しください',
  );
});
