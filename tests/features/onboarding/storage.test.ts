import { beforeEach, describe, expect, it } from 'vitest';
import { hasSeenOnboarding, markOnboardingSeen } from '../../../src/features/onboarding/storage';

describe('onboarding storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('未設定の uid は既読扱いにならない', () => {
    expect(hasSeenOnboarding('u1')).toBe(false);
  });

  it('markOnboardingSeen 後は既読扱いになる', () => {
    markOnboardingSeen('u1');
    expect(hasSeenOnboarding('u1')).toBe(true);
  });

  it('uid ごとに独立して既読状態を持つ', () => {
    markOnboardingSeen('u1');
    expect(hasSeenOnboarding('u1')).toBe(true);
    expect(hasSeenOnboarding('u2')).toBe(false);
  });
});
