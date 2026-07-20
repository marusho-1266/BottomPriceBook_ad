function storageKey(uid: string): string {
  return `sokoneko:onboardingSeen:${uid}`;
}

export function hasSeenOnboarding(uid: string): boolean {
  return localStorage.getItem(storageKey(uid)) === '1';
}

export function markOnboardingSeen(uid: string): void {
  localStorage.setItem(storageKey(uid), '1');
}
