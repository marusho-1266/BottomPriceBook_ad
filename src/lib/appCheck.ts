import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from './firebase';

/**
 * App Check を初期化する。サイトキー未設定・エミュレータ利用時は no-op にし、
 * ローカル開発・テストでの追加設定を不要にする(Issue #16)
 */
export function initAppCheck(): void {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  const useEmulators = import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true';

  if (!siteKey || useEmulators) return;

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check の初期化失敗でアプリ起動自体を止めない
  }
}
