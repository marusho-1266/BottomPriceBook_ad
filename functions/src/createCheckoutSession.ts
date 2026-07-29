import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { type CallableRequest, HttpsError } from 'firebase-functions/v2/https';

const PENDING_COLLECTION = 'pendingCheckouts';
const LOCK_TTL_MS = 60_000;
/**
 * Stripe Checkout Session の有効期限（秒）。
 * API 上限は作成から 24h のため、時計ずれ余裕を残して 23h55m にする。
 */
export const STRIPE_SESSION_TTL_SEC = 23 * 60 * 60 + 55 * 60;
/**
 * pending 再利用ウィンドウ。Stripe Session 期限より短くし、
 * 期限切れ URL を reuse し続けないようにする。
 */
export const PENDING_REUSE_TTL_MS = 23 * 60 * 60 * 1000;
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
    /** Unix 秒。Stripe Session の expires_at */
    expiresAtUnix: number;
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
  /** テスト差し替え用 */
  createAttemptId?: () => string;
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
  | { type: 'create'; attemptId: string };

async function claimPendingCheckout(
  uid: string,
  deps: CreateCheckoutSessionDeps,
): Promise<ClaimOutcome> {
  const { firestore } = deps;
  const nowMs = (deps.now ?? Date.now)();
  const ref = firestore.collection(PENDING_COLLECTION).doc(uid);
  const createAttemptId = deps.createAttemptId ?? randomUUID;

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

    const attemptId = createAttemptId();
    tx.set(ref, {
      status: 'creating',
      attemptId,
      lockExpiresAtMs: nowMs + LOCK_TTL_MS,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { type: 'create', attemptId };
  });
}

/**
 * 認証ユーザー向け Stripe Checkout Session を作成し URL を返す。
 * pendingCheckouts/{uid} で直列化し、並行呼び出しでも Session 二重作成を防ぐ。
 * Idempotency-Key は試行 ID 付き（ユーザー×価格の固定キーにしない）。
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
    const { attemptId } = outcome;
    try {
      const nowMs = (deps.now ?? Date.now)();
      const expiresAtUnix = Math.floor(nowMs / 1000) + STRIPE_SESSION_TTL_SEC;
      const session = await deps.createStripeCheckoutSession(
        {
          priceId,
          uid,
          successUrl: `${base}/settings?purchase=success`,
          cancelUrl: `${base}/settings?purchase=cancel`,
          expiresAtUnix,
        },
        { idempotencyKey: `checkout_${uid}_${priceId}_${attemptId}` },
      );

      if (!session.url) {
        throw new HttpsError('internal', 'Checkout URL を取得できませんでした');
      }

      // lock 失効後に別試行が割り込んでいたら上書きしない
      const promoted = await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(pendingRef);
        const data = snap.data();
        if (data?.attemptId !== attemptId) {
          if (data?.status === 'ready' && typeof data.url === 'string') {
            return { ok: true as const, url: data.url };
          }
          return { ok: false as const };
        }
        tx.set(pendingRef, {
          status: 'ready',
          attemptId,
          sessionId: session.id,
          url: session.url,
          expiresAtMs: nowMs + PENDING_REUSE_TTL_MS,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { ok: true as const, url: session.url as string };
      });

      if (!promoted.ok) {
        throw new HttpsError(
          'aborted',
          'Checkout Session の作成が競合しました。しばらくしてから再度お試しください',
        );
      }
      return { url: promoted.url };
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
