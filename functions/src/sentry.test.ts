import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

delete process.env.SENTRY_DSN;
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
