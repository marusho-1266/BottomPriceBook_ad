import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics';
import { app } from './firebase';

let analyticsPromise: Promise<Analytics | null> | null = null;

/**
 * Analytics インスタンスを遅延初期化する。measurementId 未設定・エミュレータ利用時・
 * 非対応環境(isSupported が false。jsdom 等)では null を返す no-op にする
 */
function getAnalyticsInstance(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
    const useEmulators = import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true';
    if (!measurementId || useEmulators) return null;

    const supported = await isSupported();
    if (!supported) return null;

    return getAnalytics(app);
  })();

  return analyticsPromise;
}

/**
 * カスタムイベントを送信する。fire-and-forget(失敗しても機能を妨げない)。
 * PII・自由入力値(商品名・価格・店舗名等)は params に含めないこと
 */
export async function trackEvent(name: string, params?: Record<string, unknown>): Promise<void> {
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    logEvent(analytics, name, params);
  } catch {
    // 計測失敗が機能を妨げないよう、ここで握りつぶす
  }
}
