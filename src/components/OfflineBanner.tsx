import { useEffect, useState } from 'react';

/** ブラウザのオンライン状態を表示する(M-4 のオフライン閲覧の前提をユーザーに伝える) */
export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="bg-ink px-4 py-2 text-center text-xs font-bold text-white"
    >
      オフラインです。閲覧と記録は端末に保存され、接続復帰後に同期されます。
    </div>
  );
}
