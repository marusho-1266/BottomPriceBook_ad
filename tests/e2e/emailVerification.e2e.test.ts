import { applyActionCode, signOut as firebaseSignOut } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { refreshEmailVerification, signUpWithEmail } from '../../src/features/auth/api';
import { ensureBook } from '../../src/features/books/api';
import { auth, db } from '../../src/lib/firebase';
import { AUTH_HOST, PROJECT_ID, clearEmulators } from './testUtils';

/**
 * メール確認(email verification)E2E: Issue #15。
 * `npm run emulators` で Auth/Firestore エミュレータを起動してから実行すること。
 * 実クライアント SDK(signUpWithEmail 等)× 実エミュレータで、確認メール送信から
 * リンク踏破、firestore.rules の email_verified 強制までを通しで検証する。
 */

async function fetchVerifyEmailOobCode(email: string): Promise<string> {
  const res = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const body = (await res.json()) as {
    oobCodes: Array<{ email: string; requestType: string; oobCode: string }>;
  };
  const entry = body.oobCodes.find(
    (c) => c.email === email && c.requestType === 'VERIFY_EMAIL',
  );
  if (!entry) throw new Error(`oobCode not found for ${email}`);
  return entry.oobCode;
}

beforeEach(async () => {
  await clearEmulators();
  await firebaseSignOut(auth).catch(() => {});
});

afterEach(async () => {
  await firebaseSignOut(auth).catch(() => {});
});

describe('メール確認 E2E', () => {
  it('登録直後は確認メールが送信され、未確認の間は book を作成できない', async () => {
    const credential = (await signUpWithEmail('carol@example.com', 'password123')) as {
      user: { uid: string; emailVerified: boolean };
    };
    expect(credential.user.emailVerified).toBe(false);

    // 確認メールが実際に送信されたことを OOB コードの存在で確認する
    const oobCode = await fetchVerifyEmailOobCode('carol@example.com');
    expect(oobCode).toBeTruthy();

    // 未確認のまま Firestore へ書き込もうとすると firestore.rules に拒否される
    await expect(ensureBook(db, credential.user.uid, 'キャロル')).rejects.toThrow();
  });

  it('確認リンクを踏んでリフレッシュすると、以後 Firestore にアクセスできる', async () => {
    await signUpWithEmail('dave@example.com', 'password123');
    const oobCode = await fetchVerifyEmailOobCode('dave@example.com');

    // メール内のリンクを踏む操作を再現(Firebase Auth の確認コード適用 API)
    await applyActionCode(auth, oobCode);

    // VerifyEmailScreen の「確認しました」ボタンと同じ処理
    const verified = await refreshEmailVerification();
    expect(verified).toBe(true);
    expect(auth.currentUser?.emailVerified).toBe(true);

    const uid = auth.currentUser!.uid;
    await expect(ensureBook(db, uid, 'デイブ')).resolves.toBeUndefined();
  });
});
