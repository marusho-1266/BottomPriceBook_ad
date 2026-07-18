import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeAppCheckMock = vi.hoisted(() => vi.fn());
const ReCaptchaV3ProviderMock = vi.hoisted(() =>
  vi.fn(function ReCaptchaV3Provider(siteKey: string) {
    return { siteKey };
  }),
);

vi.mock('firebase/app-check', () => ({
  initializeAppCheck: initializeAppCheckMock,
  ReCaptchaV3Provider: ReCaptchaV3ProviderMock,
}));

vi.mock('../../src/lib/firebase', () => ({
  app: { name: 'test-app' },
}));

describe('initAppCheck', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    initializeAppCheckMock.mockClear();
    ReCaptchaV3ProviderMock.mockClear();
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.assign(import.meta.env, originalEnv);
  });

  it('サイトキーが未設定なら App Check を初期化しない', async () => {
    const { initAppCheck } = await import('../../src/lib/appCheck');
    initAppCheck();
    expect(initializeAppCheckMock).not.toHaveBeenCalled();
  });

  it('エミュレータ利用時はサイトキーが設定されていても初期化しない', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key-123');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'true');
    const { initAppCheck } = await import('../../src/lib/appCheck');
    initAppCheck();
    expect(initializeAppCheckMock).not.toHaveBeenCalled();
  });

  it('サイトキーが設定されていれば reCAPTCHA v3 プロバイダで初期化する', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key-123');
    const { initAppCheck } = await import('../../src/lib/appCheck');
    initAppCheck();
    expect(ReCaptchaV3ProviderMock).toHaveBeenCalledWith('site-key-123');
    expect(initializeAppCheckMock).toHaveBeenCalledTimes(1);
    const [appArg, options] = initializeAppCheckMock.mock.calls[0];
    expect(appArg).toEqual({ name: 'test-app' });
    expect(options.provider).toEqual({ siteKey: 'site-key-123' });
    expect(options.isTokenAutoRefreshEnabled).toBe(true);
  });

  it('初期化が例外を投げてもクラッシュしない', async () => {
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', 'site-key-123');
    initializeAppCheckMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { initAppCheck } = await import('../../src/lib/appCheck');
    expect(() => initAppCheck()).not.toThrow();
  });
});
