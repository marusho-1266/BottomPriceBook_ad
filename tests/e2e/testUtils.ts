import { createUserWithEmailAndPassword } from 'firebase/auth';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth as getAdminAuth, type Auth as AdminAuth } from 'firebase-admin/auth';
import {
  getFirestore as getAdminFirestore,
  type Firestore as AdminFirestore,
} from 'firebase-admin/firestore';
import { ensureBook } from '../../src/features/books/api';
import { auth, db } from '../../src/lib/firebase';

export const PROJECT_ID = 'demo-sokoneko';
export const FIRESTORE_HOST = '127.0.0.1:8080';
export const AUTH_HOST = '127.0.0.1:9099';
export const PASSWORD = 'Password123!';

export function initAdminApp(): { adminApp: App; adminDb: AdminFirestore; adminAuth: AdminAuth } {
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
  const adminApp = initializeApp({ projectId: PROJECT_ID }, `e2e-verify-${Date.now()}-${Math.random()}`);
  return { adminApp, adminDb: getAdminFirestore(adminApp), adminAuth: getAdminAuth(adminApp) };
}

export async function deleteAdminApp(adminApp: App): Promise<void> {
  await deleteApp(adminApp);
}

export async function clearEmulators(): Promise<void> {
  await fetch(
    `http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
}

export async function signUp(email: string, displayName: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, PASSWORD);
  await ensureBook(db, credential.user.uid, displayName);
  return credential.user;
}
