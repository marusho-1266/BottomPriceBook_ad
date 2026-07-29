/**
 * Firebase Auth / Callable Functions など、`.code` を持つエラーから code を取り出す。
 * Functions の `functions/unauthenticated` 等にも使う。
 */
export function firebaseAuthErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

export const AUTH_NETWORK_ERROR_MESSAGE =
  'ネットワークエラーが発生しました。もう一度お試しください';
