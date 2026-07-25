import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/** Firestore batch 上限 500 に対し余裕を残す */
export const DEFAULT_MIRROR_CHUNK_SIZE = 400;
export const MIRROR_MAX_ATTEMPTS = 3;

export interface GrantLifetimeLicenseInput {
  uid: string;
  source: string;
  stripeCheckoutSessionId?: string;
  stripeEventId?: string;
}

export interface LicenseGrantDeps {
  firestore: Firestore;
  /** テスト用: ミラー書込のチャンクサイズ */
  mirrorChunkSize?: number;
  /** テスト用: 再試行バックオフ */
  sleep?: (ms: number) => Promise<void>;
  /** テスト用: チャンク commit 直前フック（失敗注入） */
  beforeCommitChunk?: () => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRetries<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      await sleep(2 ** (attempt - 1) * 50);
    }
  }
  throw lastError;
}

/**
 * オーナーの全 book ミラーを lifetime に揃える。
 * 既に lifetime の book はスキップ。欠落 / free のみ更新。
 */
export async function syncOwnerBookMirrors(uid: string, deps: LicenseGrantDeps): Promise<void> {
  const { firestore } = deps;
  const chunkSize = deps.mirrorChunkSize ?? DEFAULT_MIRROR_CHUNK_SIZE;
  const sleep = deps.sleep ?? defaultSleep;

  const snapshot = await firestore.collection('books').where('ownerUid', '==', uid).get();
  const toUpdate = snapshot.docs.filter((docSnap) => docSnap.data().ownerLicenseStatus !== 'lifetime');

  for (let offset = 0; offset < toUpdate.length; offset += chunkSize) {
    const chunk = toUpdate.slice(offset, offset + chunkSize);
    await withRetries(
      async () => {
        if (deps.beforeCommitChunk) {
          await deps.beforeCommitChunk();
        }
        const batch = firestore.batch();
        for (const docSnap of chunk) {
          batch.update(docSnap.ref, { ownerLicenseStatus: 'lifetime' });
        }
        await batch.commit();
      },
      MIRROR_MAX_ATTEMPTS,
      sleep,
    );
  }
}

/**
 * lifetime を付与する共有入口（Webhook / 将来のプロモ）。
 * Stripe 経路: Session 処理済み + users.license を同一 txn で確定してからミラー同期。
 * Session 無し経路: users.license のみコア txn → 同じミラー同期。
 */
export async function grantLifetimeLicense(
  input: GrantLifetimeLicenseInput,
  deps: LicenseGrantDeps,
): Promise<void> {
  const { firestore } = deps;
  const { uid, source, stripeCheckoutSessionId, stripeEventId } = input;
  const userRef = firestore.collection('users').doc(uid);

  await firestore.runTransaction(async (tx) => {
    // Firestore txn: すべての読取を書込より先に行う
    const sessionRef = stripeCheckoutSessionId
      ? firestore.collection('stripeCheckoutSessions').doc(stripeCheckoutSessionId)
      : null;
    const sessionSnap = sessionRef ? await tx.get(sessionRef) : null;
    const userSnap = await tx.get(userRef);

    const repairOnly = sessionSnap?.exists === true;
    const alreadyLifetime = userSnap.data()?.license?.status === 'lifetime';

    if (sessionRef && !repairOnly) {
      tx.set(sessionRef, {
        uid,
        ...(stripeEventId ? { stripeEventId } : {}),
        processedAt: FieldValue.serverTimestamp(),
      });
    }

    if (!alreadyLifetime) {
      tx.set(
        userRef,
        {
          license: {
            status: 'lifetime',
            source,
            purchasedAt: FieldValue.serverTimestamp(),
            ...(stripeCheckoutSessionId ? { stripeCheckoutSessionId } : {}),
          },
        },
        { merge: true },
      );
    }
    // 既 lifetime: 購入メタは上書きしない（別 Session・同時 Webhook 防止）
  });

  await syncOwnerBookMirrors(uid, deps);
}
