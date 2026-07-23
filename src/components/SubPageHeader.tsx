import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router';

export function SubPageHeader({ title, backTo = '/settings' }: { title: string; backTo?: string }) {
  return (
    <header className="flex items-center gap-2 px-4 pt-14 pb-3 md:pt-6">
      <Link to={backTo} aria-label="戻る" className="-ml-2 p-2 text-ink-sub">
        <ChevronLeft className="size-6" />
      </Link>
      <h2 className="text-lg font-extrabold">{title}</h2>
    </header>
  );
}
