import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.hoisted(() => vi.fn());

vi.mock('@sentry/react', () => ({
  init: initMock,
}));

describe('initSentry', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    initMock.mockClear();
    vi.stubEnv('VITE_SENTRY_DSN', '');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.assign(import.meta.env, originalEnv);
  });

  it('DSN が未設定なら Sentry を初期化しない', async () => {
    const { initSentry } = await import('../../src/lib/sentry');
    initSentry();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('エミュレータ利用時は DSN が設定されていても初期化しない', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.ingest.sentry.io/1');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'true');
    const { initSentry } = await import('../../src/lib/sentry');
    initSentry();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('DSN が設定されていれば PII を送信しない設定で初期化する', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.ingest.sentry.io/1');
    const { initSentry } = await import('../../src/lib/sentry');
    initSentry();
    expect(initMock).toHaveBeenCalledTimes(1);
    const options = initMock.mock.calls[0][0];
    expect(options.dsn).toBe('https://example.ingest.sentry.io/1');
    expect(options.sendDefaultPii).toBe(false);
    expect(options.environment).toBe('production');
  });

  it('beforeSend がイベント中のメールアドレスをマスクする', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.ingest.sentry.io/1');
    const { initSentry } = await import('../../src/lib/sentry');
    initSentry();
    const options = initMock.mock.calls[0][0];
    const event = {
      message: 'failed for user taro@example.com during checkout',
      extra: { note: 'contact: taro@example.com' },
    };
    const result = options.beforeSend(event);
    expect(result.message).not.toContain('taro@example.com');
    expect(JSON.stringify(result)).not.toContain('taro@example.com');
  });
});
