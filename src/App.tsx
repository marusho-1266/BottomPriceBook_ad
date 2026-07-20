import { useEffect, useRef, useState } from 'react';
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
import { OnboardingModal } from './features/onboarding/OnboardingModal';
import { hasSeenOnboarding, markOnboardingSeen } from './features/onboarding/storage';
import { db } from './lib/firebase';
import { trackEvent } from './lib/analytics';

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
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // bookReady が uid ごとに true になった瞬間だけ判定したいので、判定済みの uid を記録する
  // (state での比較。effect 内で直接 setState すると react-hooks/set-state-in-effect に
  // 抵触するため、レンダー中の条件付き setState という React 公式の許容パターンを使う)
  const [onboardingCheckedUid, setOnboardingCheckedUid] = useState<string | null>(null);
  // StrictMode の setup→cleanup→setup で 'onboarding_shown' が二重発火しないよう、
  // uid ごとに送信済みかを ref で管理する(ref は effect の再実行を跨いで保持される)
  const onboardingShownUidRef = useRef<string | null>(null);

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

  // 初回ログイン(book 準備完了)のタイミングで、未読ならオンボーディングを自動表示する(Issue #21)
  if (bookReady && user && onboardingCheckedUid !== user.uid) {
    setOnboardingCheckedUid(user.uid);
    setOnboardingOpen(!hasSeenOnboarding(user.uid));
  }

  useEffect(() => {
    if (onboardingOpen && user && onboardingShownUidRef.current !== user.uid) {
      onboardingShownUidRef.current = user.uid;
      trackEvent('onboarding_shown');
    }
  }, [onboardingOpen, user]);

  function closeOnboarding(eventName: 'onboarding_completed' | 'onboarding_skipped') {
    if (user) markOnboardingSeen(user.uid);
    trackEvent(eventName);
    setOnboardingOpen(false);
  }

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
      {onboardingOpen && (
        <OnboardingModal
          onComplete={() => closeOnboarding('onboarding_completed')}
          onSkip={() => closeOnboarding('onboarding_skipped')}
        />
      )}
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
