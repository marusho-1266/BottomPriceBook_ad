import { useEffect, useState } from 'react';
import { onSnapshot, type DocumentReference, type Query } from 'firebase/firestore';
import type { WithId } from '../types/models';

interface CollectionState<T> {
  data: WithId<T>[];
  loading: boolean;
}

/** クエリ/コレクションを onSnapshot でリアルタイム購読する */
export function useCollection<T>(query: Query | null): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({ data: [], loading: true });

  useEffect(() => {
    if (!query) return;
    return onSnapshot(query, (snapshot) => {
      setState({
        data: snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) })),
        loading: false,
      });
    });
    // 呼び出し側は useMemo で安定化した query を渡す前提
  }, [query]);

  return state;
}

interface DocState<T> {
  data: WithId<T> | null;
  loading: boolean;
}

/** 単一ドキュメントを onSnapshot でリアルタイム購読する */
export function useDoc<T>(ref: DocumentReference | null): DocState<T> {
  const [state, setState] = useState<DocState<T>>({ data: null, loading: true });

  useEffect(() => {
    if (!ref) return;
    return onSnapshot(ref, (snapshot) => {
      setState({
        data: snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as T) } : null,
        loading: false,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref === null]);

  return state;
}
