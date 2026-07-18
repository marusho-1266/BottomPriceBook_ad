import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { HttpsError } from 'firebase-functions/v2/https';

delete process.env.SENTRY_DSN;
delete process.env.FUNCTIONS_EMULATOR;
const { initSentry, isSentryInitialized, sentryClient, withSentry } = await import('./sentry.js');

afterEach(() => {
  sentryClient.captureException = (error: unknown) => {
    void error;
  };
  sentryClient.flush = async () => true;
});

test('SENTRY_DSN 未設定なら initSentry は初期化しない', () => {
  initSentry();
  assert.equal(isSentryInitialized(), false);
});

test('FUNCTIONS_EMULATOR=true のときは SENTRY_DSN があっても初期化しない', () => {
  process.env.SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
  process.env.FUNCTIONS_EMULATOR = 'true';
  try {
    initSentry();
    assert.equal(isSentryInitialized(), false);
  } finally {
    delete process.env.SENTRY_DSN;
    delete process.env.FUNCTIONS_EMULATOR;
  }
});

test('未初期化のまま withSentry を使っても例外は再スローされる(no-op)', async () => {
  const boom = new Error('boom');
  const handler = withSentry(async () => {
    throw boom;
  });

  await assert.rejects(() => handler(), boom);
});

test('未初期化なら captureException / flush は呼ばれない', async () => {
  let captureCalled = false;
  let flushCalled = false;
  sentryClient.captureException = () => {
    captureCalled = true;
  };
  sentryClient.flush = async () => {
    flushCalled = true;
    return true;
  };

  const handler = withSentry(async () => {
    throw new Error('boom');
  });
  await assert.rejects(() => handler());

  assert.equal(captureCalled, false);
  assert.equal(flushCalled, false);
});

test('成功時は captureException / flush を呼ばず、戻り値をそのまま返す', async () => {
  let captureCalled = false;
  sentryClient.captureException = () => {
    captureCalled = true;
  };

  const handler = withSentry(async (x: number) => x * 2);
  const result = await handler(21);

  assert.equal(result, 42);
  assert.equal(captureCalled, false);
});

test('DSN 設定後に初期化されると、例外時に capture してから flush し、例外を再スローする', async () => {
  process.env.SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
  initSentry();
  assert.equal(isSentryInitialized(), true);

  const calls: string[] = [];
  let capturedError: unknown;
  sentryClient.captureException = (error: unknown) => {
    capturedError = error;
    calls.push('capture');
  };
  sentryClient.flush = async () => {
    calls.push('flush');
    return true;
  };

  const boom = new Error('boom');
  const handler = withSentry(async () => {
    throw boom;
  });

  await assert.rejects(() => handler(), boom);
  assert.deepEqual(calls, ['capture', 'flush']);
  assert.equal(capturedError, boom);
});

test('初期化済みでも HttpsError は capture せず、そのまま再スローする', async () => {
  process.env.SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
  initSentry();
  assert.equal(isSentryInitialized(), true);

  let captureCalled = false;
  sentryClient.captureException = () => {
    captureCalled = true;
  };

  const authError = new HttpsError('unauthenticated', 'ログインが必要です');
  const handler = withSentry(async () => {
    throw authError;
  });

  await assert.rejects(() => handler(), authError);
  assert.equal(captureCalled, false);
});

test('captureException / flush が失敗しても、元の例外がそのまま再スローされる', async () => {
  process.env.SENTRY_DSN = 'https://example@o0.ingest.sentry.io/0';
  initSentry();
  assert.equal(isSentryInitialized(), true);

  sentryClient.captureException = () => {
    throw new Error('sentry capture failed');
  };
  sentryClient.flush = async () => {
    throw new Error('sentry flush failed');
  };

  const boom = new Error('boom');
  const handler = withSentry(async () => {
    throw boom;
  });

  await assert.rejects(() => handler(), boom);
});
