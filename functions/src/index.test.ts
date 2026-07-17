import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { handleDeleteAccount } from './index.js';

test('未認証の呼び出しは unauthenticated エラーになる', () => {
  const request = { auth: undefined } as unknown as CallableRequest;

  assert.throws(() => handleDeleteAccount(request), (error: unknown) => {
    return error instanceof Error && 'code' in error && error.code === 'unauthenticated';
  });
});

test('認証済みの呼び出しは { ok: true } を返す', () => {
  const request = {
    auth: { uid: 'test-uid', token: {} },
  } as unknown as CallableRequest;

  const result = handleDeleteAccount(request);

  assert.deepEqual(result, { ok: true });
});
