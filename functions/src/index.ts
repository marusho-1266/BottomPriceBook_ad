import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { type CallableRequest, HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import {
  handleCreateCheckoutSession,
  type CreateCheckoutSessionResult,
} from './createCheckoutSession.js';
import { runDeleteAccount } from './deleteAccount.js';
import { initSentry, withSentry } from './sentry.js';
import { getStripeConfig } from './stripeConfig.js';
import { handleStripeWebhook } from './stripeWebhook.js';

initializeApp();
initSentry();

setGlobalOptions({ region: 'asia-northeast1' });

export interface DeleteAccountResult {
  ok: true;
}

// クライアントは deleteAccount 呼び出し前に必ず reauthenticate() を行うが、それは
// UI 側の制御に過ぎない。有効期限内の ID トークンを盗用・使い回されただけで
// 直近の再認証を経ていない呼び出しからも削除できてしまわないよう、
// トークンの auth_time(直近サインイン時刻)をサーバー側でも検証する
const MAX_AUTH_AGE_SECONDS = 5 * 60;

// Issue #13: アカウント削除(退会)。
// uid は request.auth からのみ取得し、引数では受け取らない(他人のデータ削除を構造的に防ぐ)。
// onCall のラッパーから分離することで、エミュレータなしにハンドラ単体をテストできる。
export async function handleDeleteAccount(request: CallableRequest): Promise<DeleteAccountResult> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'ログインが必要です');
  }

  const authTime = request.auth.token.auth_time;
  const ageSeconds = typeof authTime === 'number' ? Date.now() / 1000 - authTime : Infinity;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
    throw new HttpsError('unauthenticated', '再認証してからもう一度お試しください');
  }

  await runDeleteAccount(request.auth.uid, { firestore: getFirestore(), auth: getAuth() });

  return { ok: true };
}

export const deleteAccount = onCall(withSentry(handleDeleteAccount));

export async function handleCreateCheckoutSessionRequest(
  request: CallableRequest,
): Promise<CreateCheckoutSessionResult> {
  const config = getStripeConfig();
  const stripe = new Stripe(config.secretKey);

  return handleCreateCheckoutSession(request, {
    firestore: getFirestore(),
    appBaseUrl: config.appBaseUrl,
    priceId: config.priceId,
    createStripeCheckoutSession: async (params, opts) => {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [{ price: params.priceId, quantity: 1 }],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          client_reference_id: params.uid,
          metadata: { uid: params.uid },
        },
        { idempotencyKey: opts.idempotencyKey },
      );
      return { id: session.id, url: session.url ?? '' };
    },
  });
}

export const createCheckoutSession = onCall(withSentry(handleCreateCheckoutSessionRequest));

export const stripeWebhook = onRequest({ cors: false }, async (req, res) => {
  const config = getStripeConfig();
  const stripe = new Stripe(config.secretKey);
  await handleStripeWebhook(req, res, {
    firestore: getFirestore(),
    webhookSecret: config.webhookSecret,
    priceId: config.priceId,
    retrieveCheckoutSession: async (sessionId) => {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items.data.price'],
      });
      return session as unknown as {
        id: string;
        mode: string | null;
        payment_status: string | null;
        currency: string | null;
        amount_total: number | null;
        metadata: Record<string, string> | null;
        client_reference_id: string | null;
        line_items?: { data: Array<{ price?: { id?: string } | string | null }> };
      };
    },
  });
});
