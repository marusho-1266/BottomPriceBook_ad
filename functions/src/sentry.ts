import * as Sentry from '@sentry/node';

let initialized = false;

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
  if (!dsn || initialized) return;

  Sentry.init({
    dsn,
    environment: 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function isSentryInitialized(): boolean {
  return initialized;
}

/**
 * Callable ハンドラを Sentry でラップする。例外発生時は capture してから
 * flush(送信完了を待つ。Cloud Functions はレスポンス後にプロセスが凍結されうるため)し、
 * 呼び出し元へのエラー返却を変えないよう必ず re-throw する
 */
export function withSentry<Args extends unknown[], R>(
  handler: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (initialized) {
        sentryClient.captureException(error);
        await sentryClient.flush(2000);
      }
      throw error;
    }
  };
}
