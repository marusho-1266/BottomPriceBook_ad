import { auth } from './firebase';

export function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('not authenticated');
  }
  return uid;
}
