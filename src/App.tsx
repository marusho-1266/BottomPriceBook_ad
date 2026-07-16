import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { LoginScreen } from './features/auth/LoginScreen';
import { ensureBook } from './features/books/api';
import { BookProvider } from './features/books/BookProvider';
import { AppShell } from './components/AppShell';
import { HomePage } from './routes/HomePage';
import { RecordPage } from './routes/RecordPage';
import { ComparePage } from './routes/ComparePage';
import { SettingsPage } from './routes/SettingsPage';
import { ProductDetailPage } from './routes/ProductDetailPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { StoresPage } from './features/stores/StoresPage';
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
  const [readyUid, setReadyUid] = useState<string | null>(null);
  const bookReady = user != null && readyUid === user.uid;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const uid = user.uid;
    ensureBook(db, uid, user.displayName ?? user.email ?? '').then(() => {
      if (!cancelled) setReadyUid(uid);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Loading />;
  if (!user) return <LoginScreen />;
  if (!bookReady) return <Loading />;

  return (
    <BookProvider key={user.uid} uid={user.uid}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="record" element={<RecordPage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/categories" element={<CategoriesPage />} />
            <Route path="settings/stores" element={<StoresPage />} />
            <Route path="products/:productId" element={<ProductDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </BookProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
