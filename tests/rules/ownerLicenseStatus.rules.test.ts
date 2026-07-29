import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;
const ALICE = 'alice-uid';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-sokoneko',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'books', ALICE), {
      name: 'わたしの底値帳',
      ownerUid: ALICE,
      memberUids: [ALICE],
      bottomWindowMonths: 6,
      createdAt: serverTimestamp(),
      ownerLicenseStatus: 'free',
    });
  });
});

describe('ownerLicenseStatus の自己昇格バイパス(Issue #36)', () => {
  it('updateDoc で lifetime に昇格できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(updateDoc(doc(db, 'books', ALICE), { ownerLicenseStatus: 'lifetime' }));
  });

  it('name 変更に混ぜても lifetime に昇格できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      updateDoc(doc(db, 'books', ALICE), { name: '別名', ownerLicenseStatus: 'lifetime' }),
    );
  });

  it('setDoc の全上書きでも lifetime に昇格できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'books', ALICE), {
        name: 'わたしの底値帳',
        ownerUid: ALICE,
        memberUids: [ALICE],
        bottomWindowMonths: 6,
        createdAt: serverTimestamp(),
        ownerLicenseStatus: 'lifetime',
      }),
    );
  });

  it('ownerLicenseStatus を触らない name 変更は通る(回帰確認)', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(updateDoc(doc(db, 'books', ALICE), { name: '別名' }));
  });
});
