import { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setDoc, doc, collection, serverTimestamp, writeBatch, arrayUnion, trackEvent } = vi.hoisted(
  () => ({
    setDoc: vi.fn(),
    doc: vi.fn((...args: unknown[]) => `doc:${args.slice(1).join('/')}`),
    collection: vi.fn(() => 'invites'),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
    writeBatch: vi.fn(),
    arrayUnion: vi.fn((v: unknown) => ({ arrayUnion: v })),
    trackEvent: vi.fn(),
  }),
);

vi.mock('../../../src/lib/analytics', () => ({ trackEvent }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return { ...actual, setDoc, doc, collection, serverTimestamp, writeBatch, arrayUnion };
});

import {
  INVITE_TTL_DAYS,
  buildInviteUrl,
  createInvite,
  inviteExpiresAt,
  isInviteValid,
  joinBook,
} from '../../../src/features/sharing/api';

describe('isInviteValid', () => {
  const now = new Date('2026-07-16T12:00:00Z');

  it('期限が未来なら有効', () => {
    const expiresAt = Timestamp.fromMillis(now.getTime() + 1000);
    expect(isInviteValid({ expiresAt }, now)).toBe(true);
  });

  it('期限ちょうどは無効(ルールの request.time < createdAt + 7d と揃える)', () => {
    const expiresAt = Timestamp.fromMillis(now.getTime());
    expect(isInviteValid({ expiresAt }, now)).toBe(false);
  });

  it('期限切れは無効', () => {
    const expiresAt = Timestamp.fromMillis(now.getTime() - 1000);
    expect(isInviteValid({ expiresAt }, now)).toBe(false);
  });

  it('createdAt から 7 日以内なら有効', () => {
    const createdAt = Timestamp.fromMillis(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(isInviteValid({ createdAt }, now)).toBe(true);
  });

  it('createdAt から 7 日経過なら無効', () => {
    const createdAt = Timestamp.fromMillis(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(isInviteValid({ createdAt }, now)).toBe(false);
  });
});

describe('inviteExpiresAt', () => {
  it('createdAt + 7 日の Timestamp を返す', () => {
    const createdAt = Timestamp.fromMillis(Date.parse('2026-07-16T12:00:00Z'));
    expect(inviteExpiresAt(createdAt).toMillis()).toBe(
      createdAt.toMillis() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
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

describe('createInvite の trackEvent 連携', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDoc.mockResolvedValue(undefined);
  });

  it('招待コード発行に成功したら create_invite イベントを送る', async () => {
    const fakeDb = {} as never;
    await createInvite(fakeDb, { id: 'book1', name: 'テスト家計簿', ownerUid: 'owner1' });

    expect(trackEvent).toHaveBeenCalledWith('create_invite');
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('Firestore への書き込みが失敗したら create_invite イベントを送らない', async () => {
    setDoc.mockRejectedValue(new Error('write failed'));
    const fakeDb = {} as never;

    await expect(
      createInvite(fakeDb, { id: 'book1', name: 'テスト家計簿', ownerUid: 'owner1' }),
    ).rejects.toThrow('write failed');

    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('joinBook の trackEvent 連携', () => {
  let batch: { set: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    writeBatch.mockReturnValue(batch);
  });

  it('参加に成功したら join_book イベントを送る', async () => {
    const fakeDb = {} as never;
    await joinBook(fakeDb, {
      bookId: 'book1',
      inviteCode: 'code1',
      uid: 'uid1',
      displayName: '太郎',
    });

    expect(trackEvent).toHaveBeenCalledWith('join_book');
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('バッチコミットが失敗したら join_book イベントを送らない', async () => {
    batch.commit.mockRejectedValue(new Error('commit failed'));
    const fakeDb = {} as never;

    await expect(
      joinBook(fakeDb, { bookId: 'book1', inviteCode: 'code1', uid: 'uid1', displayName: '太郎' }),
    ).rejects.toThrow('commit failed');

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
