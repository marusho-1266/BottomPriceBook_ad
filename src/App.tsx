import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { LoginScreen } from './features/auth/LoginScreen';
import { ensureBook } from './features/books/api';
import { db } from './lib/firebase';

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream">
      <p className="text-sm font-bold text-ink-faint">読み込み中…</p>
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const [bookReady, setBookReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setBookReady(false);
      return;
    }
    let cancelled = false;
    ensureBook(db, user.uid).then(() => {
      if (!cancelled) setBookReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Loading />;
  if (!user) return <LoginScreen />;
  if (!bookReady) return <Loading />;

  return (
    <div className="min-h-dvh bg-cream">
      <header className="rounded-b-[28px] bg-primary px-5 pt-16 pb-4">
        <h1 className="text-xl font-extrabold tracking-wider text-white">そこねこ</h1>
      </header>
      <main className="p-5">
        <p className="text-sm text-ink-sub">底値帳アプリを準備中です。</p>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
