import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isSupportedMock = vi.hoisted(() => vi.fn());
const getAnalyticsMock = vi.hoisted(() => vi.fn());
const logEventMock = vi.hoisted(() => vi.fn());

vi.mock('firebase/analytics', () => ({
  isSupported: isSupportedMock,
  getAnalytics: getAnalyticsMock,
  logEvent: logEventMock,
}));

vi.mock('../../src/lib/firebase', () => ({ app: {} }));

describe('trackEvent', () => {
  beforeEach(() => {
    isSupportedMock.mockReset();
    getAnalyticsMock.mockReset();
    logEventMock.mockReset();
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', '');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('measurementId が未設定なら初期化せず、trackEvent はクラッシュしない', async () => {
    isSupportedMock.mockResolvedValue(true);
    const { trackEvent } = await import('../../src/lib/analytics');

    await expect(trackEvent('record_price')).resolves.toBeUndefined();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it('エミュレータ利用時は measurementId があっても初期化しない', async () => {
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST123');
    vi.stubEnv('VITE_FIREBASE_USE_EMULATORS', 'true');
    isSupportedMock.mockResolvedValue(true);
    const { trackEvent } = await import('../../src/lib/analytics');

    await trackEvent('record_price');

    expect(getAnalyticsMock).not.toHaveBeenCalled();
  });

  it('非対応環境(isSupported が false)では初期化しない', async () => {
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST123');
    isSupportedMock.mockResolvedValue(false);
    const { trackEvent } = await import('../../src/lib/analytics');

    await trackEvent('record_price');

    expect(getAnalyticsMock).not.toHaveBeenCalled();
  });

  it('measurementId ありかつ対応環境なら logEvent を呼ぶ', async () => {
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST123');
    isSupportedMock.mockResolvedValue(true);
    const analyticsInstance = { name: 'fake-analytics' };
    getAnalyticsMock.mockReturnValue(analyticsInstance);
    const { trackEvent } = await import('../../src/lib/analytics');

    await trackEvent('record_price', { isSale: true });

    expect(logEventMock).toHaveBeenCalledWith(analyticsInstance, 'record_price', { isSale: true });
  });

  it('logEvent が例外を投げても trackEvent は失敗しない(fire-and-forget)', async () => {
    vi.stubEnv('VITE_FIREBASE_MEASUREMENT_ID', 'G-TEST123');
    isSupportedMock.mockResolvedValue(true);
    getAnalyticsMock.mockReturnValue({});
    logEventMock.mockImplementation(() => {
      throw new Error('boom');
    });
    const { trackEvent } = await import('../../src/lib/analytics');

    await expect(trackEvent('record_price')).resolves.toBeUndefined();
  });
});
