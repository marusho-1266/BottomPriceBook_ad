import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { LoginScreen } from './features/auth/LoginScreen';
import { VerifyEmailScreen } from './features/auth/VerifyEmailScreen';
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
import { JoinPage } from './features/sharing/JoinPage';
import { PrivacyPage } from './features/legal/PrivacyPage';
import { TermsPage } from './features/legal/TermsPage';
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
  // reload() はサーバー側の emailVerified をローカルの User オブジェクトへ反映するが
  // onAuthStateChanged は再発火しないため、確認完了は uid ベースの state で上書きする(Issue #15)
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null);
  const emailVerified = user != null && (user.emailVerified || verifiedUid === user.uid);
  const bookReady = user != null && readyUid === user.uid;

  useEffect(() => {
    if (!user || !emailVerified) return;
    let cancelled = false;
    const uid = user.uid;
    ensureBook(db, uid, user.displayName ?? user.email ?? '').then(() => {
      if (!cancelled) setReadyUid(uid);
    });
    return () => {
      cancelled = true;
    };
  }, [user, emailVerified]);

  if (loading) return <Loading />;
  if (!user) return <LoginScreen />;
  if (!emailVerified) {
    return (
      <VerifyEmailScreen
        email={user.email ?? ''}
        onVerified={() => setVerifiedUid(user.uid)}
      />
    );
  }
  if (!bookReady) return <Loading />;

  return (
    <BookProvider key={user.uid} uid={user.uid}>
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
        {/* 参加フローにタブバーを出さないため AppShell の外に置く(Issue #7)。
            /join はコード手入力用の入り口 */}
        <Route path="join" element={<JoinPage />} />
        <Route path="join/:inviteCode" element={<JoinPage />} />
      </Routes>
    </BookProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      {/* 規約・ポリシーは未ログインでも閲覧できる公開ルート(Issue #14)。
          それ以外は Gate(認証ガード)配下の入れ子 Routes が URL 全体で再マッチする */}
      <BrowserRouter>
        <Routes>
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Gate />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
