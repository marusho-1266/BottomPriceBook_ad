import type { Firestore } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import Stripe from 'stripe';
import { grantLifetimeLicense } from './licenseGrant.js';
import { LIFETIME_PRICE_AMOUNT_JPY } from './stripeConfig.js';

const GRANT_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

export interface RetrievedCheckoutSession {
  id: string;
  mode: string | null;
  payment_status: string | null;
  currency: string | null;
  amount_total: number | null;
  metadata: Record<string, string> | null;
  client_reference_id: string | null;
  line_items?: { data: Array<{ price?: { id?: string } | string | null }> };
}

export interface StripeWebhookDeps {
  firestore: Firestore;
  webhookSecret: string;
  priceId: string;
  retrieveCheckoutSession: (sessionId: string) => Promise<RetrievedCheckoutSession>;
  /** テスト差し替え用。未指定なら Stripe SDK の constructEvent */
  constructEvent?: (payload: string | Buffer, signature: string, secret: string) => Stripe.Event;
}

export interface StripeWebhookResponse {
  status(code: number): StripeWebhookResponse;
  send(body: unknown): StripeWebhookResponse;
  json(body: unknown): StripeWebhookResponse;
}

function resolveUid(session: RetrievedCheckoutSession): string | null {
  const fromMeta = session.metadata?.uid?.trim();
  if (fromMeta) return fromMeta;
  const fromRef = session.client_reference_id?.trim();
  return fromRef || null;
}

function lineItemPriceId(session: RetrievedCheckoutSession): string | null {
  const item = session.line_items?.data?.[0];
  if (!item) return null;
  const price = item.price;
  if (typeof price === 'string') return price;
  return price?.id ?? null;
}

export function isValidPaidCheckoutSession(
  session: RetrievedCheckoutSession,
  expectedPriceId: string,
): { ok: true; uid: string } | { ok: false; reason: string } {
  if (session.mode !== 'payment') {
    return { ok: false, reason: 'mode is not payment' };
  }
  if (session.payment_status !== 'paid') {
    return { ok: false, reason: 'payment_status is not paid' };
  }
  if ((session.currency ?? '').toLowerCase() !== 'jpy') {
    return { ok: false, reason: 'currency is not jpy' };
  }
  if (session.amount_total !== LIFETIME_PRICE_AMOUNT_JPY) {
    return { ok: false, reason: 'amount_total mismatch' };
  }
  const priceId = lineItemPriceId(session);
  if (priceId !== expectedPriceId) {
    return { ok: false, reason: 'price id mismatch' };
  }
  const uid = resolveUid(session);
  if (!uid) {
    return { ok: false, reason: 'uid missing' };
  }
  return { ok: true, uid };
}

/**
 * Stripe Webhook: 署名検証 → Session 検証 → grantLifetimeLicense。
 * raw body 必須。不正署名は 400。検証不合格・未知イベントは付与せず 200。
 */
export async function handleStripeWebhook(
  req: Pick<Request, 'method' | 'headers' | 'rawBody'> & { body?: unknown },
  res: StripeWebhookResponse,
  deps: StripeWebhookDeps,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string' || !req.rawBody) {
    res.status(400).send('Webhook Error: missing signature or body');
    return;
  }

  const constructEvent =
    deps.constructEvent ??
    ((payload, sig, secret) => Stripe.webhooks.constructEvent(payload, sig, secret));

  let event: Stripe.Event;
  try {
    event = constructEvent(req.rawBody, signature, deps.webhookSecret);
  } catch (error) {
    console.error('Stripe webhook signature verification failed', error);
    res.status(400).send('Webhook Error: invalid signature');
    return;
  }

  if (!GRANT_EVENT_TYPES.has(event.type)) {
    res.status(200).json({ received: true });
    return;
  }

  const eventSession = event.data.object as Stripe.Checkout.Session;
  let session: RetrievedCheckoutSession;
  try {
    session = await deps.retrieveCheckoutSession(eventSession.id);
  } catch (error) {
    console.error('Failed to retrieve Checkout Session', eventSession.id, error);
    res.status(500).send('Failed to retrieve session');
    return;
  }

  const validation = isValidPaidCheckoutSession(session, deps.priceId);
  if (!validation.ok) {
    console.warn('Checkout Session validation failed', {
      sessionId: session.id,
      reason: validation.reason,
      eventId: event.id,
    });
    res.status(200).json({ received: true });
    return;
  }

  try {
    await grantLifetimeLicense(
      {
        uid: validation.uid,
        source: 'stripe',
        stripeCheckoutSessionId: session.id,
        stripeEventId: event.id,
      },
      { firestore: deps.firestore },
    );
  } catch (error) {
    console.error('grantLifetimeLicense failed', error);
    res.status(500).send('Grant failed');
    return;
  }

  res.status(200).json({ received: true });
}
