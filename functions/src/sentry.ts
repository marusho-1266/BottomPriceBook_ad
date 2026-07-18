import * as Sentry from '@sentry/node';
import { HttpsError } from 'firebase-functions/v2/https';

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

let initialized = false;

/** PII(メールアドレス)をマスクする。JSON 文字列化 → 復元で入れ子構造にも適用する */
function maskPii<T>(value: T): T {
  try {
    const masked = JSON.stringify(value).replace(EMAIL_PATTERN, '[masked-email]');
    return JSON.parse(masked) as T;
  } catch {
    return value;
  }
}

/** テストから差し替え可能にするための薄いラッパー(ESM の名前付き export は再代入できないため) */
export const sentryClient = {
  captureException: (error: unknown): void => {
    Sentry.captureException(error);
  },
  flush: (timeoutMs?: number): Promise<boolean> => Sentry.flush(timeoutMs),
};

/**
 * Sentry を初期化する。SENTRY_DSN 未設定なら no-op にする
 * (ローカル開発・エミュレータでのノイズ防止)
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  if (!dsn || isEmulator || initialized) return;

  Sentry.init({
    dsn,
    environment: 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: (event) => maskPii(event),
  });
  initialized = true;
}

export function isSentryInitialized(): boolean {
  return initialized;
}

/**
 * Callable ハンドラを Sentry でラップする。クライアント想定内の HttpsError
 * (unauthenticated 等)はノイズになるため送信せず、予期しない例外のみ capture してから
 * flush(送信完了を待つ。Cloud Functions はレスポンス後にプロセスが凍結されうるため)する。
 * Sentry 送信が失敗しても、また対象外の例外でも、呼び出し元へのエラー返却を変えないよう必ず re-throw する
 */
export function withSentry<Args extends unknown[], R>(
  handler: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (initialized && !(error instanceof HttpsError)) {
        try {
          sentryClient.captureException(error);
          await sentryClient.flush(2000);
        } catch {
          // Sentry 送信の失敗で呼び出し元へのエラー返却を変えないよう握りつぶす
        }
      }
      throw error;
    }
  };
}
