import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type SnapshotCallback = (snapshot: unknown) => void;
const snapshotListeners: SnapshotCallback[] = [];
const unsubscribe = vi.fn();
const onSnapshot = vi.fn((_target: unknown, cb: SnapshotCallback) => {
  snapshotListeners.push(cb);
  return unsubscribe;
});

vi.mock('firebase/firestore', () => ({
  onSnapshot: (target: unknown, cb: SnapshotCallback) => onSnapshot(target, cb),
}));

import { useCollection, useDoc } from '../../src/lib/firestoreHooks';

function collectionSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

describe('useCollection', () => {
  it('スナップショットが届くまで loading=true', () => {
    const { result } = renderHook(() => useCollection<{ name: string }>({} as never));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it('スナップショットのドキュメントを id 付きで返す', () => {
    const { result } = renderHook(() => useCollection<{ name: string }>({} as never));
    act(() => {
      snapshotListeners.at(-1)!(collectionSnapshot([{ id: 'a', data: { name: '食品' } }]));
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([{ id: 'a', name: '食品' }]);
  });

  it('アンマウントで購読を解除する', () => {
    const { unmount } = renderHook(() => useCollection({} as never));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('query の中身が変わったら購読を張り直す(Issue #17: productId 変更時の回帰防止)', () => {
    vi.clearAllMocks();
    const queryA = { id: 'A' };
    const queryB = { id: 'B' };
    const { rerender } = renderHook(({ q }) => useCollection(q as never), {
      initialProps: { q: queryA },
    });
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenLastCalledWith(queryA, expect.any(Function));

    rerender({ q: queryB });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledTimes(2);
    expect(onSnapshot).toHaveBeenLastCalledWith(queryB, expect.any(Function));
  });
});

describe('useDoc', () => {
  it('存在しないドキュメントは null を返す', () => {
    const { result } = renderHook(() => useDoc({} as never));
    act(() => {
      snapshotListeners.at(-1)!({ exists: () => false, id: 'x', data: () => undefined });
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('存在するドキュメントを id 付きで返す', () => {
    const { result } = renderHook(() => useDoc<{ name: string }>({} as never));
    act(() => {
      snapshotListeners.at(-1)!({ exists: () => true, id: 'b1', data: () => ({ name: '本' }) });
    });
    expect(result.current.data).toEqual({ id: 'b1', name: '本' });
  });
});
