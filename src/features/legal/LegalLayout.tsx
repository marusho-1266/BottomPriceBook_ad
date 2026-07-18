import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

// 規約・ポリシーは未ログインでも表示されるため AppShell/SubPageHeader(固定 backTo)は使わず、
// 遷移元があれば戻る・直リンクで開かれたらトップ(未ログイン時はログイン画面)へ返す
function BackButton() {
  const navigate = useNavigate();
  const handleBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };
  return (
    <button type="button" onClick={handleBack} aria-label="戻る" className="-ml-2 p-2 text-ink-sub">
      <ChevronLeft className="size-6" />
    </button>
  );
}

export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream pb-10">
      <header className="flex items-center gap-2 px-4 pt-14 pb-3">
        <BackButton />
        <h2 className="text-lg font-extrabold">{title}</h2>
      </header>
      <div className="flex flex-col gap-4 px-4 text-sm leading-relaxed text-ink-sub">
        {children}
      </div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  );
}
