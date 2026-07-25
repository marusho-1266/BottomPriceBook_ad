import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { type CallableRequest, HttpsError } from 'firebase-functions/v2/https';

const PENDING_COLLECTION = 'pendingCheckouts';
const LOCK_TTL_MS = 60_000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const WAIT_ATTEMPTS = 40;
const WAIT_MS = 50;

export interface StripeCheckoutSessionResult {
  id: string;
  url: string;
}

export type StripeCheckoutCreator = (
  params: {
    priceId: string;
    uid: string;
    successUrl: string;
    cancelUrl: string;
  },
  opts: { idempotencyKey: string },
) => Promise<StripeCheckoutSessionResult>;

export interface CreateCheckoutSessionDeps {
  firestore: Firestore;
  appBaseUrl: string;
  priceId: string;
  createStripeCheckoutSession: StripeCheckoutCreator;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface CreateCheckoutSessionResult {
  url: string;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type ClaimOutcome =
  | { type: 'reuse'; url: string }
  | { type: 'wait' }
  | { type: 'create' };

async function claimPendingCheckout(
  uid: string,
  deps: CreateCheckoutSessionDeps,
): Promise<ClaimOutcome> {
  const { firestore } = deps;
  const nowMs = (deps.now ?? Date.now)();
  const ref = firestore.collection(PENDING_COLLECTION).doc(uid);

  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();

    if (
      data?.status === 'ready' &&
      typeof data.url === 'string' &&
      typeof data.expiresAtMs === 'number' &&
      data.expiresAtMs > nowMs
    ) {
      return { type: 'reuse', url: data.url };
    }

    if (
      data?.status === 'creating' &&
      typeof data.lockExpiresAtMs === 'number' &&
      data.lockExpiresAtMs > nowMs
    ) {
      return { type: 'wait' };
    }

    tx.set(ref, {
      status: 'creating',
      lockExpiresAtMs: nowMs + LOCK_TTL_MS,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { type: 'create' };
  });
}

/**
 * 認証ユーザー向け Stripe Checkout Session を作成し URL を返す。
 * pendingCheckouts/{uid} で直列化し、並行呼び出しでも Session 二重作成を防ぐ。
 */
export async function handleCreateCheckoutSession(
  request: CallableRequest,
  deps: CreateCheckoutSessionDeps,
): Promise<CreateCheckoutSessionResult> {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'ログインが必要です');
  }

  const uid = request.auth.uid;
  const { firestore, appBaseUrl, priceId } = deps;
  const sleep = deps.sleep ?? defaultSleep;
  const base = appBaseUrl.replace(/\/$/, '');

  const userSnap = await firestore.collection('users').doc(uid).get();
  if (userSnap.data()?.license?.status === 'lifetime') {
    throw new HttpsError('failed-precondition', 'すでに買い切り済みです');
  }

  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
    const outcome = await claimPendingCheckout(uid, deps);

    if (outcome.type === 'reuse') {
      return { url: outcome.url };
    }
    if (outcome.type === 'wait') {
      await sleep(WAIT_MS);
      continue;
    }

    const pendingRef = firestore.collection(PENDING_COLLECTION).doc(uid);
    try {
      const session = await deps.createStripeCheckoutSession(
        {
          priceId,
          uid,
          successUrl: `${base}/settings?purchase=success`,
          cancelUrl: `${base}/settings?purchase=cancel`,
        },
        { idempotencyKey: `checkout_${uid}_${priceId}` },
      );

      if (!session.url) {
        throw new HttpsError('internal', 'Checkout URL を取得できませんでした');
      }

      const nowMs = (deps.now ?? Date.now)();
      await pendingRef.set({
        status: 'ready',
        sessionId: session.id,
        url: session.url,
        expiresAtMs: nowMs + SESSION_TTL_MS,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { url: session.url };
    } catch (error) {
      await pendingRef.delete().catch(() => undefined);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Checkout Session の作成に失敗しました');
    }
  }

  throw new HttpsError(
    'aborted',
    'Checkout Session の作成が混み合っています。しばらくしてから再度お試しください',
  );
}
