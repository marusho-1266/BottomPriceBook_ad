import { describe, expect, it, vi } from 'vitest';

const docMock = vi.hoisted(() => vi.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })));
const serverTimestampMock = vi.hoisted(() => vi.fn(() => 'server-timestamp-sentinel'));

vi.mock('firebase/firestore', () => ({
  doc: docMock,
  serverTimestamp: serverTimestampMock,
}));

vi.mock('../../src/lib/firebase', () => ({ db: { type: 'firestore-stub' } }));

describe('withRateLimit', () => {
  it('バッチに rateLimits doc の serverTimestamp 更新を積む', async () => {
    const { withRateLimit } = await import('../../src/lib/rateLimit');
    const setMock = vi.fn();
    const batch = { set: setMock } as unknown as { set: typeof setMock };

    withRateLimit(batch as never, 'book-1', 'uid-1');

    expect(docMock).toHaveBeenCalledWith(
      { type: 'firestore-stub' },
      'books',
      'book-1',
      'rateLimits',
      'uid-1',
    );
    expect(setMock).toHaveBeenCalledTimes(1);
    const [ref, data] = setMock.mock.calls[0];
    expect(ref.path).toBe('books/book-1/rateLimits/uid-1');
    expect(data).toEqual({ lastWriteAt: 'server-timestamp-sentinel' });
  });
});
