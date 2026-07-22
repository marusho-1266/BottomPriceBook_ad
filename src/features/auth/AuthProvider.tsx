import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** linkWithPopup 等で uid が変わらない更新後に providerData を再取得する */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
  }, []);

  const refreshUser = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setState({ user: null, loading: false });
      return;
    }
    await current.reload();
    // 新しい state オブジェクトを渡して再レンダーを起こす(user 参照が同一でも providerData は更新済み)
    setState({ user: auth.currentUser, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, refreshUser }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
