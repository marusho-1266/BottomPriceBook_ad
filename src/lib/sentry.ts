import * as Sentry from '@sentry/react';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** PII(メールアドレス)をマスクする。JSON 文字列化 → 復元で入れ子構造にも適用する */
function maskPii<T>(value: T): T {
  try {
    const masked = JSON.stringify(value).replace(EMAIL_PATTERN, '[masked-email]');
    return JSON.parse(masked) as T;
  } catch {
    return value;
  }
}

/**
 * Sentry を初期化する。DSN 未設定・エミュレータ利用時は no-op にし、
 * ローカル開発でのノイズや DSN 無しでのクラッシュを防ぐ
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const useEmulators = import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true';

  if (!dsn || useEmulators) return;

  Sentry.init({
    dsn,
    environment: 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: (event) => maskPii(event),
  });
}
