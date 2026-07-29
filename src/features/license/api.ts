import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { firebaseAuthErrorCode } from '../../lib/firebaseAuthError';
import { useDoc } from '../../lib/firestoreHooks';
import type { LicenseStatus, UserLicense } from '../../types/models';
import { resolveLicenseStatus } from './policy';

interface UserDoc {
  license?: UserLicense;
}

export class CheckoutError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CheckoutError';
  }
}

function mapCheckoutError(error: unknown): CheckoutError {
  switch (firebaseAuthErrorCode(error)) {
    case 'functions/unauthenticated':
      return new CheckoutError('ログインしてからもう一度お試しください', { cause: error });
    case 'functions/failed-precondition':
      return new CheckoutError('すでに買い切り済みです', { cause: error });
    default:
      return new CheckoutError('購入ページを開けませんでした。しばらくしてからもう一度お試しください', {
        cause: error,
      });
  }
}

/**
 * Stripe Checkout Session を作成し、Hosted Checkout へ遷移する。
 * @param assign テスト差し替え用（既定は window.location.assign）
 */
export async function startCheckout(
  assign: (url: string) => void = (url) => {
    window.location.assign(url);
  },
): Promise<void> {
  try {
    const call = httpsCallable<undefined, { url: string }>(functions, 'createCheckoutSession');
    const result = await call();
    const url = result.data?.url;
    if (!url) {
      throw new CheckoutError('購入ページを開けませんでした。しばらくしてからもう一度お試しください');
    }
    assign(url);
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw mapCheckoutError(error);
  }
}

/** 本人の users/{uid}.license を購読。欠落・未作成は free */
export function useUserLicense(uid: string | undefined): {
  status: LicenseStatus;
  loading: boolean;
} {
  const ref = useMemo(() => (uid ? doc(db, 'users', uid) : null), [uid]);
  const { data, loading } = useDoc<UserDoc>(ref);
  return {
    status: resolveLicenseStatus(data?.license),
    loading: Boolean(uid) && loading,
  };
}
