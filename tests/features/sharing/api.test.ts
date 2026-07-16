import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  INVITE_TTL_DAYS,
  buildInviteUrl,
  isInviteValid,
} from '../../../src/features/sharing/api';

describe('isInviteValid', () => {
  const now = new Date('2026-07-16T12:00:00Z');

  it('期限が未来なら有効', () => {
    const expiresAt = Timestamp.fromMillis(now.getTime() + 1000);
    expect(isInviteValid({ expiresAt }, now)).toBe(true);
  });

  it('期限ちょうどは無効(ルールの request.time < expiresAt と揃える)', () => {
    const expiresAt = Timestamp.fromMillis(now.getTime());
    expect(isInviteValid({ expiresAt }, now)).toBe(false);
  });

  it('期限切れは無効', () => {
    const expiresAt = Timestamp.fromMillis(now.getTime() - 1000);
    expect(isInviteValid({ expiresAt }, now)).toBe(false);
  });
});

describe('buildInviteUrl', () => {
  it('origin + /join/{code} の URL を組み立てる', () => {
    expect(buildInviteUrl('abc123', 'https://sokoneko.example')).toBe(
      'https://sokoneko.example/join/abc123',
    );
  });
});

describe('INVITE_TTL_DAYS', () => {
  it('有効期限は 7 日', () => {
    expect(INVITE_TTL_DAYS).toBe(7);
  });
});
