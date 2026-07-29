import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

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
});

describe('users/{uid} ライセンス(Issue #36)', () => {
  it('本人は自分の users doc を読める', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', ALICE), {
        license: { status: 'lifetime' },
      });
    });
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(getDoc(doc(db, 'users', ALICE)));
  });

  it('他人の users doc は読めない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', ALICE), {
        license: { status: 'free' },
      });
    });
    const db = testEnv.authenticatedContext(BOB, { email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, 'users', ALICE)));
  });

  it('本人は free の license を作成できる', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertSucceeds(
      setDoc(doc(db, 'users', ALICE), { license: { status: 'free' } }),
    );
  });

  it('本人でも lifetime を作成できない', async () => {
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(
      setDoc(doc(db, 'users', ALICE), { license: { status: 'lifetime' } }),
    );
  });

  it('本人でも license.status を更新できない', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', ALICE), {
        license: { status: 'free' },
      });
    });
    const db = testEnv.authenticatedContext(ALICE, { email_verified: true }).firestore();
    await assertFails(updateDoc(doc(db, 'users', ALICE), { 'license.status': 'lifetime' }));
  });
});
